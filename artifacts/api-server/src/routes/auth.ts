import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { notifyAdmins } from "../lib/notify";
import { rateLimit } from "../middlewares/rateLimit";

const router = Router();

// Throttle credential endpoints against brute-force: 10 attempts / 15 min / IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Trop de tentatives. Réessayez dans quelques minutes.",
});
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set. Server cannot start without it.");
}
const JWT_SECRET = process.env.JWT_SECRET;

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  phone: z.string().min(1),
  role: z.enum(["customer", "restaurant_owner", "driver"]),
  vehicleType: z.string().optional(),
  acceptTerms: z.literal(true, { message: "You must accept the Terms & Privacy Policy" }),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function makeToken(userId: number, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "30d" });
}

function sanitizeUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

router.post("/register", authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { email, password, name, phone, role, vehicleType } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "email_exists", message: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  type NewUser = typeof usersTable.$inferInsert;
  const insertValues: NewUser = { email, passwordHash, name, phone, role, termsAcceptedAt: new Date() };
  if (role === "driver") {
    insertValues.driverStatus = "pending";
    insertValues.vehicleType = vehicleType ?? null;
  }
  if (role === "restaurant_owner") {
    insertValues.merchantStatus = "pending";
  }

  const [user] = await db.insert(usersTable).values(insertValues).returning();

  // Notify all admins about new driver applications
  if (role === "driver") {
    notifyAdmins({
      type: "driver_application",
      title: "Nouvelle candidature livreur",
      body: `${name} a soumis une demande d'inscription comme livreur.`,
    }).catch(err => console.error("[notify] Failed to notify admins of driver application", err));
  }

  const token = makeToken(user.id, user.role);
  res.status(201).json({ token, user: sanitizeUser(user) });
});

router.post("/login", authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

  if (!user) {
    res.status(401).json({ error: "invalid_credentials", message: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "invalid_credentials", message: "Invalid email or password" });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "account_disabled", message: "Your account has been deactivated. Contact support." });
    return;
  }

  if (user.role === "driver" && user.driverStatus !== "approved") {
    const msg = user.driverStatus === "pending"
      ? "Your driver application is pending review. You will be notified once approved."
      : "Your driver application has been rejected. Contact support for more information.";
    res.status(403).json({ error: "driver_not_approved", message: msg });
    return;
  }

  // Store owners are NOT blocked at login — a pending merchant signs in to set
  // up their store and upload KYC. Their store stays hidden from customers
  // until an admin approves them (enforced in the store list).

  const token = makeToken(user.id, user.role);
  res.json({ token, user: sanitizeUser(user) });
});

router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized", message: "No token provided" });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);

    if (!user) {
      res.status(401).json({ error: "unauthorized", message: "User not found" });
      return;
    }

    res.json(sanitizeUser(user));
  } catch {
    res.status(401).json({ error: "unauthorized", message: "Invalid token" });
  }
});

export default router;
