import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

export const DEFAULT_USD_RATE = 2850; // CDF per 1 USD — fallback until an admin sets it

async function getUsdRate(): Promise<number> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "usd_rate")).limit(1);
  const n = row ? Number(row.value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_RATE;
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
