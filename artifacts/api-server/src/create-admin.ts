import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

/**
 * Creates (or resets the password of) the super-admin account.
 *
 * The `/api/admin/*` routes require role "admin", but registration only allows
 * customer/restaurant_owner/driver — so an admin can never be created through
 * the API. Run this script once after seeding:
 *
 *   pnpm --filter @workspace/api-server exec tsx src/create-admin.ts
 *
 * Credentials come from env (see .env.example):
 *   ADMIN_EMAIL     (default: admin@deliverlbh.com)
 *   ADMIN_PASSWORD  (required — the script refuses to use a default)
 */
async function createAdmin() {
  const email = process.env.ADMIN_EMAIL ?? "admin@deliverlbh.com";
  const password = process.env.ADMIN_PASSWORD;

  if (!password || password.length < 8) {
    throw new Error(
      "ADMIN_PASSWORD must be set to at least 8 characters. Refusing to create an admin with a weak/default password.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(usersTable)
      .set({ passwordHash, role: "admin", isActive: true })
      .where(eq(usersTable.id, existing.id));
    console.log(`Updated existing user to admin + reset password: ${email}`);
    return;
  }

  await db.insert(usersTable).values({
    email,
    passwordHash,
    name: "Super Admin",
    phone: "+243000000000",
    role: "admin",
    isActive: true,
  });
  console.log(`Created super-admin: ${email}`);
}

createAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[create-admin] Failed:", err);
    process.exit(1);
  });
