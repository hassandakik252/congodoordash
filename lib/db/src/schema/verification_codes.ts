import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const verifyChannelEnum = pgEnum("verify_channel", ["email", "phone"]);

/** Short-lived OTP codes for email/phone verification. */
export const verificationCodesTable = pgTable("verification_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  channel: verifyChannelEnum("channel").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: timestamp("consumed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type VerificationCode = typeof verificationCodesTable.$inferSelect;
