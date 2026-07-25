/**
 * Push Notification Service
 *
 * Responsibilities:
 *   - One-time handler setup (shouldShowAlert, sound, badge)
 *   - Expo push-token registration (physical device only, graceful no-op elsewhere)
 *   - Scheduling immediate local OS notifications
 *   - Attaching / removing foreground & tap-response listeners
 *
 * ─── Separation of concerns ────────────────────────────────────────────────
 * In-app notifications  →  DB-backed, polled via notificationApi, shown in the
 *                          Notifications tab (existing system – unchanged)
 * Push / local alerts   →  THIS FILE – OS-level banners that work even when
 *                          the app is backgrounded, with no DB requirement
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Polling remains the primary real-time mechanism.
 * Push notifications are an additional layer that activates on physical devices
 * with notification permission granted.
 */

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Event types (mirror existing DB notification types) ─────────────────────
export const NotificationEvent = {
  NEW_ORDER:       "new_order",
  STATUS_CHANGED:  "status_changed",
  DRIVER_ACCEPTED: "driver_accepted",
  DELIVERED:       "delivered",
} as const;

export type NotificationEventType =
  typeof NotificationEvent[keyof typeof NotificationEvent];

export interface PushNotificationPayload {
  event: NotificationEventType;
  orderId?: number;
  status?: string;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

const isNative = Platform.OS !== "web";

/**
 * Lazily load expo-notifications so the module is never executed on web,
 * which avoids any runtime errors from unsupported APIs.
 */
function getNotifications() {
  if (!isNative) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-notifications") as typeof import("expo-notifications");
  } catch {
    return null;
  }
}

function getDevice() {
  if (!isNative) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-device") as typeof import("expo-device");
  } catch {
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Call once at app startup.
 * Configures how foreground notifications are displayed (alert + sound).
 * Safe no-op on web.
 */
export function setupNotificationHandler(): void {
  const Notifications = getNotifications();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      // Required by expo-notifications SDK 54+
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Request permission and obtain the Expo push token.
 * Returns null without throwing on:
 *   - Web (not supported)
 *   - Simulator / emulator
 *   - Permission denied
 *   - Any unexpected error
 *
 * On success the token is cached in AsyncStorage under "expo_push_token".
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const Notifications = getNotifications();
  const Device = getDevice();

  if (!Notifications || !Device) return null;

  if (!Device.isDevice) {
    console.log("[Push] Skipping token registration — not a physical device");
    return null;
  }

  try {
    const { status: current } = await Notifications.getPermissionsAsync();
    let final = current;

    if (current !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }

    if (final !== "granted") {
      console.log("[Push] Permission not granted");
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync();
    await AsyncStorage.setItem("expo_push_token", token);
    console.log("[Push] Token registered:", token.substring(0, 28) + "…");
    return token;
  } catch (err) {
    console.warn("[Push] Token registration failed:", err);
    return null;
  }
}

/**
 * Return the cached push token from AsyncStorage (or null).
 * Does not trigger a new registration or permission request.
 */
export async function getCachedPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem("expo_push_token");
  } catch {
    return null;
  }
}

/**
 * Fire an immediate local OS notification.
 * Safe no-op on web or when the module is unavailable.
 *
 * @param title   Notification title (already translated by the caller)
 * @param body    Notification body  (already translated by the caller)
 * @param data    Optional payload attached to the notification
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: PushNotificationPayload,
): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: (data ?? {}) as Record<string, unknown>, sound: true },
      trigger: null, // fire immediately
    });
  } catch (err) {
    console.warn("[Push] scheduleLocalNotification failed:", err);
  }
}

/**
 * Attach foreground-notification and tap-response listeners.
 * Returns a cleanup function — call it in a useEffect return.
 * Safe no-op on web (returns a no-op cleanup).
 *
 * @param onReceived  Called when a notification arrives while the app is foregrounded
 * @param onTap       Called when the user taps a notification (app may have been backgrounded)
 */
export function addPushListeners(
  onReceived: (payload: PushNotificationPayload, title: string, body: string) => void,
  onTap: (payload: PushNotificationPayload) => void,
): () => void {
  const Notifications = getNotifications();
  if (!Notifications) return () => {};

  const receivedSub = Notifications.addNotificationReceivedListener((n) => {
    const data = n.request.content.data as unknown as PushNotificationPayload;
    const title = n.request.content.title ?? "";
    const body  = n.request.content.body  ?? "";
    if (data?.event) onReceived(data, title, body);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((r) => {
    const data = r.notification.request.content.data as unknown as PushNotificationPayload;
    if (data?.event) onTap(data);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}
