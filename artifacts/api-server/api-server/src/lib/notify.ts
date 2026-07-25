import { db } from "@workspace/db";
import { notificationsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

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
}
