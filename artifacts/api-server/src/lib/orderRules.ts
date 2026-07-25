/**
 * Pure order business rules — no DB, no I/O — so they can be unit-tested.
 */

// ── Status transitions ───────────────────────────────────────────────────────
export const validTransitions: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready_for_pickup", "cancelled"],
  ready_for_pickup: ["cancelled"], // driver claim handled via POST /accept
  picked_up: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function isValidTransition(from: string, to: string): boolean {
  return (validTransitions[from] ?? []).includes(to);
}

// ── Driver claimability ──────────────────────────────────────────────────────
/**
 * Whether a driver may claim an order now. Restaurants: only when the kitchen
 * is done (ready_for_pickup). Other verticals (driver also shops): claimable
 * earlier, at confirmed/preparing.
 */
export function isClaimable(vertical: string | null | undefined, status: string): boolean {
  if (status === "ready_for_pickup") return true;
  const shops = vertical !== "restaurant"; // grocery/retail/pharmacy/drinks (or unknown)
  return shops && (status === "confirmed" || status === "preparing");
}

// ── Promo codes ──────────────────────────────────────────────────────────────
export interface PromoLike {
  type: "fixed" | "percent";
  value: number;
  isActive: boolean;
  expiresAt?: string | Date | null;
  maxUses?: number | null;
  usedCount?: number | null;
  minOrderAmount?: number | null;
}

/**
 * Discount (in CDF) a promo yields for a given subtotal, or 0 if it doesn't
 * apply (inactive, expired, used up, or under the minimum). Fixed discounts are
 * capped at the subtotal; percent discounts are rounded.
 */
export function promoDiscount(promo: PromoLike, subtotal: number, now: Date = new Date()): number {
  if (!promo.isActive) return 0;
  if (promo.expiresAt && new Date(promo.expiresAt) < now) return 0;
  if (promo.maxUses != null && (promo.usedCount ?? 0) >= promo.maxUses) return 0;
  if (promo.minOrderAmount != null && subtotal < promo.minOrderAmount) return 0;
  return promo.type === "fixed"
    ? Math.min(promo.value, subtotal)
    : Math.round((subtotal * promo.value) / 100);
}
