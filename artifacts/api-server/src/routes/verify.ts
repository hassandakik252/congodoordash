import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, verificationCodesTable } from "@workspace/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import crypto from "node:crypto";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { sendEmail, sendSms, messagingIsConsole } from "../lib/messaging";
import { rateLimit } from "../middlewares/rateLimit";
import { z } from "zod";

const router: IRouter = Router();

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const sendLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5, message: "Trop de demandes de code. Réessayez plus tard." });

const channelSchema = z.object({ channel: z.enum(["email", "phone"]) });
const confirmSchema = z.object({ channel: z.enum(["email", "phone"]), code: z.string().min(4).max(8) });

// POST /verify/send — generate + deliver a 6-digit code to the caller's email/phone.
router.post("/send", requireAuth, sendLimiter, async (req: AuthRequest, res) => {
  const parsed = channelSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "validation_error", message: parsed.error.message }); return; }
  const user = req.user!;
  const { channel } = parsed.data;

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(verificationCodesTable).values({
    userId: user.id, channel, code, expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  const msg = `Votre code de vérification Deliver LBH est : ${code}`;
  try {
    if (channel === "email") await sendEmail(user.email, "Code de vérification", msg);
    else await sendSms(user.phone, msg);
  } catch (err) {
    console.error("[verify] send failed", err);
    res.status(502).json({ error: "send_failed", message: "Impossible d'envoyer le code. Réessayez." });
    return;
  }

  // In console (dev) mode there is no real delivery, so surface the code so the
  // flow is testable. Never returned once a real provider is configured.
  res.status(202).json({ ok: true, ...(messagingIsConsole ? { devCode: code } : {}) });
});

// POST /verify/confirm — validate a code and mark the channel verified.
router.post("/confirm", requireAuth, async (req: AuthRequest, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "validation_error", message: parsed.error.message }); return; }
  const user = req.user!;
  const { channel, code } = parsed.data;

  const [row] = await db
    .select()
    .from(verificationCodesTable)
    .where(and(
      eq(verificationCodesTable.userId, user.id),
      eq(verificationCodesTable.channel, channel),
      isNull(verificationCodesTable.consumedAt),
    ))
    .orderBy(desc(verificationCodesTable.createdAt))
    .limit(1);

  if (!row || row.code !== code || row.expiresAt < new Date()) {
    res.status(400).json({ error: "invalid_code", message: "Code invalide ou expiré." });
    return;
  }

  await db.update(verificationCodesTable).set({ consumedAt: new Date() }).where(eq(verificationCodesTable.id, row.id));
  await db.update(usersTable)
    .set(channel === "email" ? { emailVerifiedAt: new Date() } : { phoneVerifiedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  res.json({ ok: true, channel, verified: true });
});

export default router;
