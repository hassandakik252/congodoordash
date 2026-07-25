/**
 * PushNotificationContext
 *
 * Manages the lifecycle of push notification support:
 *   1. One-time handler setup at app start
 *   2. Token registration after the user logs in (physical device only)
 *   3. Token persistence — AsyncStorage + server (PATCH /users/push-token)
 *      so the backend can send server-initiated push messages in the future
 *   4. Foreground listener — logs received notifications
 *   5. Tap listener — navigates to the relevant order screen
 *
 * ─── What this context does NOT do ─────────────────────────────────────────
 * - It does NOT send server-side push messages (future work).
 * - It does NOT manage in-app notification banners (that's the DB-backed
 *   notificationApi + Notifications tab — an existing, separate system).
 * - It does NOT replace polling — polling remains the primary real-time
 *   mechanism; push is an optional enhancement for physical devices.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Components that want to fire a local OS alert when they detect an event
 * (e.g. new order via polling) should import and call scheduleLocalNotification
 * directly from services/pushNotifications — no need to go through this context.
 */

import React, {
  createContext, useContext, useEffect, useRef, useState,
} from "react";
import { router } from "expo-router";

import {
  setupNotificationHandler,
  registerForPushNotificationsAsync,
  addPushListeners,
  PushNotificationPayload,
} from "@/services/pushNotifications";
import { userApi } from "@/services/api";
import { useAuth } from "./AuthContext";

// ── Context shape ────────────────────────────────────────────────────────────
interface PushNotificationContextValue {
  /** Expo push token, or null when unavailable (web / simulator / no permission). */
  pushToken: string | null;
  /** true when a valid push token has been registered. */
  pushEnabled: boolean;
}

const PushNotificationContext = createContext<PushNotificationContextValue>({
  pushToken: null,
  pushEnabled: false,
});

export function usePushNotifications(): PushNotificationContextValue {
  return useContext(PushNotificationContext);
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function PushNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const cleanupListeners = useRef<() => void>(() => {});

  // Set up the foreground notification handler exactly once at mount.
  // Safe no-op on web.
  useEffect(() => {
    setupNotificationHandler();
  }, []);

  // Register / refresh the token whenever the user changes (login / logout).
  useEffect(() => {
    if (!user) {
      // Clean up listeners when the user logs out.
      cleanupListeners.current();
      return;
    }

    // Attempt push-token registration (returns null gracefully on web / simulator).
    registerForPushNotificationsAsync().then((token) => {
      if (!token) return;

      setPushToken(token);

      // Persist token to the server so future server-side push is possible.
      userApi.savePushToken(token).catch((err) => {
        console.warn("[Push] Could not save push token to server:", err);
      });
    });

    // Attach listeners for as long as the user is logged in.
    cleanupListeners.current = addPushListeners(
      (payload: PushNotificationPayload, title: string, body: string) => {
        // App is in the foreground — the OS banner is shown via the handler
        // (shouldShowAlert: true).  Nothing extra needed here; log for debugging.
        console.log(`[Push] Foreground notification: ${payload.event}`, { title, body });
      },
      (payload: PushNotificationPayload) => {
        // User tapped a notification — navigate to the relevant order if possible.
        if (payload.orderId) {
          router.push(`/order/${payload.orderId}` as any);
        }
      },
    );

    return () => cleanupListeners.current();
  }, [user?.id]);

  return (
    <PushNotificationContext.Provider
      value={{ pushToken, pushEnabled: !!pushToken }}
    >
      {children}
    </PushNotificationContext.Provider>
  );
}
