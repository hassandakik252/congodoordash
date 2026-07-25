import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

// GET /notifications — list notifications for current user, newest first
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  res.json(notifications);
});

// GET /notifications/unread-count — fast badge count
router.get("/unread-count", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const [result] = await db
    .select({ count: count() })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.isRead, false)
      )
    );
  res.json({ count: result?.count ?? 0 });
});

// PATCH /notifications/:id/read — mark one as read
router.patch("/:id/read", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ error: "bad_request", message: "Invalid ID" });
    return;
  }

  const [updated] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(
      and(
        eq(notificationsTable.id, id),
        eq(notificationsTable.userId, req.user!.id)
      )
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(updated);
});

// PATCH /notifications/read-all — mark all as read
router.patch("/read-all", requireAuth, async (req: AuthRequest, res) => {
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(
      and(
        eq(notificationsTable.userId, req.user!.id),
        eq(notificationsTable.isRead, false)
      )
    );
  res.json({ ok: true });
});

export default router;
