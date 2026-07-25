import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  savedAddresses: z
    .array(z.object({ label: z.string(), address: z.string() }))
    .optional(),
});

// GET /users/me — full profile including savedAddresses
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.id))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "not_found", message: "User not found" });
    return;
  }

  const { passwordHash: _, ...safe } = user;
  res.json(safe);
});

// Expo push tokens look like: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
const EXPO_PUSH_TOKEN_RE = /^ExponentPushToken\[.+\]$/;

// PATCH /users/push-token — store Expo push token for future server-side push delivery
router.patch("/push-token", requireAuth, async (req: AuthRequest, res) => {
  const { token } = req.body as { token?: string };
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "token_required", message: "token is required" });
    return;
  }
  if (!EXPO_PUSH_TOKEN_RE.test(token)) {
    res.status(400).json({ error: "invalid_token", message: "Invalid Expo push token format" });
    return;
  }

  await db
    .update(usersTable)
    .set({ expoPushToken: token })
    .where(eq(usersTable.id, req.user!.id));

  res.json({ ok: true });
});

// PATCH /users/profile — update profile
router.patch("/profile", requireAuth, async (req: AuthRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, req.user!.id))
    .returning();

  const { passwordHash: _, ...safe } = updated;
  res.json(safe);
});

export default router;
