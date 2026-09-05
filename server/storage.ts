import { db } from "./db";
import { eq, desc, count, avg, isNull, lte, lt, gt, and, ne, or, inArray, sql, aliasedTable } from "drizzle-orm";
import {
  users, foodOffers, requests, activityLogs, notifications, ratings, contactMessages,
  baskets, basketItems, basketContributions, deliveries,
  type User, type InsertUser, type FoodOffer, type InsertFoodOffer,
  type Request, type InsertRequest, type ActivityLog,
  type Notification, type Rating, type ContactMessage,
  type Basket, type BasketItem, type BasketContribution, type Delivery,
} from "@shared/schema";

export interface IStorage {
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserStatus(id: number, isActive: boolean): Promise<User>;
  updateUser(id: number, data: Partial<Pick<User, "name" | "phone" | "address">>): Promise<User>;

  createOffer(restaurantId: number, offer: InsertFoodOffer): Promise<FoodOffer>;
  getOfferById(id: number): Promise<FoodOffer | undefined>;
  getAllAvailableOffers(page: number, limit: number): Promise<{ offers: (FoodOffer & { restaurant: User; avgRating?: number })[]; total: number }>;
  getOffersByRestaurant(restaurantId: number): Promise<FoodOffer[]>;
  updateOffer(id: number, data: Partial<InsertFoodOffer>): Promise<FoodOffer>;
  updateOfferStatus(id: number, status: FoodOffer["status"]): Promise<FoodOffer>;
  deleteOffer(id: number): Promise<void>;
  expireStaleOffers(): Promise<number>;
  getAllOffers(): Promise<(FoodOffer & { restaurant: User })[]>;

  createRequest(charityId: number, req: InsertRequest): Promise<Request>;
  getRequestById(id: number): Promise<Request | undefined>;
  getRequestsByCharity(charityId: number): Promise<(Request & { offer: FoodOffer & { restaurant: User } })[]>;
  getRequestsByOffer(offerId: number): Promise<(Request & { charity: User })[]>;
  updateRequestStatus(id: number, status: Request["status"], confirmedAt?: Date): Promise<Request>;
  // Strict-workflow transitions
  acceptOfferByCharityAtomic(requestId: number, charityId: number): Promise<{ request: Request; delivery: Delivery } | null>;
  confirmRequestByCharityAtomic(requestId: number, charityId: number): Promise<{ request: Request; delivery: Delivery } | null>;

  log(userId: number | null, action: string, resource: string, resourceId?: number, details?: string): Promise<void>;
  getActivityLogs(): Promise<any[]>;
  getStats(): Promise<{ totalUsers: number; totalOffers: number; totalRequests: number; completedTransfers: number; totalBaskets: number; completedBaskets: number }>;
  getAllBasketsAdmin(): Promise<any[]>;
  getAdminMostActive(): Promise<any>;

  createNotification(userId: number, type: string, title: string, body: string, link?: string, messageKey?: string, messageParams?: Record<string, string | number>): Promise<Notification>;
  getNotifications(userId: number): Promise<Notification[]>;
  markNotificationRead(id: number, userId: number): Promise<void>;
  markAllNotificationsRead(userId: number): Promise<void>;
  getUnreadCount(userId: number): Promise<number>;

  // Multi-actor rating system
  createMultiRating(fromId: number, fromType: "restaurant" | "charity" | "delivery", data: { requestId?: number | null; deliveryId?: number | null; toType: "restaurant" | "charity" | "delivery"; toId: number; rating: number; comment?: string }): Promise<Rating>;
  getRatingsByRequest(requestId: number): Promise<Rating[]>;
  getRatingsForUser(toId: number, toType?: string): Promise<any[]>;
  getRatingsGivenByUser(fromId: number, fromType?: string): Promise<any[]>;
  getAvgRatingForUser(toId: number, toType?: string): Promise<number>;
  hasRated(requestId: number, fromId: number, fromType: string, toId: number, toType: string): Promise<boolean>;
  hasRatedFlexible(data: { requestId?: number | null; deliveryId?: number | null; fromId: number; fromType: string; toId: number; toType: string }): Promise<boolean>;
  // Legacy compat
  createRating(charityId: number, data: { requestId: number; restaurantId: number; stars: number; comment?: string }): Promise<Rating>;
  getRatingByRequest(requestId: number): Promise<Rating | undefined>;
  getRestaurantRatings(restaurantId: number): Promise<any[]>;
  getRestaurantAvgRating(restaurantId: number): Promise<number>;

  createContactMessage(data: { name: string; email: string; subject: string; message: string }): Promise<ContactMessage>;
  getContactMessages(): Promise<ContactMessage[]>;
  markMessageRead(id: number): Promise<void>;
  getUnreadMessagesCount(): Promise<number>;

  // Delivery strict-workflow transitions
  createDelivery(data: Pick<Delivery, "requestId" | "charityId" | "restaurantId" | "pickupAddress" | "dropoffAddress"> & { basketId?: number | null }): Promise<Delivery>;
  getDeliveryById(id: number): Promise<Delivery | undefined>;
  getAvailableDeliveries(): Promise<Delivery[]>;
  getDeliveriesByDriver(driverId: number): Promise<Delivery[]>;
  getAllDeliveries(): Promise<Delivery[]>;
  getDriverStats(driverId: number): Promise<{ total: number; completed: number; active: number; cancelled: number }>;
  updateDelivery(id: number, data: Partial<Delivery>): Promise<Delivery>;
  acceptDeliveryIfAvailable(id: number, driverId: number): Promise<Delivery | null>;
  goToRestaurantAtomic(id: number, driverId: number): Promise<Delivery | null>;
  deliveryPickupAtomic(id: number, driverId: number): Promise<Delivery | null>;
  restaurantConfirmPickupAtomic(id: number, restaurantId: number): Promise<Delivery | null>;
  getDeliveriesPendingRestaurantConfirm(restaurantId: number): Promise<any[]>;
  getDeliveriesByRestaurant(restaurantId: number): Promise<any[]>;
  goToCharityAtomic(id: number, driverId: number): Promise<Delivery | null>;
  arriveAtCharityAtomic(id: number, driverId: number): Promise<Delivery | null>;
  charityConfirmReceiptAtomic(id: number, charityId: number): Promise<Delivery | null>;
  driverConfirmDeliveryAtomic(id: number, driverId: number): Promise<Delivery | null>;
  // Legacy aliases
  completeDeliveryFull(id: number, driverId: number): Promise<Delivery | null>;
  confirmReceiptByCharityAtomic(id: number, charityId: number): Promise<Delivery | null>;
  getDeliveriesByCharity(charityId: number): Promise<any[]>;
  createDeliveriesForBasket(basketId: number): Promise<Delivery[]>;
}

export class DatabaseStorage implements IStorage {
  // ─── Users ─────────────────────────────────────────────
  async getUserById(id: number) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser) {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getAllUsers() {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserStatus(id: number, isActive: boolean) {
    const [updated] = await db.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return updated;
  }

  async updateUser(id: number, data: Partial<Pick<User, "name" | "phone" | "address">>) {
    const [updated] = await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return updated;
  }

  // ─── Offers ────────────────────────────────────────────
  async createOffer(restaurantId: number, offer: InsertFoodOffer) {
    const [created] = await db
      .insert(foodOffers)
      .values({ ...offer, restaurantId })
      .returning();
    return created;
  }

  async getOfferById(id: number) {
    const [offer] = await db.select().from(foodOffers).where(eq(foodOffers.id, id));
    return offer;
  }

  async getAllAvailableOffers(page = 1, limit = 20) {
    const validWhere = and(
      eq(foodOffers.status, "available"),
      isNull(foodOffers.deletedAt),
    );

    const [{ total }] = await db
      .select({ total: count() })
      .from(foodOffers)
      .where(validWhere);

    const rows = await db
      .select({ offer: foodOffers, restaurant: users })
      .from(foodOffers)
      .innerJoin(users, eq(foodOffers.restaurantId, users.id))
      .where(validWhere)
      .orderBy(desc(foodOffers.isUrgent), desc(foodOffers.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const offers = await Promise.all(rows.map(async r => {
      const avgRating = await this.getRestaurantAvgRating(r.restaurant.id);
      return { ...r.offer, restaurant: r.restaurant, avgRating };
    }));

    return { offers, total };
  }

  async expireStaleOffers() {
    const now = new Date();
    const result = await db
      .update(foodOffers)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(foodOffers.status, "available"),
          isNull(foodOffers.deletedAt),
          lte(foodOffers.expiresAt, now),
        )
      )
      .returning({ id: foodOffers.id });
    return result.length;
  }

  async getAllOffers() {
    const rows = await db
      .select({ offer: foodOffers, restaurant: users })
      .from(foodOffers)
      .innerJoin(users, eq(foodOffers.restaurantId, users.id))
      .where(isNull(foodOffers.deletedAt))
      .orderBy(desc(foodOffers.createdAt));
    return rows.map(r => ({ ...r.offer, restaurant: r.restaurant }));
  }

  async getOffersByRestaurant(restaurantId: number) {
    return await db.select().from(foodOffers)
      .where(and(eq(foodOffers.restaurantId, restaurantId), isNull(foodOffers.deletedAt)))
      .orderBy(desc(foodOffers.createdAt));
  }

  async updateOffer(id: number, data: Partial<InsertFoodOffer>) {
    const [updated] = await db.update(foodOffers).set({ ...data, updatedAt: new Date() }).where(eq(foodOffers.id, id)).returning();
    return updated;
  }

  async updateOfferStatus(id: number, status: FoodOffer["status"]) {
    const [updated] = await db.update(foodOffers).set({ status, updatedAt: new Date() }).where(eq(foodOffers.id, id)).returning();
    return updated;
  }

  async deleteOffer(id: number) {
    await db.update(foodOffers).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(foodOffers.id, id));
  }

  // ─── Requests ──────────────────────────────────────────
  async createRequest(charityId: number, req: InsertRequest) {
    const [created] = await db.insert(requests).values({ ...req, charityId }).returning();
    return created;
  }

  async getRequestById(id: number) {
    const [req] = await db.select().from(requests).where(eq(requests.id, id));
    return req;
  }

  async getRequestsByCharity(charityId: number) {
    const rows = await db
      .select({ request: requests, offer: foodOffers, restaurant: users })
      .from(requests)
      .innerJoin(foodOffers, eq(requests.offerId, foodOffers.id))
      .innerJoin(users, eq(foodOffers.restaurantId, users.id))
      .where(eq(requests.charityId, charityId))
      .orderBy(desc(requests.createdAt));
    return rows.map(r => ({ ...r.request, offer: { ...r.offer, restaurant: r.restaurant } }));
  }

  async getRequestsByOffer(offerId: number) {
    const rows = await db
      .select({ request: requests, charity: users })
      .from(requests)
      .innerJoin(users, eq(requests.charityId, users.id))
      .where(eq(requests.offerId, offerId));
    return rows.map(r => ({ ...r.request, charity: r.charity }));
  }

  async updateRequestStatus(id: number, status: Request["status"], confirmedAt?: Date) {
    const [updated] = await db.update(requests).set({ status, confirmedAt, updatedAt: new Date() }).where(eq(requests.id, id)).returning();
    return updated;
  }

  // ─── Strict workflow: charity accepts offer → delivery created ──
  // Transitions: request pending → waiting_for_delivery + delivery created (available)
  async acceptOfferByCharityAtomic(requestId: number, charityId: number): Promise<{ request: Request; delivery: Delivery } | null> {
    return await db.transaction(async (tx) => {
      const [req] = await tx.select().from(requests).where(eq(requests.id, requestId)).for("update");
      if (!req) return null;
      if (req.charityId !== charityId) return null;
      if (req.status !== "pending") return null;

      const offer = req.offerId ? (await tx.select().from(foodOffers).where(eq(foodOffers.id, req.offerId)))[0] : null;
      if (!offer) return null;

      const restaurant = offer.restaurantId ? (await tx.select().from(users).where(eq(users.id, offer.restaurantId)))[0] : null;
      const charity = (await tx.select().from(users).where(eq(users.id, charityId)))[0];

      // Create delivery (status: "available") for drivers to pick up
      const [delivery] = await tx.insert(deliveries).values({
        requestId,
        charityId,
        restaurantId: offer.restaurantId,
        pickupAddress: restaurant?.address || offer.pickupLocation || "—",
        dropoffAddress: charity?.address || "—",
        status: "available",
      }).returning();

      // Mark offer as transferred and request as waiting_for_delivery
      await tx.update(foodOffers).set({ status: "transferred", updatedAt: new Date() }).where(eq(foodOffers.id, offer.id));
      const [updatedReq] = await tx.update(requests)
        .set({ status: "waiting_for_delivery", confirmedAt: new Date(), updatedAt: new Date() })
        .where(eq(requests.id, requestId))
        .returning();

      return { request: updatedReq, delivery };
    });
  }

  // ─── Strict workflow: charity confirms receipt (STEP 1 of 2-step confirmation) ───
  // Driver must be "arrived". After this: delivery.status = "waiting_for_delivery_confirmation"
  // Driver can then confirm (step 2).
  async confirmRequestByCharityAtomic(requestId: number, charityId: number): Promise<{ request: Request; delivery: Delivery } | null> {
    return await db.transaction(async (tx) => {
      const [req] = await tx.select().from(requests).where(eq(requests.id, requestId)).for("update");
      if (!req) return null;
      if (req.charityId !== charityId) return null;
      // Accept "arrived" (new flow) or "delivered" (legacy rows)
      if (!["arrived", "delivered"].includes(req.status)) return null;

      const [delivery] = await tx.select().from(deliveries).where(eq(deliveries.requestId, requestId)).for("update");
      if (!delivery) return null;
      if (!["arrived", "waiting_for_charity_confirmation", "delivered"].includes(delivery.status)) return null;
      if (delivery.charityConfirmedAt) return null; // already confirmed

      const [updatedDelivery] = await tx.update(deliveries)
        .set({ status: "waiting_for_delivery_confirmation", charityConfirmedAt: new Date(), receivedAt: new Date(), updatedAt: new Date() })
        .where(eq(deliveries.id, delivery.id))
        .returning();

      const [updatedReq] = await tx.update(requests)
        .set({ status: "charity_confirmed", updatedAt: new Date() })
        .where(eq(requests.id, requestId))
        .returning();

      return { request: updatedReq, delivery: updatedDelivery };
    });
  }

  // ─── Logs ──────────────────────────────────────────────
  async log(userId: number | null, action: string, resource: string, resourceId?: number, details?: string) {
    await db.insert(activityLogs).values({ userId, action, resource, resourceId, details });
  }

  async getActivityLogs() {
    const rows = await db
      .select({ log: activityLogs, user: users })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(100);

    const result: any[] = [];

    for (const row of rows) {
      const log = row.log as any;
      const actor = row.user as any;
      let readableDetails = log.details || "";
      let actorName = actor?.name || "System";
      let targetName: string | null = null;

      if (log.action === "CREATE_RATING" && log.resourceId) {
        const [ratingRow] = await db.select().from(ratings).where(eq(ratings.id, log.resourceId));
        if (ratingRow) {
          const fromUser = await this.getUserById(ratingRow.fromId);
          const toUser = await this.getUserById(ratingRow.toId);
          actorName = fromUser?.name || actorName;
          targetName = toUser?.name || null;
          readableDetails = `${actorName} قيّم ${targetName || ratingRow.toType} بـ ${ratingRow.rating}/5${ratingRow.comment ? ` — ${ratingRow.comment}` : ""}`;
        }
      } else if (log.action === "BASKET_CONTRIBUTION") {
        readableDetails = `${actorName} ساهم في سلة خيرية${log.details ? ` — ${log.details}` : ""}`;
      } else if (log.action === "CREATE_BASKET") {
        readableDetails = `${actorName} أنشأ سلة خيرية${log.details ? ` — ${log.details}` : ""}`;
      } else if (log.action.includes("DELIVERY")) {
        readableDetails = `${actorName} — ${log.details || "تحديث حالة توصيل"}`;
      } else if (log.action.includes("OFFER")) {
        readableDetails = `${actorName} — ${log.details || "تحديث عرض"}`;
      } else if (log.action.includes("REQUEST")) {
        readableDetails = `${actorName} — ${log.details || "تحديث طلب"}`;
      } else if (log.userId && actorName) {
        readableDetails = `${actorName}${log.details ? ` — ${log.details}` : ""}`;
      }

      result.push({
        ...log,
        user: actor ? { id: actor.id, name: actor.name, role: actor.role, email: actor.email } : null,
        actorName,
        targetName,
        readableDetails,
      });
    }

    return result;
  }

  async getStats() {
    const [{ value: totalUsers }] = await db.select({ value: count() }).from(users);
    const [{ value: totalOffers }] = await db.select({ value: count() }).from(foodOffers).where(isNull(foodOffers.deletedAt));
    const [{ value: totalRequests }] = await db.select({ value: count() }).from(requests);
    const [{ value: completedTransfers }] = await db.select({ value: count() }).from(foodOffers).where(eq(foodOffers.status, "completed"));
    const [{ value: totalBaskets }] = await db.select({ value: count() }).from(baskets);
    const [{ value: completedBaskets }] = await db.select({ value: count() }).from(baskets).where(eq(baskets.status, "completed" as any));

    return {
      totalUsers: Number(totalUsers),
      totalOffers: Number(totalOffers),
      totalRequests: Number(totalRequests),
      completedTransfers: Number(completedTransfers),
      totalBaskets: Number(totalBaskets),
      completedBaskets: Number(completedBaskets),
    };
  }

  async getAllBasketsAdmin() {
    const rows = await db
      .select({ basket: baskets, charity: users })
      .from(baskets)
      .leftJoin(users, eq(baskets.charityId, users.id))
      .orderBy(desc(baskets.createdAt));

    const result: any[] = [];

    for (const row of rows) {
      const items = await db.select().from(basketItems).where(eq(basketItems.basketId, row.basket.id));
      const contribRows = await db
        .select({ contribution: basketContributions, restaurant: users })
        .from(basketContributions)
        .leftJoin(users, eq(basketContributions.restaurantId, users.id))
        .where(eq(basketContributions.basketId, row.basket.id));

      result.push({
        ...row.basket,
        charity: row.charity,
        items,
        contributions: contribRows.map((r: any) => ({ ...r.contribution, restaurant: r.restaurant })),
        completion: this.calculateCompletion(items),
      });
    }

    return result;
  }

  async getAdminMostActive() {
    const allUsers = await db.select().from(users);
    const allOffers = await db.select().from(foodOffers).where(isNull(foodOffers.deletedAt));
    const allRequests = await db.select().from(requests);
    const allBaskets = await db.select().from(baskets);
    const allContributions = await db.select().from(basketContributions);
    const allDeliveries = await db.select().from(deliveries);

    const nameOf = (id?: number | null) => allUsers.find((u: any) => u.id === id)?.name || `#${id}`;

    const restaurants = allUsers
      .filter((u: any) => u.role === "restaurant")
      .map((u: any) => {
        const offers = allOffers.filter((o: any) => o.restaurantId === u.id).length;
        const contributions = allContributions.filter((c: any) => c.restaurantId === u.id).length;
        return { id: u.id, name: u.name, offers, contributions, total: offers + contributions };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const charities = allUsers
      .filter((u: any) => u.role === "charity")
      .map((u: any) => {
        const reservations = allRequests.filter((r: any) => r.charityId === u.id).length;
        const basketsCreated = allBaskets.filter((b: any) => b.charityId === u.id).length;
        return { id: u.id, name: u.name, reservations, basketsCreated, total: reservations + basketsCreated };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const drivers = allUsers
      .filter((u: any) => u.role === "delivery")
      .map((u: any) => {
        const completedDeliveries = allDeliveries.filter((d: any) =>
          d.deliveryPersonId === u.id && ["confirmed_by_delivery", "delivered"].includes(d.status)
        ).length;
        const activeDeliveries = allDeliveries.filter((d: any) =>
          d.deliveryPersonId === u.id && !["confirmed_by_delivery", "delivered", "cancelled"].includes(d.status)
        ).length;
        return { id: u.id, name: u.name, completedDeliveries, activeDeliveries, total: completedDeliveries };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return { restaurants, charities, drivers };
  }

  // ─── Notifications ─────────────────────────────────────
  async createNotification(userId: number, type: string, title: string, body: string, link?: string, messageKey?: string, messageParams?: Record<string, string | number>) {
    const [created] = await db.insert(notifications).values({
      userId, type, title, body,
      ...(link ? { link } : {}),
      ...(messageKey ? { messageKey } : {}),
      ...(messageParams ? { messageParams: JSON.stringify(messageParams) } : {}),
    }).returning();
    return created;
  }

  async getNotifications(userId: number) {
    return await db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }

  async markNotificationRead(id: number, userId: number) {
    await db.update(notifications).set({ isRead: true })
      .where(eq(notifications.id, id));
  }

  async markAllNotificationsRead(userId: number) {
    await db.update(notifications).set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async getUnreadCount(userId: number) {
    const rows = await db.select({ value: count() }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return Number(rows[0]?.value ?? 0);
  }

  // ─── Multi-actor Ratings ───────────────────────────────
  async createMultiRating(
    fromId: number,
    fromType: "restaurant" | "charity" | "delivery",
    data: { requestId?: number | null; deliveryId?: number | null; toType: "restaurant" | "charity" | "delivery"; toId: number; rating: number; comment?: string },
  ): Promise<Rating> {
    const [created] = await db.insert(ratings).values({
      requestId: data.requestId ?? null,
      deliveryId: data.deliveryId ?? null,
      fromType,
      fromId,
      toType: data.toType,
      toId: data.toId,
      rating: data.rating,
      comment: data.comment,
    } as any).returning();
    return created;
  }

  async getRatingsByRequest(requestId: number): Promise<Rating[]> {
    return await db.select().from(ratings).where(eq(ratings.requestId, requestId)).orderBy(desc(ratings.createdAt));
  }

  async getRatingsForUser(toId: number, toType?: string): Promise<any[]> {
    const fromAlias = aliasedTable(users, "rating_from_user");
    const toAlias = aliasedTable(users, "rating_to_user");
    const conditions = toType
      ? and(eq(ratings.toId, toId), eq(ratings.toType, toType as any))
      : eq(ratings.toId, toId);

    const rows = await db
      .select({ rating: ratings, fromUser: fromAlias, toUser: toAlias })
      .from(ratings)
      .leftJoin(fromAlias, eq(ratings.fromId, fromAlias.id))
      .leftJoin(toAlias, eq(ratings.toId, toAlias.id))
      .where(conditions)
      .orderBy(desc(ratings.createdAt));

    return rows.map((r: any) => ({
      ...r.rating,
      fromName: r.fromUser?.name,
      toName: r.toUser?.name,
      fromUser: r.fromUser ? { id: r.fromUser.id, name: r.fromUser.name, role: r.fromUser.role } : null,
      toUser: r.toUser ? { id: r.toUser.id, name: r.toUser.name, role: r.toUser.role } : null,
    }));
  }

  async getRatingsGivenByUser(fromId: number, fromType?: string): Promise<any[]> {
    const fromAlias = aliasedTable(users, "given_rating_from_user");
    const toAlias = aliasedTable(users, "given_rating_to_user");
    const conditions = fromType
      ? and(eq(ratings.fromId, fromId), eq(ratings.fromType, fromType as any))
      : eq(ratings.fromId, fromId);

    const rows = await db
      .select({ rating: ratings, fromUser: fromAlias, toUser: toAlias })
      .from(ratings)
      .leftJoin(fromAlias, eq(ratings.fromId, fromAlias.id))
      .leftJoin(toAlias, eq(ratings.toId, toAlias.id))
      .where(conditions)
      .orderBy(desc(ratings.createdAt));

    return rows.map((r: any) => ({
      ...r.rating,
      fromName: r.fromUser?.name,
      toName: r.toUser?.name,
      fromUser: r.fromUser ? { id: r.fromUser.id, name: r.fromUser.name, role: r.fromUser.role } : null,
      toUser: r.toUser ? { id: r.toUser.id, name: r.toUser.name, role: r.toUser.role } : null,
    }));
  }

  async getAvgRatingForUser(toId: number, toType?: string): Promise<number> {
    const conditions = toType
      ? and(eq(ratings.toId, toId), eq(ratings.toType, toType as any))
      : eq(ratings.toId, toId);
    const rows = await db.select({ value: avg(ratings.rating) }).from(ratings).where(conditions);
    return parseFloat(rows[0]?.value ?? "0") || 0;
  }

  async hasRated(requestId: number, fromId: number, fromType: string, toId: number, toType: string): Promise<boolean> {
    return this.hasRatedFlexible({ requestId, fromId, fromType, toId, toType });
  }

  async hasRatedFlexible(data: { requestId?: number | null; deliveryId?: number | null; fromId: number; fromType: string; toId: number; toType: string }): Promise<boolean> {
    const identity = data.requestId
      ? eq(ratings.requestId, data.requestId)
      : eq(ratings.deliveryId, data.deliveryId as number);

    const rows = await db.select({ id: ratings.id }).from(ratings).where(
      and(
        identity,
        eq(ratings.fromId, data.fromId),
        eq(ratings.fromType, data.fromType as any),
        eq(ratings.toId, data.toId),
        eq(ratings.toType, data.toType as any),
      )
    );
    return rows.length > 0;
  }

  // Legacy compat — maps old single-direction charity→restaurant rating to multi-actor table
  async createRating(charityId: number, data: { requestId: number; restaurantId: number; stars: number; comment?: string }) {
    const [created] = await db.insert(ratings).values({
      requestId: data.requestId,
      fromType: "charity",
      fromId: charityId,
      toType: "restaurant",
      toId: data.restaurantId,
      rating: data.stars,
      comment: data.comment,
    }).returning();
    return created;
  }

  async getRatingByRequest(requestId: number) {
    const rows = await db.select().from(ratings).where(eq(ratings.requestId, requestId));
    return rows[0];
  }

  async getRestaurantRatings(restaurantId: number) {
    return await db
      .select({
        id: ratings.id,
        requestId: ratings.requestId,
        fromId: ratings.fromId,
        fromType: ratings.fromType,
        rating: ratings.rating,
        comment: ratings.comment,
        createdAt: ratings.createdAt,
        fromName: users.name,
      })
      .from(ratings)
      .leftJoin(users, eq(ratings.fromId, users.id))
      .where(and(eq(ratings.toId, restaurantId), eq(ratings.toType, "restaurant")))
      .orderBy(desc(ratings.createdAt));
  }

  async getRestaurantAvgRating(restaurantId: number): Promise<number> {
    const rows = await db.select({ value: avg(ratings.rating) }).from(ratings).where(
      and(eq(ratings.toId, restaurantId), eq(ratings.toType, "restaurant"))
    );
    return parseFloat(rows[0]?.value ?? "0") || 0;
  }

  // ─── Contact Messages ──────────────────────────────────
  async createContactMessage(data: { name: string; email: string; subject: string; message: string }) {
    const [created] = await db.insert(contactMessages).values(data).returning();
    return created;
  }

  async getContactMessages() {
    return await db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt));
  }

  async markMessageRead(id: number) {
    await db.update(contactMessages).set({ isRead: true }).where(eq(contactMessages.id, id));
  }

  async getUnreadMessagesCount() {
    const rows = await db.select({ value: count() }).from(contactMessages).where(eq(contactMessages.isRead, false));
    return Number(rows[0]?.value ?? 0);
  }

  // ─── Baskets ───────────────────────────────────────────
  private calculateCompletion(items: BasketItem[]): number {
    if (items.length === 0) return 0;
    const total = items.reduce((sum, i) => sum + i.requestedQty, 0);
    const fulfilled = items.reduce((sum, i) => sum + i.fulfilledQty, 0);
    return total === 0 ? 0 : Math.min(100, Math.round((fulfilled / total) * 100));
  }

  async createBasket(charityId: number, data: {
    title: string;
    description?: string;
    expiresAt: Date;
    items: Array<{ productName: string; category: string; requestedQty: number; unit: string; notes?: string }>;
  }): Promise<Basket> {
    const [basket] = await db.insert(baskets).values({
      charityId,
      title: data.title,
      description: data.description,
      expiresAt: data.expiresAt,
      status: "open",
    }).returning();

    if (data.items.length > 0) {
      await db.insert(basketItems).values(
        data.items.map(item => ({
          basketId: basket.id,
          productName: item.productName,
          category: item.category,
          requestedQty: item.requestedQty,
          fulfilledQty: 0,
          unit: item.unit,
          notes: item.notes,
          status: "pending" as const,
        }))
      );
    }

    return basket;
  }

  async expireStaleBaskets(): Promise<number> {
    const now = new Date();
    const result = await db
      .update(baskets)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          inArray(baskets.status, ["open", "partial"] as const),
          lt(baskets.expiresAt, now),
        )
      )
      .returning({ id: baskets.id });
    return result.length;
  }

  async getAllOpenBaskets() {
    await this.expireStaleBaskets();
    const rows = await db
      .select({ basket: baskets, charity: users })
      .from(baskets)
      .innerJoin(users, eq(baskets.charityId, users.id))
      .where(
        and(
          inArray(baskets.status, ["open", "partial"] as const),
          gt(baskets.expiresAt, new Date()),
        )
      )
      .orderBy(desc(baskets.createdAt));

    const result = [];
    for (const row of rows) {
      const items = await db
        .select()
        .from(basketItems)
        .where(eq(basketItems.basketId, row.basket.id));

      result.push({
        ...row.basket,
        charity: row.charity,
        items,
        completion: this.calculateCompletion(items),
      });
    }
    return result;
  }

  async getBasketWithDetails(id: number) {
    const [row] = await db
      .select({ basket: baskets, charity: users })
      .from(baskets)
      .innerJoin(users, eq(baskets.charityId, users.id))
      .where(eq(baskets.id, id));
    if (!row) return null;

    const items = await db.select().from(basketItems).where(eq(basketItems.basketId, id));

    const contribRows = await db
      .select({ contribution: basketContributions, restaurant: users })
      .from(basketContributions)
      .innerJoin(users, eq(basketContributions.restaurantId, users.id))
      .where(eq(basketContributions.basketId, id));

    return {
      ...row.basket,
      charity: row.charity,
      items,
      contributions: contribRows.map(c => ({ ...c.contribution, restaurant: c.restaurant })),
      completion: this.calculateCompletion(items),
    };
  }

  async getBasketsByCharity(charityId: number) {
    await this.expireStaleBaskets();
    const rows = await db
      .select()
      .from(baskets)
      .where(eq(baskets.charityId, charityId))
      .orderBy(desc(baskets.createdAt));

    const result = [];
    for (const basket of rows) {
      const items = await db.select().from(basketItems).where(eq(basketItems.basketId, basket.id));
      result.push({ ...basket, items, completion: this.calculateCompletion(items) });
    }
    return result;
  }

  async getBasketById(id: number): Promise<Basket | undefined> {
    const [b] = await db.select().from(baskets).where(eq(baskets.id, id));
    return b;
  }

  async getBasketItemById(id: number): Promise<BasketItem | undefined> {
    const [item] = await db.select().from(basketItems).where(eq(basketItems.id, id));
    return item;
  }

  async getContribution(basketId: number, itemId: number, restaurantId: number) {
    const [c] = await db
      .select()
      .from(basketContributions)
      .where(and(
        eq(basketContributions.basketId, basketId),
        eq(basketContributions.basketItemId, itemId),
        eq(basketContributions.restaurantId, restaurantId),
      ));
    return c;
  }

  async createContribution(data: {
    basketId: number;
    basketItemId: number;
    restaurantId: number;
    quantity: number;
  }): Promise<BasketContribution> {
    const [c] = await db.insert(basketContributions).values(data).returning();
    return c;
  }

  async updateContribution(id: number, quantity: number): Promise<BasketContribution> {
    const [c] = await db
      .update(basketContributions)
      .set({ quantity, updatedAt: new Date() })
      .where(eq(basketContributions.id, id))
      .returning();
    return c;
  }

  async updateBasketItemFulfilled(itemId: number, fulfilledQty: number) {
    const item = await this.getBasketItemById(itemId);
    if (!item) return;
    const status: "pending" | "partial" | "fulfilled" =
      fulfilledQty >= item.requestedQty ? "fulfilled" :
      fulfilledQty > 0 ? "partial" : "pending";

    await db
      .update(basketItems)
      .set({ fulfilledQty, status, updatedAt: new Date() })
      .where(eq(basketItems.id, itemId));
  }

  async checkAndUpdateBasketStatus(basketId: number): Promise<Basket | undefined> {
    const items = await db.select().from(basketItems).where(eq(basketItems.basketId, basketId));
    const allFulfilled = items.length > 0 && items.every(i => i.status === "fulfilled");
    const anyFulfilled = items.some(i => i.fulfilledQty > 0);

    const newStatus: Basket["status"] = allFulfilled ? "completed" : anyFulfilled ? "partial" : "open";

    const [updated] = await db
      .update(baskets)
      .set({
        status: newStatus,
        completedAt: allFulfilled ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(baskets.id, basketId))
      .returning();
    return updated;
  }

  // Atomic contribute: locks basket + items, allocates remaining quantities under a transaction.
  // Returns null if no valid contributions could be applied.
  async contributeToBasketAtomic(
    basketId: number,
    restaurantId: number,
    contributions: { basketItemId: number; quantity: number }[],
  ): Promise<{ contributions: BasketContribution[]; basket: Basket; completion: number; applied: { basketItemId: number; appliedQty: number }[] } | null> {
    return await db.transaction(async (tx) => {
      // Lock the basket row first to serialize concurrent contributors.
      const [basket] = await tx
        .select()
        .from(baskets)
        .where(eq(baskets.id, basketId))
        .for("update");
      if (!basket) return null;
      if (basket.status !== "open" && basket.status !== "partial") return null;
      if (basket.expiresAt < new Date()) return null;

      // Lock and re-read all referenced items (only those belonging to this basket).
      const itemIds = contributions.map(c => c.basketItemId);
      const lockedItems = itemIds.length
        ? await tx
            .select()
            .from(basketItems)
            .where(and(eq(basketItems.basketId, basketId), inArray(basketItems.id, itemIds)))
            .for("update")
        : [];
      const itemMap = new Map(lockedItems.map(i => [i.id, i]));

      const results: BasketContribution[] = [];
      const applied: { basketItemId: number; appliedQty: number }[] = [];

      for (const contrib of contributions) {
        const item = itemMap.get(contrib.basketItemId);
        if (!item) continue;
        const remaining = item.requestedQty - item.fulfilledQty;
        if (remaining <= 0) continue;
        const actualQty = Math.min(contrib.quantity, remaining);
        if (actualQty <= 0) continue;

        const [existing] = await tx
          .select()
          .from(basketContributions)
          .where(and(
            eq(basketContributions.basketId, basketId),
            eq(basketContributions.basketItemId, contrib.basketItemId),
            eq(basketContributions.restaurantId, restaurantId),
          ));

        if (existing) {
          const [updated] = await tx
            .update(basketContributions)
            .set({ quantity: existing.quantity + actualQty, updatedAt: new Date() })
            .where(eq(basketContributions.id, existing.id))
            .returning();
          results.push(updated);
        } else {
          const [created] = await tx
            .insert(basketContributions)
            .values({ basketId, basketItemId: contrib.basketItemId, restaurantId, quantity: actualQty })
            .returning();
          results.push(created);
        }

        const newFulfilled = item.fulfilledQty + actualQty;
        const status: "pending" | "partial" | "fulfilled" =
          newFulfilled >= item.requestedQty ? "fulfilled" :
          newFulfilled > 0 ? "partial" : "pending";

        await tx
          .update(basketItems)
          .set({ fulfilledQty: newFulfilled, status, updatedAt: new Date() })
          .where(eq(basketItems.id, item.id));

        // Keep our local copy in sync in case the same item appears twice in the request.
        item.fulfilledQty = newFulfilled;
        item.status = status;
        applied.push({ basketItemId: item.id, appliedQty: actualQty });
      }

      if (applied.length === 0) return null;

      // Recompute basket status from the final item state.
      const allItems = await tx.select().from(basketItems).where(eq(basketItems.basketId, basketId));
      const allFulfilled = allItems.length > 0 && allItems.every(i => i.status === "fulfilled");
      const anyFulfilled = allItems.some(i => i.fulfilledQty > 0);
      const newBasketStatus: Basket["status"] = allFulfilled ? "completed" : anyFulfilled ? "partial" : "open";

      const [updatedBasket] = await tx
        .update(baskets)
        .set({
          status: newBasketStatus,
          completedAt: allFulfilled ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(baskets.id, basketId))
        .returning();

      const totalRequested = allItems.reduce((s, i) => s + i.requestedQty, 0);
      const totalFulfilled = allItems.reduce((s, i) => s + i.fulfilledQty, 0);
      const completion = totalRequested === 0 ? 0 : Math.round((totalFulfilled / totalRequested) * 100);

      return { contributions: results, basket: updatedBasket, completion, applied };
    });
  }

  async updateBasketStatus(id: number, status: Basket["status"]) {
    await db
      .update(baskets)
      .set({ status, updatedAt: new Date() })
      .where(eq(baskets.id, id));
  }

  async getBasketCompletion(basketId: number): Promise<number> {
    const items = await db.select().from(basketItems).where(eq(basketItems.basketId, basketId));
    return this.calculateCompletion(items);
  }

  async getBasketContributors(basketId: number): Promise<number[]> {
    const contribs = await db
      .select({ restaurantId: basketContributions.restaurantId })
      .from(basketContributions)
      .where(eq(basketContributions.basketId, basketId));
    return Array.from(new Set(contribs.map(c => c.restaurantId)));
  }

  async getContributionsByBasket(basketId: number) {
    const rows = await db
      .select({ contribution: basketContributions, restaurant: users })
      .from(basketContributions)
      .innerJoin(users, eq(basketContributions.restaurantId, users.id))
      .where(eq(basketContributions.basketId, basketId));
    return rows.map(r => ({ ...r.contribution, restaurant: r.restaurant }));
  }

  async getContributionsByRestaurant(restaurantId: number) {
    const rows = await db
      .select({ contribution: basketContributions, basket: baskets })
      .from(basketContributions)
      .innerJoin(baskets, eq(basketContributions.basketId, baskets.id))
      .where(eq(basketContributions.restaurantId, restaurantId))
      .orderBy(desc(basketContributions.createdAt));
    return rows.map(r => ({ ...r.contribution, basket: r.basket }));
  }

  // ─── Deliveries ────────────────────────────────────────
  async createDelivery(data: {
    requestId?: number | null;
    basketId?: number | null;
    charityId: number;
    restaurantId?: number | null;
    pickupAddress: string;
    dropoffAddress: string;
    notes?: string;
  }): Promise<Delivery> {
    const [d] = await db
      .insert(deliveries)
      .values({
        requestId: data.requestId ?? null,
        basketId: data.basketId ?? null,
        charityId: data.charityId,
        restaurantId: data.restaurantId ?? null,
        pickupAddress: data.pickupAddress,
        dropoffAddress: data.dropoffAddress,
        notes: data.notes,
        status: "pending",
      })
      .returning();
    return d;
  }

  async getDeliveryById(id: number): Promise<Delivery | undefined> {
    const [d] = await db.select().from(deliveries).where(eq(deliveries.id, id));
    return d;
  }

  async getAvailableDeliveries() {
    // "available" is the new default; "pending" kept for backward compat with old rows
    return await db
      .select()
      .from(deliveries)
      .where(or(eq(deliveries.status, "available"), eq(deliveries.status, "pending")))
      .orderBy(desc(deliveries.createdAt));
  }

  async getDeliveriesByDriver(driverId: number) {
    return await db
      .select()
      .from(deliveries)
      .where(eq(deliveries.deliveryPersonId, driverId))
      .orderBy(desc(deliveries.createdAt));
  }

  async getAllDeliveries() {
    return await db
      .select()
      .from(deliveries)
      .orderBy(desc(deliveries.createdAt));
  }

  async updateDelivery(id: number, data: Partial<Pick<Delivery,
    "status" | "deliveryPersonId" | "pickupTime" | "deliveryTime" | "driverConfirmedAt" | "receivedAt" | "notes" | "distance"
  >>): Promise<Delivery> {
    const [updated] = await db
      .update(deliveries)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(deliveries.id, id))
      .returning();
    return updated;
  }

  // Conditional accept: succeeds only if the row is still available/pending and unassigned.
  // Also transitions the linked request (if any) to "delivery_assigned".
  async acceptDeliveryIfAvailable(id: number, driverId: number): Promise<Delivery | null> {
    return await db.transaction(async (tx) => {
      const [delivery] = await tx
        .select()
        .from(deliveries)
        .where(eq(deliveries.id, id))
        .for("update");
      if (!delivery) return null;
      if (!["available", "pending"].includes(delivery.status)) return null;
      if (delivery.deliveryPersonId !== null) return null;

      const [updated] = await tx
        .update(deliveries)
        .set({ status: "accepted", deliveryPersonId: driverId, updatedAt: new Date() })
        .where(eq(deliveries.id, id))
        .returning();

      // Keep request in sync
      if (updated.requestId) {
        await tx.update(requests)
          .set({ status: "delivery_assigned", updatedAt: new Date() })
          .where(eq(requests.id, updated.requestId));
      }
      return updated;
    });
  }

  // Driver going to restaurant (accepted → going_to_restaurant)
  async goToRestaurantAtomic(id: number, driverId: number): Promise<Delivery | null> {
    return await db.transaction(async (tx) => {
      const [delivery] = await tx.select().from(deliveries).where(eq(deliveries.id, id)).for("update");
      if (!delivery) return null;
      if (delivery.deliveryPersonId !== driverId) return null;
      if (delivery.status !== "accepted") return null;

      const [updated] = await tx
        .update(deliveries)
        .set({ status: "going_to_restaurant", updatedAt: new Date() })
        .where(eq(deliveries.id, id))
        .returning();
      return updated;
    });
  }

  // STEP 3a: Driver confirms pickup — goes to waiting_for_restaurant_confirmation
  async deliveryPickupAtomic(id: number, driverId: number): Promise<Delivery | null> {
    return await db.transaction(async (tx) => {
      const [delivery] = await tx.select().from(deliveries).where(eq(deliveries.id, id)).for("update");
      if (!delivery) return null;
      if (delivery.deliveryPersonId !== driverId) return null;
      if (delivery.status !== "going_to_restaurant") return null;

      const [updated] = await tx
        .update(deliveries)
        .set({ status: "waiting_for_restaurant_confirmation", updatedAt: new Date() })
        .where(eq(deliveries.id, id))
        .returning();
      return updated;
    });
  }

  // STEP 3b: Restaurant confirms handoff (waiting_for_restaurant_confirmation → picked_up)
  async restaurantConfirmPickupAtomic(id: number, restaurantId: number): Promise<Delivery | null> {
    return await db.transaction(async (tx) => {
      const [delivery] = await tx.select().from(deliveries).where(eq(deliveries.id, id)).for("update");
      if (!delivery) return null;
      if (delivery.restaurantId !== restaurantId) return null;
      if (delivery.status !== "waiting_for_restaurant_confirmation") return null;
      if (delivery.restaurantConfirmedAt) return null;

      const [updated] = await tx
        .update(deliveries)
        .set({ status: "picked_up", restaurantConfirmedAt: new Date(), pickupTime: new Date(), updatedAt: new Date() })
        .where(eq(deliveries.id, id))
        .returning();

      if (updated.requestId) {
        await tx.update(requests)
          .set({ status: "picked_up", updatedAt: new Date() })
          .where(eq(requests.id, updated.requestId));
      }
      return updated;
    });
  }

  // STEP 4: Driver heading to charity (picked_up → going_to_charity) + request sync
  async goToCharityAtomic(id: number, driverId: number): Promise<Delivery | null> {
    return await db.transaction(async (tx) => {
      const [delivery] = await tx.select().from(deliveries).where(eq(deliveries.id, id)).for("update");
      if (!delivery) return null;
      if (delivery.deliveryPersonId !== driverId) return null;
      if (delivery.status !== "picked_up") return null;

      const [updated] = await tx
        .update(deliveries)
        .set({ status: "going_to_charity", updatedAt: new Date() })
        .where(eq(deliveries.id, id))
        .returning();

      if (updated.requestId) {
        await tx.update(requests)
          .set({ status: "on_the_way_to_charity", updatedAt: new Date() })
          .where(eq(requests.id, updated.requestId));
      }
      return updated;
    });
  }

  // ── STEP 5 (driver): Arrive at charity (going_to_charity → arrived) ─────────
  // After arrival, system enters WAITING STATE. Charity must confirm first.
  async arriveAtCharityAtomic(id: number, driverId: number): Promise<Delivery | null> {
    return await db.transaction(async (tx) => {
      const [delivery] = await tx.select().from(deliveries).where(eq(deliveries.id, id)).for("update");
      if (!delivery) return null;
      if (delivery.deliveryPersonId !== driverId) return null;
      if (delivery.status !== "going_to_charity") return null;

      const [updated] = await tx
        .update(deliveries)
        .set({ status: "arrived", arrivedAt: new Date(), updatedAt: new Date() })
        .where(eq(deliveries.id, id))
        .returning();

      if (updated.requestId) {
        await tx.update(requests)
          .set({ status: "arrived", updatedAt: new Date() })
          .where(eq(requests.id, updated.requestId));
      }
      return updated;
    });
  }

  // Legacy alias for old route (/complete) — now delegates to arrive
  async completeDeliveryFull(id: number, driverId: number): Promise<Delivery | null> {
    return this.arriveAtCharityAtomic(id, driverId);
  }

  // ── STEP 6 (charity): Confirm receipt (arrived → waiting_for_delivery_confirmation) ─
  // Only allowed when delivery.status === "arrived". After this: driver can confirm.
  async charityConfirmReceiptAtomic(id: number, charityId: number): Promise<Delivery | null> {
    return await db.transaction(async (tx) => {
      const [delivery] = await tx.select().from(deliveries).where(eq(deliveries.id, id)).for("update");
      if (!delivery) return null;
      if (delivery.charityId !== charityId) return null;
      if (!["arrived", "delivered"].includes(delivery.status)) return null;
      if (delivery.charityConfirmedAt) return null;

      const [updated] = await tx
        .update(deliveries)
        .set({ status: "waiting_for_delivery_confirmation", charityConfirmedAt: new Date(), receivedAt: new Date(), updatedAt: new Date() })
        .where(eq(deliveries.id, id))
        .returning();

      if (updated.requestId) {
        await tx.update(requests)
          .set({ status: "charity_confirmed", updatedAt: new Date() })
          .where(eq(requests.id, updated.requestId));
      }
      return updated;
    });
  }

  // Legacy basket-based confirm alias
  async confirmReceiptByCharityAtomic(id: number, charityId: number): Promise<Delivery | null> {
    return this.charityConfirmReceiptAtomic(id, charityId);
  }

  // ── STEP 7 (driver): Confirm delivery (waiting_for_delivery_confirmation → confirmed_by_delivery) ─
  //  BLOCKED unless charity has already confirmed (charityConfirmedAt is set).
  // This step completes the request and triggers ratings availability.
  async driverConfirmDeliveryAtomic(id: number, driverId: number): Promise<Delivery | null> {
    return await db.transaction(async (tx) => {
      const [delivery] = await tx.select().from(deliveries).where(eq(deliveries.id, id)).for("update");
      if (!delivery) return null;
      if (delivery.deliveryPersonId !== driverId) return null;
      //  CRITICAL: block if charity hasn't confirmed yet
      if (!delivery.charityConfirmedAt) return null;
      if (delivery.status !== "waiting_for_delivery_confirmation") return null;
      if (delivery.driverConfirmedAt) return null;

      const [updated] = await tx
        .update(deliveries)
        .set({ status: "confirmed_by_delivery", deliveryTime: new Date(), driverConfirmedAt: new Date(), updatedAt: new Date() })
        .where(eq(deliveries.id, id))
        .returning();

      if (updated.requestId) {
        const [req] = await tx.select().from(requests).where(eq(requests.id, updated.requestId));
        if (req) {
          await tx.update(requests)
            .set({ status: "completed", updatedAt: new Date() })
            .where(eq(requests.id, updated.requestId));
          await tx.update(foodOffers)
            .set({ status: "completed", updatedAt: new Date() })
            .where(eq(foodOffers.id, req.offerId));
        }
      }
      return updated;
    });
  }

  // List all deliveries that should be visible to a given charity, joined
  // with restaurant info so the UI can render addresses & names.
  // SECURITY: explicit projection — never return password or sensitive user fields.
  async getDeliveriesByCharity(charityId: number) {
    const rows = await db
      .select({
        delivery: deliveries,
        restaurant: {
          id: users.id,
          name: users.name,
          address: users.address,
          phone: users.phone,
        },
        basket: baskets,
      })
      .from(deliveries)
      .leftJoin(users, eq(deliveries.restaurantId, users.id))
      .leftJoin(baskets, eq(deliveries.basketId, baskets.id))
      .where(eq(deliveries.charityId, charityId))
      .orderBy(desc(deliveries.createdAt));
    return rows.map(r => ({
      ...r.delivery,
      restaurant: r.restaurant,
      basket: r.basket,
    }));
  }

  async getDeliveriesPendingRestaurantConfirm(restaurantId: number) {
    const driverAlias = aliasedTable(users, "driver");
    const rows = await db
      .select({
        delivery: deliveries,
        driver: { id: driverAlias.id, name: driverAlias.name, phone: driverAlias.phone },
        basket: baskets,
      })
      .from(deliveries)
      .leftJoin(driverAlias, eq(deliveries.deliveryPersonId, driverAlias.id))
      .leftJoin(baskets, eq(deliveries.basketId, baskets.id))
      .where(and(eq(deliveries.restaurantId, restaurantId), eq(deliveries.status, "waiting_for_restaurant_confirmation")))
      .orderBy(desc(deliveries.updatedAt));
    return rows.map(r => ({ ...r.delivery, driver: r.driver, basket: r.basket }));
  }

  async getDeliveriesByRestaurant(restaurantId: number) {
    const driverAlias = aliasedTable(users, "driver_all");
    const charityAlias = aliasedTable(users, "charity_all");

    const rows = await db
      .select({
        delivery: deliveries,
        request: requests,
        offer: foodOffers,
        driver: {
          id: driverAlias.id,
          name: driverAlias.name,
          phone: driverAlias.phone,
        },
        charity: {
          id: charityAlias.id,
          name: charityAlias.name,
          address: charityAlias.address,
          phone: charityAlias.phone,
        },
        basket: baskets,
      })
      .from(deliveries)
      // Important: offer deliveries are connected through requestId -> requests.offerId.
      // restaurants.tsx needs request.offerId to show the "Rate Driver" button
      // inside completed Posted Offers.
      .leftJoin(requests, eq(deliveries.requestId, requests.id))
      .leftJoin(foodOffers, eq(requests.offerId, foodOffers.id))
      .leftJoin(driverAlias, eq(deliveries.deliveryPersonId, driverAlias.id))
      .leftJoin(charityAlias, eq(deliveries.charityId, charityAlias.id))
      .leftJoin(baskets, eq(deliveries.basketId, baskets.id))
      .where(eq(deliveries.restaurantId, restaurantId))
      .orderBy(desc(deliveries.createdAt));

    return rows.map(r => ({
      ...r.delivery,
      request: r.request,
      offer: r.offer,
      // Extra aliases make the frontend robust even if it checks different names.
      requestOfferId: r.request?.offerId ?? null,
      offerId: r.request?.offerId ?? r.offer?.id ?? null,
      driver: r.driver,
      charity: r.charity,
      basket: r.basket,
    }));
  }

  // Create one delivery per restaurant that contributed to a basket.
  // Idempotent: locks the basket row first, then re-checks existing deliveries
  // so two concurrent callers cannot both insert duplicate sets.
  async createDeliveriesForBasket(basketId: number): Promise<Delivery[]> {
    return await db.transaction(async (tx) => {
      // Lock the basket row — serializes concurrent calls for this basket.
      const [basket] = await tx
        .select()
        .from(baskets)
        .where(eq(baskets.id, basketId))
        .for("update");
      if (!basket) return [];

      const existing = await tx
        .select({ id: deliveries.id })
        .from(deliveries)
        .where(eq(deliveries.basketId, basketId));
      if (existing.length > 0) return [];

      const [charity] = await tx.select().from(users).where(eq(users.id, basket.charityId));
      const dropoffAddress = charity?.address || "—";

      const contribs = await tx
        .select({ restaurantId: basketContributions.restaurantId })
        .from(basketContributions)
        .where(eq(basketContributions.basketId, basketId));
      const restaurantIds = Array.from(new Set(contribs.map(c => c.restaurantId)));
      if (restaurantIds.length === 0) return [];

      const restaurants = await tx
        .select()
        .from(users)
        .where(inArray(users.id, restaurantIds));
      const restMap = new Map(restaurants.map(r => [r.id, r]));

      const created: Delivery[] = [];
      for (const restaurantId of restaurantIds) {
        const r = restMap.get(restaurantId);
        const [d] = await tx
          .insert(deliveries)
          .values({
            requestId: null,
            basketId,
            charityId: basket.charityId,
            restaurantId,
            pickupAddress: r?.address || "—",
            dropoffAddress,
            status: "pending",
          })
          .returning();
        created.push(d);
      }
      return created;
    });
  }

  async getDriverStats(driverId: number) {
    const all = await db.select().from(deliveries).where(eq(deliveries.deliveryPersonId, driverId));
    const completedStatuses = ["confirmed_by_delivery", "delivered"] as const;
    const activeStatuses = ["accepted", "going_to_restaurant", "picked_up", "going_to_charity", "arrived", "waiting_for_charity_confirmation", "waiting_for_delivery_confirmation"] as const;
    return {
      total: all.length,
      completed: all.filter(d => completedStatuses.includes(d.status as any)).length,
      active: all.filter(d => activeStatuses.includes(d.status as any)).length,
      cancelled: all.filter(d => d.status === "cancelled").length,
    };
  }
}

export const storage = new DatabaseStorage();