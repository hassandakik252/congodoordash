import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set.");
}
const JWT_SECRET = process.env.JWT_SECRET;

export interface AuthRequest extends Request {
  user?: typeof usersTable.$inferSelect;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
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

    if (!user.isActive) {
      res.status(403).json({ error: "account_disabled", message: "Account deactivated" });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "unauthorized", message: "Invalid token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "forbidden", message: "Insufficient permissions" });
      return;
    }
    next();
  };
}
