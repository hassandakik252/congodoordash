import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { kycDocumentsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { notifyAdmins } from "../lib/notify";
import { z } from "zod";

const router: IRouter = Router();

const submitSchema = z.object({
  type: z.enum([
    "id_card", "selfie", "driving_license",
    "business_registration", "business_license", "proof_of_address", "other",
  ]),
  imageUrl: z.string().url(),
});

// GET /kyc/documents — the caller's own submitted documents.
router.get("/documents", requireAuth, async (req: AuthRequest, res) => {
  const docs = await db
    .select()
    .from(kycDocumentsTable)
    .where(eq(kycDocumentsTable.userId, req.user!.id))
    .orderBy(desc(kycDocumentsTable.createdAt));
  res.json(docs);
});

// POST /kyc/documents — submit a verification document (image already uploaded).
router.post("/documents", requireAuth, async (req: AuthRequest, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const [doc] = await db
    .insert(kycDocumentsTable)
    .values({ userId: req.user!.id, type: parsed.data.type, imageUrl: parsed.data.imageUrl })
    .returning();

  notifyAdmins({
    type: "driver_application",
    title: "Nouveau document KYC",
    body: `${req.user!.name} a soumis un document (${parsed.data.type}) à vérifier.`,
  }).catch((err) => console.error("[kyc] notify admins failed", err));

  res.status(201).json(doc);
});

export default router;
