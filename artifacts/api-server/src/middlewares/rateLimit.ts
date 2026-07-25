import { Request, Response, NextFunction } from "express";

/**
 * Tiny in-memory fixed-window rate limiter. Sufficient for a single-instance
 * pilot deployment (no external store). Keyed by client IP. For a multi-instance
 * setup, swap the Map for Redis.
 */
export function rateLimit(opts: { windowMs: number; max: number; message?: string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Opportunistic cleanup so the map doesn't grow unbounded.
  setInterval(() => {
    const now = Date.now();
    for (const [key, v] of hits) if (v.resetAt <= now) hits.delete(key);
  }, opts.windowMs).unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + opts.windowMs });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > opts.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: "too_many_requests",
        message: opts.message ?? "Too many requests. Please try again later.",
      });
      return;
    }
    next();
  };
}
