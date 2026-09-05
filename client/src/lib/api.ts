const BASE = "/api";

function getToken() {
  return localStorage.getItem("wafra_token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      isJson && data && typeof data === "object" && "message" in data
        ? (data as any).message
        : `API error ${res.status} on ${BASE}${path}`;
    throw new Error(message);
  }

  if (!isJson) {
    throw new Error(`Expected JSON but received HTML/text from ${BASE}${path}. Check that this API route exists in server/routes.ts`);
  }

  return data as T;
}

export const api = {
  auth: {
    register: (body: unknown) => request<{ token: string; user: any }>("POST", "/auth/register", body),
    login: (body: unknown) => request<{ token: string; user: any }>("POST", "/auth/login", body),
    me: () => request<any>("GET", "/auth/me"),
    updateProfile: (body: unknown) => request<any>("PUT", "/auth/profile", body),
  },
  offers: {
    getPaginated: (page = 1, limit = 20) => request<{ offers: any[]; total: number; page: number; limit: number; totalPages: number }>("GET", `/offers?page=${page}&limit=${limit}`),
    getAll: async () => {
      const res = await request<{ offers: any[]; total: number }>("GET", "/offers?limit=100");
      return (res as any).offers ?? res;
    },
    getMy: () => request<any[]>("GET", "/offers/my"),
    create: (body: unknown) => request<any>("POST", "/offers", body),
    update: (id: number, body: unknown) => request<any>("PUT", `/offers/${id}`, body),
    delete: (id: number) => request<any>("DELETE", `/offers/${id}`),
  },
  requests: {
    getMy: () => request<any[]>("GET", "/requests"),
    create: (body: unknown) => request<any>("POST", "/requests", body),
    // Step 1 (charity): Accept offer → creates delivery for drivers
    acceptByCharity: (id: number) => request<any>("POST", `/requests/${id}/accept-by-charity`, {}),
    // Final step (charity): Confirm receipt after driver arrives
    confirmReceipt: (id: number) => request<any>("POST", `/requests/${id}/confirm`, {}),
    // Legacy alias
    confirm: (id: number) => request<any>("POST", `/requests/${id}/accept-by-charity`, {}),
    cancel: (id: number) => request<any>("PUT", `/requests/${id}/cancel`, {}),
  },
  notifications: {
    getAll: () => request<any[]>("GET", "/notifications"),
    getUnreadCount: () => request<{ count: number }>("GET", "/notifications/unread-count"),
    markRead: (id: number) => request<any>("PUT", `/notifications/${id}/read`, {}),
    markAllRead: () => request<any>("PUT", "/notifications/read-all", {}),
  },
  ratings: {
    // Multi-actor: any role can rate any counterpart after completion
    create: (body: { requestId?: number | null; deliveryId?: number | null; toType: "restaurant" | "charity" | "delivery"; rating: number; comment?: string }) =>
      request<any>("POST", "/ratings", body),
    // Ratings received by a specific user
    getByRequest: (requestId: number) => request<any[]>("GET", `/ratings/request/${requestId}`),
    getByRestaurant: (restaurantId: number) => request<any>("GET", `/ratings/restaurant/${restaurantId}`),
    getByUser: (userId: number, type?: string) => request<any>("GET", `/ratings/user/${userId}${type ? `?type=${type}` : ""}`),
    // Ratings already submitted by the currently logged-in user.
    // Used by UI buttons to show "Rated" and prevent duplicate rating attempts.
    getGiven: () => request<any>("GET", "/ratings/given"),
    getGivenByMe: () => request<any>("GET", "/ratings/given"),
    given: () => request<any>("GET", "/ratings/given"),
  },
  contact: {
    send: (body: unknown) => request<any>("POST", "/contact", body),
  },
  baskets: {
    getAll: () => request<any[]>("GET", "/baskets"),
    getMy: () => request<any[]>("GET", "/baskets/my"),
    getById: (id: number) => request<any>("GET", `/baskets/${id}`),
    create: (body: unknown) => request<any>("POST", "/baskets", body),
    cancel: (id: number) => request<any>("PUT", `/baskets/${id}/cancel`, {}),
    contribute: (id: number, body: unknown) => request<any>("POST", `/baskets/${id}/contribute`, body),
    getContributions: (id: number) => request<any[]>("GET", `/baskets/${id}/contributions`),
    getMyContributions: () => request<any[]>("GET", "/baskets/my-contributions"),
  },
  deliveries: {
    getAll: () => request<any[]>("GET", "/deliveries"),
    getMy: () => request<any[]>("GET", "/deliveries/my"),
    getStats: () => request<any>("GET", "/deliveries/stats"),
    // Step 1: Driver accepts
    accept: (id: number) => request<any>("PUT", `/deliveries/${id}/accept`, {}),
    // Step 2: Driver going to restaurant
    goToRestaurant: (id: number) => request<any>("POST", `/deliveries/${id}/go-to-restaurant`, {}),
    // Step 3: Driver picks up food
    confirmPickup: (id: number) => request<any>("POST", `/deliveries/${id}/pickup`, {}),
    // Step 4: Driver heading to charity
    goToCharity: (id: number) => request<any>("POST", `/deliveries/${id}/go-to-charity`, {}),
    // Step 5: Driver arrives at charity (WAITING STATE — charity must confirm first)
    arrive: (id: number) => request<any>("POST", `/deliveries/${id}/arrive`, {}),
    // Step 6 (charity): Charity confirms receipt → driver is unblocked
    charityConfirmReceipt: (id: number) => request<any>("POST", `/deliveries/${id}/confirm-receipt`, {}),
    // Step 7 (driver): Driver confirms delivery — ONLY after charity confirmed
    driverConfirm: (id: number) => request<any>("POST", `/deliveries/${id}/confirm`, {}),
    // Step 3b (restaurant): Restaurant confirms handoff to driver
    restaurantConfirm: (id: number) => request<any>("PUT", `/deliveries/${id}/restaurant-confirm`, {}),
    // Restaurant-side: get deliveries pending restaurant confirmation
    getRestaurantPending: () => request<any[]>("GET", "/deliveries/restaurant-pending"),
    // Restaurant-side: all deliveries related to this restaurant
    getRestaurantDeliveries: () => request<any[]>("GET", "/deliveries/restaurant"),
    // Charity-side
    getCharityDeliveries: () => request<any[]>("GET", "/deliveries/charity"),
    // Legacy basket-based confirm
    confirmReceipt: (id: number) => request<any>("PUT", `/deliveries/${id}/confirm-receipt`, {}),
  },
  admin: {
    users: () => request<any[]>("GET", "/admin/users"),
    setUserStatus: (id: number, isActive: boolean) => request<any>("PUT", `/admin/users/${id}/status`, { isActive }),
    offers: () => request<any[]>("GET", "/admin/offers"),
    requests: () => request<any[]>("GET", "/admin/requests"),
    stats: () => request<any>("GET", "/admin/stats"),
    logs: () => request<any[]>("GET", "/admin/logs"),
    messages: () => request<any[]>("GET", "/admin/messages"),
    markMessageRead: (id: number) => request<any>("PUT", `/admin/messages/${id}/read`, {}),
    deliveries: () => request<any[]>("GET", "/admin/deliveries"),
    baskets: () => request<any[]>("GET", "/admin/baskets"),
    mostActive: () => request<any>("GET", "/admin/most-active"),
  },
};