/**
 * Order line pricing, accounting for grocery picking outcomes. Extracted so the
 * substitution/weight recomputation can be unit-tested without a database.
 */
export interface PricedLine {
  price: number;
  quantity: number;
  lineStatus?: "pending" | "found" | "out_of_stock" | "substituted" | "weight_adjusted";
  finalPrice?: number;
  approved?: boolean | null;
}

/** Charged amount for one order line. */
export function lineTotal(item: PricedLine): number {
  switch (item.lineStatus) {
    case "out_of_stock":
      return 0;
    case "substituted":
      // A rejected substitution is dropped; otherwise use the substitute price.
      if (item.approved === false) return 0;
      return item.finalPrice ?? item.price * item.quantity;
    case "weight_adjusted":
      return item.finalPrice ?? item.price * item.quantity;
    default: // found | pending | undefined
      return item.price * item.quantity;
  }
}

/** Recompute subtotal/total from (possibly picked) items. */
export function recomputeTotals(items: PricedLine[], deliveryFee: number, discountAmount: number) {
  const subtotal = items.reduce((s, i) => s + lineTotal(i), 0);
  const total = Math.max(0, subtotal + deliveryFee - discountAmount);
  return { subtotal, total };
}
