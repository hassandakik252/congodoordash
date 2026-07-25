export function formatCurrency(amount: number): string {
  return `${Math.round(amount).toLocaleString()} CDF`;
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
