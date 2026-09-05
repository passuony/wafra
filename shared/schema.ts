import { relations } from "drizzle-orm";
import { pgTable, text, integer, timestamp, pgEnum, boolean, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["restaurant", "charity", "admin", "delivery"]);
export const offerStatusEnum = pgEnum("offer_status", ["available", "reserved", "confirmed", "transferred", "completed", "expired", "cancelled"]);

export const requestStatusEnum = pgEnum("request_status", [
  // Legacy (kept for backward compat with existing rows)
  "pending",
  "approved",
  "rejected",
  "cancelled",
  // Strict workflow statuses
  "accepted_by_charity",
  "waiting_for_delivery",
  "delivery_assigned",
  "picked_up",
  "on_the_way_to_charity",
  "delivered",
  // New strict confirmation statuses
  "arrived",            // driver arrived at charity — waiting for charity to confirm
  "charity_confirmed",  // charity confirmed receipt — driver can now confirm
  "delivery_confirmed", // driver confirmed delivery — triggers completion
  "completed",
]);

export const basketStatusEnum = pgEnum("basket_status", [
  "open",
  "partial",
  "completed",
  "cancelled",
  "expired",
]);

export const basketItemStatusEnum = pgEnum("basket_item_status", [
  "pending",
  "partial",
  "fulfilled",
]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",           // legacy (old rows created before strict workflow)
  "available",         // new default — waiting for a driver to accept
  "accepted",          // driver accepted
  "going_to_restaurant", // driver en-route to restaurant
  "waiting_for_restaurant_confirmation", // driver confirmed pickup — waiting for restaurant to hand off
  "picked_up",         // restaurant confirmed handoff — driver has food
  "going_to_charity",  // driver en-route to charity
  // New strict confirmation statuses
  "arrived",                          // driver arrived at charity
  "waiting_for_charity_confirmation", // waiting — charity must confirm first
  "waiting_for_delivery_confirmation", // charity confirmed — driver can now confirm
  "confirmed_by_delivery",            // driver confirmed — fully done
  // Legacy
  "delivered",         // old final state (pre-strict-workflow rows)
  "cancelled",
]);

export const actorTypeEnum = pgEnum("actor_type", ["restaurant", "charity", "delivery"]);

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("restaurant"),
  phone: text("phone"),
  address: text("address"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("users_email_idx").on(t.email),
  index("users_role_idx").on(t.role),
]);

export const foodOffers = pgTable("food_offers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  restaurantId: integer("restaurant_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  quantity: text("quantity").notNull(),
  unit: text("unit").notNull().default("وجبة"),
  pickupLocation: text("pickup_location").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  status: offerStatusEnum("status").notNull().default("available"),
  isUrgent: boolean("is_urgent").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("offers_restaurant_idx").on(t.restaurantId),
  index("offers_status_idx").on(t.status),
  index("offers_expires_idx").on(t.expiresAt),
  index("offers_deleted_idx").on(t.deletedAt),
]);

export const requests = pgTable("requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  offerId: integer("offer_id").references(() => foodOffers.id).notNull(),
  charityId: integer("charity_id").references(() => users.id).notNull(),
  status: requestStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("requests_charity_idx").on(t.charityId),
  index("requests_offer_idx").on(t.offerId),
]);

export const activityLogs = pgTable("activity_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: integer("resource_id"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type").notNull().default("info"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  isRead: boolean("is_read").notNull().default(false),
  messageKey: text("message_key"),     // i18n key for client-side translation
  messageParams: text("message_params"), // JSON-encoded params for template interpolation
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("notifs_user_idx").on(t.userId),
  index("notifs_read_idx").on(t.isRead),
]);

// ─── Multi-actor ratings ───────────────────────────────────
// Supports all 6 rating directions between restaurants, charities, and delivery agents.
// One rating per completed request or completed delivery context.
// requestId is used for normal offer requests; deliveryId is used for basket deliveries where requestId is null.
export const ratings = pgTable("ratings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  requestId: integer("request_id").references(() => requests.id),
  deliveryId: integer("delivery_id").references(() => deliveries.id),
  fromType: actorTypeEnum("from_type").notNull(),
  fromId: integer("from_id").references(() => users.id).notNull(),
  toType: actorTypeEnum("to_type").notNull(),
  toId: integer("to_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(), // 1–5
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("ratings_request_idx").on(t.requestId),
  index("ratings_delivery_idx").on(t.deliveryId),
  index("ratings_to_idx").on(t.toType, t.toId),
  unique("ratings_unique_request_pair").on(t.requestId, t.fromType, t.fromId, t.toType, t.toId),
  unique("ratings_unique_delivery_pair").on(t.deliveryId, t.fromType, t.fromId, t.toType, t.toId),
]);

export const contactMessages = pgTable("contact_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Baskets (charity request baskets) ────────────────────
export const baskets = pgTable("baskets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  charityId: integer("charity_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: basketStatusEnum("status").notNull().default("open"),
  expiresAt: timestamp("expires_at").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("baskets_charity_idx").on(t.charityId),
  index("baskets_status_idx").on(t.status),
]);

export const basketItems = pgTable("basket_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  basketId: integer("basket_id").references(() => baskets.id).notNull(),
  productName: text("product_name").notNull(),
  category: text("category").notNull(),
  requestedQty: integer("requested_qty").notNull(),
  fulfilledQty: integer("fulfilled_qty").notNull().default(0),
  unit: text("unit").notNull().default("وجبة"),
  notes: text("notes"),
  status: basketItemStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("basket_items_basket_idx").on(t.basketId),
]);

export const basketContributions = pgTable("basket_contributions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  basketId: integer("basket_id").references(() => baskets.id).notNull(),
  basketItemId: integer("basket_item_id").references(() => basketItems.id).notNull(),
  restaurantId: integer("restaurant_id").references(() => users.id).notNull(),
  quantity: integer("quantity").notNull(),
  status: requestStatusEnum("status").notNull().default("pending"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("contributions_basket_idx").on(t.basketId),
  index("contributions_restaurant_idx").on(t.restaurantId),
  index("contributions_item_idx").on(t.basketItemId),
]);

// ─── Deliveries ───────────────────────────────────────────
export const deliveries = pgTable("deliveries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  requestId: integer("request_id").references(() => requests.id),
  basketId: integer("basket_id").references(() => baskets.id),
  charityId: integer("charity_id").references(() => users.id).notNull(),
  restaurantId: integer("restaurant_id").references(() => users.id),
  deliveryPersonId: integer("delivery_person_id").references(() => users.id),
  status: deliveryStatusEnum("status").notNull().default("available"),
  pickupAddress: text("pickup_address").notNull(),
  dropoffAddress: text("dropoff_address").notNull(),
  pickupTime: timestamp("pickup_time"),
  deliveryTime: timestamp("delivery_time"),
  arrivedAt: timestamp("arrived_at"),             // when driver arrived at charity
  restaurantConfirmedAt: timestamp("restaurant_confirmed_at"), // when restaurant confirmed handoff to driver
  charityConfirmedAt: timestamp("charity_confirmed_at"), // when charity confirmed receipt
  driverConfirmedAt: timestamp("driver_confirmed_at"),   // when driver confirmed final delivery
  receivedAt: timestamp("received_at"),           // alias kept for basket-based backward compat
  notes: text("notes"),
  distance: text("distance"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("deliveries_driver_idx").on(t.deliveryPersonId),
  index("deliveries_status_idx").on(t.status),
  index("deliveries_request_idx").on(t.requestId),
  index("deliveries_basket_idx").on(t.basketId),
]);

// ─── Relations ────────────────────────────────────────────
export const foodOffersRelations = relations(foodOffers, ({ one }) => ({
  restaurant: one(users, { fields: [foodOffers.restaurantId], references: [users.id] }),
}));

export const requestsRelations = relations(requests, ({ one }) => ({
  offer: one(foodOffers, { fields: [requests.offerId], references: [foodOffers.id] }),
  charity: one(users, { fields: [requests.charityId], references: [users.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  offers: many(foodOffers),
  requests: many(requests),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  request: one(requests, { fields: [ratings.requestId], references: [requests.id] }),
  delivery: one(deliveries, { fields: [ratings.deliveryId], references: [deliveries.id] }),
  fromUser: one(users, { fields: [ratings.fromId], references: [users.id] }),
  toUser: one(users, { fields: [ratings.toId], references: [users.id] }),
}));

export const basketsRelations = relations(baskets, ({ one, many }) => ({
  charity: one(users, { fields: [baskets.charityId], references: [users.id] }),
  items: many(basketItems),
  contributions: many(basketContributions),
}));

export const basketItemsRelations = relations(basketItems, ({ one, many }) => ({
  basket: one(baskets, { fields: [basketItems.basketId], references: [baskets.id] }),
  contributions: many(basketContributions),
}));

export const basketContributionsRelations = relations(basketContributions, ({ one }) => ({
  basket: one(baskets, { fields: [basketContributions.basketId], references: [baskets.id] }),
  item: one(basketItems, { fields: [basketContributions.basketItemId], references: [basketItems.id] }),
  restaurant: one(users, { fields: [basketContributions.restaurantId], references: [users.id] }),
}));

export const deliveriesRelations = relations(deliveries, ({ one }) => ({
  request: one(requests, { fields: [deliveries.requestId], references: [requests.id] }),
  basket: one(baskets, { fields: [deliveries.basketId], references: [baskets.id] }),
  charity: one(users, { fields: [deliveries.charityId], references: [users.id] }),
  restaurant: one(users, { fields: [deliveries.restaurantId], references: [users.id] }),
  driver: one(users, { fields: [deliveries.deliveryPersonId], references: [users.id] }),
}));

// ─── Schemas & Types ──────────────────────────────────────
export const insertUserSchema = createInsertSchema(users).omit({ createdAt: true, updatedAt: true, isActive: true });
export const registerSchema = insertUserSchema.pick({ email: true, password: true, name: true, role: true, phone: true, address: true });
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

export const insertFoodOfferSchema = createInsertSchema(foodOffers, {
  expiresAt: z.coerce.date(),
}).pick({ title: true, description: true, category: true, quantity: true, unit: true, pickupLocation: true, expiresAt: true, isUrgent: true });
export const updateFoodOfferSchema = insertFoodOfferSchema.partial();

export const insertRequestSchema = createInsertSchema(requests).pick({ offerId: true, notes: true });

// Multi-actor rating schema
// Accepts ids from the client safely even if they arrive as strings, null, or empty values.
const optionalPositiveId = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "string") return Number(value);
  return value;
}, z.number().int().positive().optional());

export const insertRatingSchema = z.object({
  requestId: optionalPositiveId,
  deliveryId: optionalPositiveId,
  toType: z.enum(["restaurant", "charity", "delivery"]),
  rating: z.preprocess((value) => typeof value === "string" ? Number(value) : value, z.number().int().min(1).max(5)),
  comment: z.string().max(500).optional(),
}).superRefine((data, ctx) => {
  const hasRequestId = typeof data.requestId === "number";
  const hasDeliveryId = typeof data.deliveryId === "number";

  if (hasRequestId === hasDeliveryId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["requestId"],
      message: "Send exactly one of requestId or deliveryId",
    });
  }
});

// Legacy rating schema kept for old frontend calls
export const insertRatingSchemaLegacy = z.object({
  requestId: z.number(),
  restaurantId: z.number(),
  stars: z.number().min(1).max(5),
  comment: z.string().optional(),
});

export const insertContactMessageSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  subject: z.string().min(1).default("General Inquiry"),
  message: z.string().min(1),
});

export const createBasketSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(500).optional(),
  expiresAt: z.coerce.date(),
  items: z.array(z.object({
    productName: z.string().min(2).max(200),
    category: z.string(),
    requestedQty: z.number().int().positive(),
    unit: z.string().default("وجبة"),
    notes: z.string().max(300).optional(),
  })).min(1).max(20),
});

export const contributeBasketSchema = z.object({
  contributions: z.array(z.object({
    basketItemId: z.number().int().positive(),
    quantity: z.number().int().positive(),
  })).min(1),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type FoodOffer = typeof foodOffers.$inferSelect;
export type InsertFoodOffer = z.infer<typeof insertFoodOfferSchema>;
export type Request = typeof requests.$inferSelect;
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Rating = typeof ratings.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type Basket = typeof baskets.$inferSelect;
export type BasketItem = typeof basketItems.$inferSelect;
export type BasketContribution = typeof basketContributions.$inferSelect;
export type Delivery = typeof deliveries.$inferSelect;
export type CreateBasketInput = z.infer<typeof createBasketSchema>;
export type ContributeBasketInput = z.infer<typeof contributeBasketSchema>;
