import { logger } from "./logger";

/**
 * Optional error monitoring. If SENTRY_DSN is set AND @sentry/node is installed,
 * errors are reported to Sentry; otherwise this is a no-op that just logs. This
 * keeps Sentry an opt-in add-on with no hard dependency.
 *
 * To enable: `pnpm --filter @workspace/api-server add @sentry/node` and set
 * SENTRY_DSN in the environment.
 */
let capture: ((err: unknown) => void) | null = null;

export async function initMonitoring(): Promise<void> {
  const dsn = process.env["SENTRY_DSN"];
  if (!dsn) return;
  try {
    // Dynamic import so the package is only required when actually used.
    const Sentry = await import(/* @vite-ignore */ "@sentry/node" as string).catch(() => null);
    if (!Sentry?.init) {
      logger.warn("[monitoring] SENTRY_DSN set but @sentry/node is not installed");
      return;
    }
    Sentry.init({ dsn, environment: process.env["NODE_ENV"] ?? "production" });
    capture = (err: unknown) => Sentry.captureException(err);
    logger.info("[monitoring] Sentry initialised");
  } catch (err) {
    logger.warn({ err }, "[monitoring] Sentry init failed");
  }
}

export function captureException(err: unknown): void {
  if (capture) {
    try { capture(err); } catch { /* never throw from monitoring */ }
  }
}
