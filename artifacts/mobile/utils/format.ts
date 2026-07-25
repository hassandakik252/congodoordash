// ── Currency ─────────────────────────────────────────────────────────────────
// All amounts are stored in CDF (base). The display currency + USD rate are set
// at runtime by CurrencyContext, so every existing formatCurrency() call becomes
// currency-aware without changing call sites.
export type Currency = "CDF" | "USD";
let _currency: Currency = "CDF";
let _usdRate = 2850; // CDF per 1 USD (overridden from the server)

export function setCurrencyConfig(currency: Currency, usdRate: number) {
  _currency = currency;
  if (Number.isFinite(usdRate) && usdRate > 0) _usdRate = usdRate;
}

export function formatCurrency(amountCDF: number): string {
  if (_currency === "USD") {
    const usd = (Number(amountCDF) || 0) / _usdRate;
    return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${Math.round(Number(amountCDF) || 0).toLocaleString()} CDF`;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("fr-CD", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getGreeting(lang: "en" | "fr"): string {
  const hour = new Date().getHours();
  if (lang === "fr") {
    if (hour < 12) return "Bonjour";
    if (hour < 18) return "Bon après-midi";
    return "Bonsoir";
  }
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// Store verticals shown in the home switcher. `id` matches the server `vertical`
// enum; "restaurant" is the default landing vertical.
export const VERTICALS = [
  { id: "restaurant", label: "Food", labelFr: "Restos", icon: "restaurant" },
  { id: "grocery", label: "Grocery", labelFr: "Épicerie", icon: "basket" },
  { id: "pharmacy", label: "Pharmacy", labelFr: "Pharmacie", icon: "medkit" },
  { id: "retail", label: "Shops", labelFr: "Boutiques", icon: "bag-handle" },
  { id: "drinks", label: "Drinks", labelFr: "Boissons", icon: "beer" },
];

// Short unit suffix for a product price, e.g. "/ kg". Restaurants sell "each"
// (no suffix). Grocery/retail may sell by weight or pack.
export function unitSuffix(unit?: string, lang: "en" | "fr" = "fr"): string {
  if (!unit || unit === "each") return "";
  const map: Record<string, string> = { kg: "kg", g: "g", L: "L", pack: lang === "fr" ? "paquet" : "pack" };
  return ` / ${map[unit] ?? unit}`;
}

export const RESTAURANT_CATEGORIES = [
  { id: "all", label: "All", labelFr: "Tout", icon: "grid" },
  { id: "Congolais", label: "Congolese", labelFr: "Congolais", icon: "flame" },
  { id: "Poulet", label: "Chicken", labelFr: "Poulet", icon: "restaurant" },
  { id: "Pizza", label: "Pizza", labelFr: "Pizza", icon: "pizza" },
  { id: "Chinois", label: "Chinese", labelFr: "Chinois", icon: "restaurant" },
  { id: "Fast Food", label: "Fast Food", labelFr: "Fast Food", icon: "fast-food" },
  { id: "Boissons", label: "Drinks", labelFr: "Boissons", icon: "beer" },
];

export function getOrderStatusColor(status: string): string {
  switch (status) {
    case "pending": return "#FF9F0A";
    case "confirmed": return "#30B0C7";
    case "preparing": return "#FF6B35";
    case "ready_for_pickup": return "#34C759";
    case "picked_up": return "#007AFF";
    case "delivered": return "#34C759";
    case "cancelled": return "#FF3B30";
    default: return "#636366";
  }
}
