import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

export const DEFAULT_USD_RATE = 2850; // CDF per 1 USD — fallback until an admin sets it
export const DEFAULT_COMMISSION_PCT = 15; // platform commission on merchandise

async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return row?.value ?? null;
}

async function getUsdRate(): Promise<number> {
  const n = Number(await getSetting("usd_rate"));
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_RATE;
}

export async function getCommissionPct(): Promise<number> {
  const n = Number(await getSetting("commission_pct"));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : DEFAULT_COMMISSION_PCT;
}

// GET /settings/public — currency config the app needs (no auth).
router.get("/public", async (_req, res) => {
  res.json({
    baseCurrency: "CDF",
    currencies: ["CDF", "USD"],
    usdRate: await getUsdRate(), // CDF per 1 USD
  });
});

export { getUsdRate };
export default router;
