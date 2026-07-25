import { db } from "@workspace/db";
import { notificationsTable, usersTable } from "@workspace/db/schema";
import { eq, inArray, isNotNull, and } from "drizzle-orm";
import { logger } from "./logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Deliver an OS push via Expo's push service. Fire-and-forget: failures are
 * logged, never thrown. Invalid tokens are ignored by Expo. Set
 * PUSH_DISABLED=1 to turn off (e.g. local dev).
 */
async function sendExpoPush(
  tokens: string[],
  msg: { title: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  if (process.env["PUSH_DISABLED"] === "1") return;
  const valid = tokens.filter((t) => t && t.startsWith("ExponentPushToken"));
  if (valid.length === 0) return;
  try {
    const messages = valid.map((to) => ({ to, sound: "default", ...msg }));
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    if (!res.ok) logger.warn({ status: res.status }, "[push] Expo push returned non-OK");
  } catch (err) {
    logger.warn({ err }, "[push] Expo push failed");
  }
}

/** Look up the Expo tokens for the given users and push to them. */
async function pushToUsers(userIds: number[], msg: { type: string; title: string; body: string; orderId?: number }): Promise<void> {
  if (userIds.length === 0) return;
  const rows = await db
    .select({ token: usersTable.expoPushToken })
    .from(usersTable)
    .where(and(inArray(usersTable.id, userIds), isNotNull(usersTable.expoPushToken)));
  const tokens = rows.map((r) => r.token).filter((t): t is string => !!t);
  await sendExpoPush(tokens, { title: msg.title, body: msg.body, data: { type: msg.type, orderId: msg.orderId } });
}

export type NotificationType =
  | "new_order"
  | "order_confirmed"
  | "order_preparing"
  | "order_ready"
  | "driver_assigned"
  | "order_delivered"
  | "order_cancelled"
  // Admin-targeted
  | "driver_application"
  | "payment_submitted"
  // Customer-targeted
  | "payment_failed"
  | "payment_confirmed";

interface NotificationPayload {
  userId: number;
  type: NotificationType;
  title: string;
  body: string;
  orderId?: number;
}

export async function createNotification(payload: NotificationPayload): Promise<void> {
  await db.insert(notificationsTable).values({
    userId: payload.userId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    orderId: payload.orderId ?? null,
  });
  void pushToUsers([payload.userId], payload);
}

export async function createNotifications(payloads: NotificationPayload[]): Promise<void> {
  if (payloads.length === 0) return;
  await db.insert(notificationsTable).values(
    payloads.map(p => ({
      userId: p.userId,
      type: p.type,
      title: p.title,
      body: p.body,
      orderId: p.orderId ?? null,
    }))
  );
  // Group by identical message to minimise push calls.
  for (const p of payloads) void pushToUsers([p.userId], p);
}

/** Fetch all admin user IDs and send them a notification. Fire-and-forget safe. */
export async function notifyAdmins(payload: Omit<NotificationPayload, "userId">): Promise<void> {
  const admins = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"));

  if (admins.length === 0) return;

  await db.insert(notificationsTable).values(
    admins.map(a => ({
      userId: a.id,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      orderId: payload.orderId ?? null,
    }))
  );
  void pushToUsers(admins.map(a => a.id), payload);
}
