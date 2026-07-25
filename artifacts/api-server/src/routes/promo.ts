import { Router } from "express";
import { db } from "@workspace/db";
import { promoCodesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

// ─── Validation schema ────────────────────────────────────────────────────────
const createPromoSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase(),
  type: z.enum(["fixed", "percent"]),
  value: z.number().positive(),
  minOrderAmount: z.number().nonnegative().optional(),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().optional(), // ISO date string
});

// ─── Admin routes ─────────────────────────────────────────────────────────────

// GET /admin/promo-codes — list all
router.get("/admin/promo-codes", requireAuth, requireRole("admin"), async (_req, res) => {
  try {
    const codes = await db
      .select()
      .from(promoCodesTable)
      .orderBy(promoCodesTable.createdAt);
    res.json(codes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch promo codes" });
  }
});

// POST /admin/promo-codes — create
router.post("/admin/promo-codes", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = createPromoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { code, type, value, minOrderAmount, maxUses, expiresAt } = parsed.data;

  // Validate percent ≤ 100
  if (type === "percent" && value > 100) {
    res.status(400).json({ error: "invalid_value", message: "Percent discount cannot exceed 100%" });
    return;
  }

  try {
    const [promo] = await db
      .insert(promoCodesTable)
      .values({
        code,
        type,
        value,
        minOrderAmount: minOrderAmount ?? null,
        maxUses: maxUses ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();
    res.status(201).json(promo);
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "duplicate_code", message: "Ce code promo existe déjà." });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create promo code" });
  }
});

// PATCH /admin/promo-codes/:id/toggle — activate / deactivate
router.patch("/admin/promo-codes/:id/toggle", requireAuth, requireRole("admin"), async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "bad_request" }); return; }

  try {
    const [promo] = await db.select().from(promoCodesTable).where(eq(promoCodesTable.id, id)).limit(1);
    if (!promo) { res.status(404).json({ error: "not_found" }); return; }

    const [updated] = await db
      .update(promoCodesTable)
      .set({ isActive: !promo.isActive })
      .where(eq(promoCodesTable.id, id))
      .returning();
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to toggle promo code" });
  }
});

// DELETE /admin/promo-codes/:id
router.delete("/admin/promo-codes/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "bad_request" }); return; }

  try {
    await db.delete(promoCodesTable).where(eq(promoCodesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete promo code" });
  }
});

// ─── Customer route ───────────────────────────────────────────────────────────

/**
 * POST /promo-codes/validate
 * Body: { code, subtotal }
 * Returns: { promoId, code, type, value, discountAmount, finalTotal }
 */
router.post("/promo-codes/validate", requireAuth, requireRole("customer"), async (req: AuthRequest, res) => {
  const { code, subtotal } = req.body as { code?: string; subtotal?: number };

  if (!code || typeof subtotal !== "number") {
    res.status(400).json({ error: "bad_request", message: "code et subtotal requis." });
    return;
  }

  const normalized = code.trim().toUpperCase();

  try {
    const [promo] = await db
      .select()
      .from(promoCodesTable)
      .where(eq(promoCodesTable.code, normalized))
      .limit(1);

    if (!promo) {
      res.status(404).json({ error: "not_found", message: "Code promo invalide." });
      return;
    }
    if (!promo.isActive) {
      res.status(400).json({ error: "inactive", message: "Ce code promo n'est plus actif." });
      return;
    }
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      res.status(400).json({ error: "expired", message: "Ce code promo a expiré." });
      return;
    }
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      res.status(400).json({ error: "max_uses", message: "Ce code promo a atteint sa limite d'utilisation." });
      return;
    }
    if (promo.minOrderAmount !== null && subtotal < promo.minOrderAmount) {
      res.status(400).json({
        error: "min_order",
        message: `Commande minimum de ${promo.minOrderAmount.toLocaleString()} CDF requis pour ce code.`,
      });
      return;
    }

    // Calculate discount
    const discountAmount = promo.type === "fixed"
      ? Math.min(promo.value, subtotal)
      : Math.round((subtotal * promo.value) / 100);

    res.json({
      promoId: promo.id,
      code: promo.code,
      type: promo.type,
      value: promo.value,
      discountAmount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to validate promo code" });
  }
});

export default router;
