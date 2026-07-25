import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem("auth_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server error (${res.status}): unexpected response format`);
  }

  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }
  return data;
}

// AUTH
export const authApi = {
  register: (body: { email: string; password: string; name: string; phone: string; role: string; vehicleType?: string }) =>
    request<{ token: string; user: any }>("/auth/register", { method: "POST", body: JSON.stringify(body) }),

  login: (email: string, password: string) =>
    request<{ token: string; user: any }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  me: () => request<any>("/auth/me"),
};

// USERS
export const userApi = {
  me: () => request<any>("/users/me"),

  updateProfile: (body: {
    name?: string;
    phone?: string;
    address?: string;
    savedAddresses?: Array<{ label: string; address: string }>;
  }) => request<any>("/users/profile", { method: "PATCH", body: JSON.stringify(body) }),

  /**
   * Store the Expo push token on the server so it can be used for
   * server-initiated push messages in the future.
   * Call once per login after registerForPushNotificationsAsync succeeds.
   */
  savePushToken: (token: string) =>
    request<{ ok: boolean }>("/users/push-token", {
      method: "PATCH",
      body: JSON.stringify({ token }),
    }),
};

// STORES (was "restaurants" — endpoints kept at /restaurants alias server-side)
export const restaurantApi = {
  list: (params?: { category?: string; search?: string; vertical?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.search) qs.set("search", params.search);
    if (params?.vertical && params.vertical !== "restaurant") qs.set("vertical", params.vertical);
    const q = qs.toString();
    return request<any[]>(`/restaurants${q ? `?${q}` : ""}`);
  },
  get: (id: number) => request<any>(`/restaurants/${id}`),
  getMenu: (id: number) => request<any[]>(`/restaurants/${id}/menu`),
  // Paginated, searchable catalog for large grocery/retail/pharmacy stores.
  searchProducts: (
    storeId: number,
    params?: { search?: string; categoryId?: number; page?: number; pageSize?: number },
  ) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.categoryId != null) qs.set("categoryId", String(params.categoryId));
    if (params?.page != null) qs.set("page", String(params.page));
    if (params?.pageSize != null) qs.set("pageSize", String(params.pageSize));
    const q = qs.toString();
    return request<{ items: any[]; page: number; pageSize: number; total: number; hasMore: boolean }>(
      `/stores/${storeId}/products${q ? `?${q}` : ""}`,
    );
  },
  create: (body: any) =>
    request<any>("/restaurants", { method: "POST", body: JSON.stringify(body) }),
  addMenuItem: (restaurantId: number, body: any) =>
    request<any>(`/restaurants/${restaurantId}/menu`, { method: "POST", body: JSON.stringify(body) }),

  // Owner management
  mine: () => request<any>("/restaurants/mine"),
  updateMine: (body: any) =>
    request<any>("/restaurants/mine", { method: "PATCH", body: JSON.stringify(body) }),
  mineMenu: () => request<any[]>("/restaurants/mine/menu"),
  updateMenuItem: (restaurantId: number, itemId: number, body: any) =>
    request<any>(`/restaurants/${restaurantId}/menu/${itemId}`, { method: "PATCH", body: JSON.stringify(body) }),
  toggleMenuItemAvailability: (restaurantId: number, itemId: number) =>
    request<any>(`/restaurants/${restaurantId}/menu/${itemId}/availability`, { method: "PATCH" }),
  deleteMenuItem: (restaurantId: number, itemId: number) =>
    request<any>(`/restaurants/${restaurantId}/menu/${itemId}`, { method: "DELETE" }),
};

// Vertical-neutral alias; prefer `storeApi` in new code.
export const storeApi = restaurantApi;

// ANALYTICS (admin)
export const analyticsApi = {
  get: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return request<{
      from: string;
      to: string;
      totals: { totalOrders: number; totalRevenue: number; cancelledOrders: number };
      ordersPerDay: Array<{ day: string; count: number }>;
      revenuePerDay: Array<{ day: string; revenue: number }>;
      topRestaurants: Array<{ restaurantId: number; restaurantName: string; orderCount: number; revenue: number }>;
    }>(`/admin/analytics${qs ? "?" + qs : ""}`);
  },
};

// NOTIFICATIONS
export const notificationApi = {
  list: () => request<any[]>("/notifications"),
  unreadCount: () => request<{ count: number }>("/notifications/unread-count"),
  markRead: (id: number) => request<any>(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => request<{ ok: boolean }>("/notifications/read-all", { method: "PATCH" }),
};

// ── Order API types ──────────────────────────────────────────────────────────
export interface CreateOrderPayload {
  restaurantId: number;
  items: Array<{ menuItemId: number; quantity: number }>;
  deliveryAddress: string;
  paymentMethod: "cash" | "mobile_money";
  paymentProvider?: string;
  paymentReference?: string;
  paymentPhone?: string;
  notes?: string;
  driverInstructions?: string;
  promoCode?: string;
}

// PROMO CODES
export interface PromoValidateResult {
  promoId: number;
  code: string;
  type: "fixed" | "percent";
  value: number;
  discountAmount: number;
}

export const promoApi = {
  validate: (code: string, subtotal: number) =>
    request<PromoValidateResult>("/promo-codes/validate", {
      method: "POST",
      body: JSON.stringify({ code, subtotal }),
    }),
  // Admin
  list: () => request<any[]>("/admin/promo-codes"),
  create: (payload: {
    code: string;
    type: "fixed" | "percent";
    value: number;
    minOrderAmount?: number;
    maxUses?: number;
    expiresAt?: string;
  }) => request<any>("/admin/promo-codes", { method: "POST", body: JSON.stringify(payload) }),
  toggle: (id: number) => request<any>(`/admin/promo-codes/${id}/toggle`, { method: "PATCH" }),
  remove: (id: number) => request<any>(`/admin/promo-codes/${id}`, { method: "DELETE" }),
};

// EARNINGS (driver)
export const earningsApi = {
  summary: (period: "today" | "week" | "all" = "all") =>
    request<any>(`/earnings?period=${period}`),
  settlements: () => request<any[]>("/earnings/settlements"),
  confirmCash: (orderId: number) =>
    request<any>(`/orders/${orderId}/confirm-cash`, { method: "PATCH" }),
};

// ADMIN EARNINGS
export const adminEarningsApi = {
  drivers: () => request<any[]>("/earnings/admin/drivers"),
  driverDetail: (driverId: number) => request<any>(`/earnings/admin/drivers/${driverId}`),
  settle: (driverId: number, cashAmount: number, note?: string) =>
    request<any>(`/earnings/admin/drivers/${driverId}/settle`, {
      method: "POST",
      body: JSON.stringify({ cashAmount, note }),
    }),
};

// ADMIN
export const adminApi = {
  stats: () => request<any>("/admin/stats"),

  orders: (status?: string) =>
    request<any[]>(`/admin/orders${status && status !== "all" ? `?status=${status}` : ""}`),

  restaurants: (search?: string) =>
    request<any[]>(`/admin/restaurants${search ? `?search=${encodeURIComponent(search)}` : ""}`),

  toggleRestaurant: (id: number) =>
    request<any>(`/admin/restaurants/${id}/toggle`, { method: "PATCH" }),

  users: (role?: string, search?: string) => {
    const params = new URLSearchParams();
    if (role && role !== "all") params.set("role", role);
    if (search) params.set("search", search);
    const qs = params.toString();
    return request<any[]>(`/admin/users${qs ? `?${qs}` : ""}`);
  },

  toggleUser: (id: number) =>
    request<any>(`/admin/users/${id}/toggle`, { method: "PATCH" }),

  drivers: (status?: string) => {
    const qs = status && status !== "all" ? `?status=${status}` : "";
    return request<any[]>(`/admin/drivers${qs}`);
  },

  approveDriver: (id: number) =>
    request<any>(`/admin/drivers/${id}/approve`, { method: "PATCH" }),

  rejectDriver: (id: number) =>
    request<any>(`/admin/drivers/${id}/reject`, { method: "PATCH" }),

  payments: (paymentStatus?: string) => {
    const qs = paymentStatus && paymentStatus !== "all" ? `?paymentStatus=${paymentStatus}` : "";
    return request<any[]>(`/admin/payments${qs}`);
  },

  reviewPayment: (id: number, action: "confirmed" | "failed") =>
    request<any>(`/admin/payments/${id}`, { method: "PATCH", body: JSON.stringify({ action }) }),
};

// ORDERS
export const orderApi = {
  list: () => request<any[]>("/orders"),
  get: (id: number) => request<any>(`/orders/${id}`),
  create: (body: CreateOrderPayload) =>
    request<any>("/orders", { method: "POST", body: JSON.stringify(body) }),

  /** Customer submits their mobile money transaction reference for admin review */
  submitPaymentReference: (orderId: number, payload: { reference: string; phone?: string }) =>
    request<any>(`/orders/${orderId}/payment`, { method: "PATCH", body: JSON.stringify(payload) }),

  updateStatus: (id: number, status: string) =>
    request<any>(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  acceptOrder: (id: number) =>
    request<any>(`/orders/${id}/accept`, { method: "POST" }),
  availableForDriver: () => request<any[]>("/orders/available"),
  myDriverOrders: () => request<any[]>("/orders/my-orders"),

  /** Shopper (store owner or assigned driver) records grocery picking results. */
  pick: (
    id: number,
    items: Array<{ menuItemId: number; lineStatus: "found" | "out_of_stock" | "substituted" | "weight_adjusted"; substituteName?: string; finalPrice?: number }>,
  ) => request<any>(`/orders/${id}/pick`, { method: "PATCH", body: JSON.stringify({ items }) }),

  /** Customer approves/rejects proposed substitutions. */
  approveSubstitutions: (id: number, decisions: Array<{ menuItemId: number; approved: boolean }>) =>
    request<any>(`/orders/${id}/approve-substitutions`, { method: "PATCH", body: JSON.stringify({ decisions }) }),
};

// REVIEWS
export const reviewApi = {
  submit: (body: { orderId: number; restaurantRating: number; driverRating?: number; comment?: string }) =>
    request<any>("/reviews", { method: "POST", body: JSON.stringify(body) }),
  check: (orderId: number) =>
    request<{ reviewed: boolean; review: any | null }>(`/reviews/check/${orderId}`),
};
