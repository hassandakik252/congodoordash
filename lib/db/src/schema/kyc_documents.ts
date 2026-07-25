import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * KYC / verification documents uploaded by drivers and store owners, reviewed by
 * admins. Drivers submit identity only (the company owns the vehicles, so no
 * vehicle papers). Merchants submit business + identity documents. Images are
 * stored via the file-storage layer; only the URL is kept here.
 */
export const kycDocTypeEnum = pgEnum("kyc_doc_type", [
  "id_card",              // national ID / passport
  "selfie",               // liveness / face match
  "driving_license",      // optional, for drivers
  "business_registration",// merchant: RCCM / registration
  "business_license",     // merchant: operating licence
  "proof_of_address",
  "other",
]);

export const kycStatusEnum = pgEnum("kyc_status", ["pending", "approved", "rejected"]);

export const kycDocumentsTable = pgTable("kyc_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  type: kycDocTypeEnum("type").notNull(),
  imageUrl: text("image_url").notNull(),
  status: kycStatusEnum("status").notNull().default("pending"),
  note: text("note"),                    // reviewer note (e.g. rejection reason)
  reviewedBy: integer("reviewed_by"),    // admin user id
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertKycDocumentSchema = createInsertSchema(kycDocumentsTable).omit({ id: true, createdAt: true });
export type InsertKycDocument = z.infer<typeof insertKycDocumentSchema>;
export type KycDocument = typeof kycDocumentsTable.$inferSelect;
