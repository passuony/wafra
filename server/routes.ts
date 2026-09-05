import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { authenticate, authorize, generateToken } from "./middleware/auth";
import {
  loginSchema, registerSchema, insertFoodOfferSchema, insertRequestSchema,
  insertRatingSchema, insertContactMessageSchema,
  createBasketSchema, contributeBasketSchema,
  users, foodOffers, requests, deliveries, baskets, basketItems, basketContributions,
} from "@shared/schema";
import { log } from "./index";

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // ========================= HEALTH CHECK =========================
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), uptime: Math.floor(process.uptime()) });
  });

  // ========================= AUTH =========================

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "بيانات غير صالحة", errors: parsed.error.flatten() });

    const { email, password, name, role, phone, address } = parsed.data;
    const existing = await storage.getUserByEmail(email);
    if (existing) return res.status(409).json({ message: "البريد الإلكتروني مسجل مسبقاً" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await storage.createUser({ email, password: hashed, name, role: role ?? "restaurant", phone, address });

    await storage.log(user.id, "REGISTER", "users", user.id, `مستخدم جديد: ${name} (${role})`);

    await storage.createNotification(
      user.id,
      "success",
      "مرحباً بك في وفرة! 🎉",
      `شكراً لانضمامك يا ${name}. يمكنك الآن البدء في استخدام المنصة.`,
      undefined,
      "notification.welcomeUser",
      { name }
    );

    log(`[AUTH] New user registered: ${email} as ${role}`);
    const token = generateToken({ id: user.id, email: user.email, role: user.role, name: user.name });
    const { password: _, ...safeUser } = user;
    return res.status(201).json({ token, user: safeUser });
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "بيانات غير صالحة" });

    const { email, password } = parsed.data;
    const user = await storage.getUserByEmail(email);
    if (!user || !user.isActive) return res.status(401).json({ message: "بيانات الدخول غير صحيحة أو الحساب موقوف" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "بيانات الدخول غير صحيحة" });

    await storage.log(user.id, "LOGIN", "users", user.id, `تسجيل دخول: ${email}`);
    const token = generateToken({ id: user.id, email: user.email, role: user.role, name: user.name });
    const { password: _, ...safeUser } = user;
    return res.json({ token, user: safeUser });
  });

  app.get("/api/auth/me", authenticate, async (req: Request, res: Response) => {
    const user = await storage.getUserById(req.user!.id);
    if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });
    const { password: _, ...safeUser } = user;
    return res.json(safeUser);
  });

  app.put("/api/auth/profile", authenticate, async (req: Request, res: Response) => {
    const { name, phone, address } = req.body;
    const updated = await storage.updateUser(req.user!.id, { name, phone, address });
    const { password: _, ...safeUser } = updated;
    return res.json(safeUser);
  });

  // ========================= OFFERS =========================

  app.get("/api/offers", async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const { offers, total } = await storage.getAllAvailableOffers(page, limit);
    return res.json({ offers, total, page, limit, totalPages: Math.ceil(total / limit) });
  });

  app.get("/api/offers/my", authenticate, authorize("restaurant"), async (req: Request, res: Response) => {
    const offers = await storage.getOffersByRestaurant(req.user!.id);
    return res.json(offers);
  });

  app.post("/api/offers", authenticate, authorize("restaurant"), async (req: Request, res: Response) => {
    const parsed = insertFoodOfferSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "بيانات العرض غير صالحة", errors: parsed.error.flatten() });

    const offer = await storage.createOffer(req.user!.id, parsed.data);
    await storage.log(req.user!.id, "CREATE_OFFER", "food_offers", offer.id, `عرض جديد: ${offer.title}`);

    const allUsers = await storage.getAllUsers();
    const activeCharities = allUsers.filter(u => u.role === "charity" && u.isActive);
    await Promise.all(activeCharities.map(charity =>
      storage.createNotification(
        charity.id, "info",
        `🍽️ عرض جديد من ${req.user!.name}`,
        `"${offer.title}" — ${offer.quantity} ${offer.unit} · ${offer.pickupLocation}${offer.isUrgent ? " ⚡ عاجل" : ""}`,
        "/charities",
        "notification.newOfferFromRestaurant",
        {
          restaurantName: req.user!.name,
          offerTitle: offer.title,
          quantity: offer.quantity,
          unit: offer.unit,
          pickupLocation: offer.pickupLocation,
          urgent: offer.isUrgent ? " ⚡" : "",
        }
      )
    ));

    return res.status(201).json(offer);
  });

  app.put("/api/offers/:id", authenticate, authorize("restaurant"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const offer = await storage.getOfferById(id);
    if (!offer) return res.status(404).json({ message: "العرض غير موجود" });
    if (offer.restaurantId !== req.user!.id) return res.status(403).json({ message: "ليس لديك صلاحية لتعديل هذا العرض" });
    if (offer.status !== "available") return res.status(400).json({ message: "لا يمكن تعديل عرض غير متاح" });

    const updated = await storage.updateOffer(id, req.body);
    await storage.log(req.user!.id, "UPDATE_OFFER", "food_offers", id, `تحديث العرض: ${offer.title}`);
    return res.json(updated);
  });

  app.delete("/api/offers/:id", authenticate, authorize("restaurant"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const offer = await storage.getOfferById(id);
    if (!offer) return res.status(404).json({ message: "العرض غير موجود" });
    if (offer.restaurantId !== req.user!.id) return res.status(403).json({ message: "ليس لديك صلاحية" });
    if (offer.status !== "available") return res.status(400).json({ message: "لا يمكن حذف عرض محجوز أو مكتمل" });

    await storage.deleteOffer(id);
    await storage.log(req.user!.id, "DELETE_OFFER", "food_offers", id, `حذف العرض: ${offer.title}`);
    return res.json({ message: "تم حذف العرض بنجاح" });
  });

  // ========================= REQUESTS =========================

  app.get("/api/requests", authenticate, authorize("charity"), async (req: Request, res: Response) => {
    const reqs = await storage.getRequestsByCharity(req.user!.id);
    return res.json(reqs);
  });

  app.post("/api/requests", authenticate, authorize("charity"), async (req: Request, res: Response) => {
    const parsed = insertRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "بيانات الطلب غير صالحة" });

    const offer = await storage.getOfferById(parsed.data.offerId);
    if (!offer) return res.status(404).json({ message: "العرض غير موجود" });
    if (offer.status !== "available") return res.status(400).json({ message: "هذا العرض غير متاح للحجز" });

    await storage.updateOfferStatus(parsed.data.offerId, "reserved");
    const request = await storage.createRequest(req.user!.id, parsed.data);
    await storage.log(req.user!.id, "CREATE_REQUEST", "requests", request.id, `حجز العرض: ${offer.title}`);

    await storage.createNotification(
      offer.restaurantId, "info",
      "📦 طلب حجز جديد",
      `قامت جمعية "${req.user!.name}" بحجز عرضك "${offer.title}". يُرجى التجهيز للاستلام.`,
      "/restaurants",
      "notification.newReservationRequest",
      { charityName: req.user!.name, offerTitle: offer.title }
    );

    return res.status(201).json(request);
  });

  // ── STEP 1 (charity): Accept offer → create delivery for drivers ───────────────
  // POST /api/requests/:id/accept-by-charity
  // Transitions: request pending → waiting_for_delivery + delivery created (available)
  app.post("/api/requests/:id/accept-by-charity", authenticate, authorize("charity"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const result = await storage.acceptOfferByCharityAtomic(id, req.user!.id);
    if (!result) {
      const existing = await storage.getRequestById(id);
      if (!existing) return res.status(404).json({ message: "الطلب غير موجود" });
      if (existing.charityId !== req.user!.id) return res.status(403).json({ message: "ليس لديك صلاحية" });
      return res.status(400).json({ message: "لا يمكن قبول هذا الطلب — تحقق من حالته" });
    }

    const offer = await storage.getOfferById(result.request.offerId);
    const restaurant = offer ? await storage.getUserById(offer.restaurantId) : null;

    if (restaurant) {
      await storage.createNotification(
        restaurant.id, "info",
        "📦 تم قبول طلب الاستلام",
        `قامت جمعية "${req.user!.name}" بقبول العرض "${offer!.title}". سيتم تعيين مندوب توصيل قريباً.`,
        "/restaurants",
        "notification.charityAcceptedOffer",
        { charityName: req.user!.name, offerTitle: offer!.title }
      );
    }

    const allUsers = await storage.getAllUsers();
    const drivers = allUsers.filter(u => u.role === "delivery" && u.isActive);
    await Promise.all(drivers.map(d =>
      storage.createNotification(
        d.id, "info",
        "🚗 طلب توصيل جديد متاح",
        `توصيل من "${restaurant?.name ?? "مطعم"}" إلى "${req.user!.name}"`,
        "/delivery",
        "notification.newDeliveryAvailable",
        { restaurantName: restaurant?.name ?? "مطعم", charityName: req.user!.name }
      )
    ));

    await storage.log(req.user!.id, "ACCEPT_BY_CHARITY", "requests", id, "قبول العرض وإنشاء توصيل");
    return res.status(201).json(result);
  });

  // ── FINAL STEP (charity): Confirm receipt → complete request ────────────────
  // POST /api/requests/:id/confirm  (also PUT for backward compat)
  const handleConfirmRequest = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const result = await storage.confirmRequestByCharityAtomic(id, req.user!.id);
    if (!result) {
      const existing = await storage.getRequestById(id);
      if (!existing) return res.status(404).json({ message: "الطلب غير موجود" });
      if (existing.charityId !== req.user!.id) return res.status(403).json({ message: "ليس لديك صلاحية" });
      if (existing.status === "completed") return res.status(409).json({ message: "تم تأكيد الاستلام مسبقاً" });
      return res.status(400).json({ message: "لا يمكن التأكيد — يجب أن يُوصّل المندوب الطلب أولاً" });
    }

    const offer = await storage.getOfferById(result.request.offerId);

    if (result.delivery.deliveryPersonId) {
      await storage.createNotification(
        result.delivery.deliveryPersonId, "success",
        "✅ تم تأكيد الاستلام من الجمعية",
        "أكدت الجمعية استلام الطلب. اكتملت التوصيلة بنجاح. شكراً لك!",
        "/delivery",
        "notification.charityConfirmedReceiptDriver",
        {}
      );
    }
    if (offer) {
      await storage.createNotification(
        offer.restaurantId, "success",
        "✅ اكتمل التحويل",
        `أكدت الجمعية استلام عرضك "${offer.title}". اكتمل التحويل بنجاح.`,
        "/restaurants",
        "notification.transferCompletedForOffer",
        { offerTitle: offer.title }
      );
    }

    await storage.log(req.user!.id, "CONFIRM_REQUEST", "requests", id, "تأكيد استلام العرض — اكتمل الطلب");
    return res.json(result);
  };

  app.post("/api/requests/:id/confirm", authenticate, authorize("charity"), handleConfirmRequest);
  app.put("/api/requests/:id/confirm", authenticate, authorize("charity"), handleConfirmRequest);

  app.put("/api/requests/:id/cancel", authenticate, authorize("charity"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const request = await storage.getRequestById(id);
    if (!request) return res.status(404).json({ message: "الطلب غير موجود" });
    if (request.charityId !== req.user!.id) return res.status(403).json({ message: "ليس لديك صلاحية" });
    if (request.status !== "pending") return res.status(400).json({ message: "لا يمكن إلغاء هذا الطلب" });

    await storage.updateRequestStatus(id, "cancelled");
    const offer = await storage.getOfferById(request.offerId);
    await storage.updateOfferStatus(request.offerId, "available");
    await storage.log(req.user!.id, "CANCEL_REQUEST", "requests", id, `إلغاء الحجز`);

    if (offer) {
      await storage.createNotification(
        offer.restaurantId, "warning",
        "⚠️ تم إلغاء الحجز",
        `ألغت جمعية "${req.user!.name}" حجز العرض "${offer.title}". العرض متاح مجدداً.`,
        "/restaurants",
        "notification.reservationCancelled",
        { charityName: req.user!.name, offerTitle: offer.title }
      );
    }

    return res.json({ message: "تم إلغاء الحجز بنجاح" });
  });

  // ========================= NOTIFICATIONS =========================

  app.get("/api/notifications", authenticate, async (req: Request, res: Response) => {
    const notifs = await storage.getNotifications(req.user!.id);
    return res.json(notifs);
  });

  app.get("/api/notifications/unread-count", authenticate, async (req: Request, res: Response) => {
    const count = await storage.getUnreadCount(req.user!.id);
    return res.json({ count });
  });

  app.put("/api/notifications/:id/read", authenticate, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    await storage.markNotificationRead(id, req.user!.id);
    return res.json({ message: "تم التحديث" });
  });

  app.put("/api/notifications/read-all", authenticate, async (req: Request, res: Response) => {
    await storage.markAllNotificationsRead(req.user!.id);
    return res.json({ message: "تم التحديث" });
  });

  // ========================= RATINGS =========================

  // POST /api/ratings — multi-actor rating (normal offer request OR basket delivery)
  app.post("/api/ratings", authenticate, async (req: Request, res: Response) => {
    // Normalize the payload before Zod validation.
    // The frontend may send requestId + deliveryId together, null values, strings, or long comments.
    // Backend rule: send exactly ONE id. Offer ratings use requestId; basket-delivery ratings use deliveryId.
    const normalizePositiveId = (value: unknown): number | undefined => {
      if (value === null || value === undefined || value === "" || value === "null" || value === "undefined") {
        return undefined;
      }
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) && n > 0 ? Math.trunc(n) : undefined;
    };

    const raw = req.body ?? {};
    const normalizedBody: any = {
      requestId: normalizePositiveId(raw.requestId),
      deliveryId: normalizePositiveId(raw.deliveryId),
      toType: raw.toType ?? raw.targetType ?? raw.ratingTarget,
      rating: typeof raw.rating === "number" ? raw.rating : Number(raw.rating),
      comment:
        raw.comment === null || raw.comment === undefined || String(raw.comment).trim() === ""
          ? undefined
          : String(raw.comment).trim().slice(0, 500),
    };

    // If both ids arrive from the frontend, prefer requestId.
    // This fixes "Send exactly one of requestId or deliveryId" for normal offers.
    if (normalizedBody.requestId) {
      delete normalizedBody.deliveryId;
    } else if (!normalizedBody.deliveryId) {
      delete normalizedBody.requestId;
      delete normalizedBody.deliveryId;
    } else {
      delete normalizedBody.requestId;
    }

    const parsed = insertRatingSchema.safeParse(normalizedBody);
    if (!parsed.success) {
      console.error("Invalid rating payload:", { raw, normalizedBody }, parsed.error.flatten());
      return res.status(400).json({
        message: "بيانات التقييم غير صالحة: " + JSON.stringify(parsed.error.flatten().fieldErrors),
        errors: parsed.error.flatten(),
      });
    }

    const { requestId, deliveryId, toType, rating, comment } = parsed.data;

    const roleToActorType: Record<string, "restaurant" | "charity" | "delivery"> = {
      restaurant: "restaurant",
      charity: "charity",
      delivery: "delivery",
    };

    const fromType = roleToActorType[req.user!.role];
    if (!fromType) {
      return res.status(403).json({ message: "دورك لا يسمح بالتقييم" });
    }

    const fromId = req.user!.id;
    let toId: number;
    let logContext = "";

    if (requestId) {
      // Normal offer request rating.
      const request = await storage.getRequestById(requestId);
      if (!request) return res.status(404).json({ message: "الطلب غير موجود" });
      if (request.status !== "completed") {
        return res.status(400).json({ message: "يمكن التقييم فقط بعد اكتمال الطلب" });
      }

      // Validate the caller is actually related to the request.
      if (fromType === "charity" && request.charityId !== fromId) {
        return res.status(403).json({ message: "لست طرفاً في هذا الطلب" });
      }

      const offer = await storage.getOfferById(request.offerId);
      if (!offer) return res.status(400).json({ message: "العرض غير موجود" });

      if (fromType === "restaurant" && offer.restaurantId !== fromId) {
        return res.status(403).json({ message: "لست طرفاً في هذا الطلب" });
      }

      if (fromType === "delivery") {
        const deliveryList = await storage.getDeliveriesByCharity(request.charityId);
        const linked = deliveryList.find((d: any) => d.requestId === requestId && d.deliveryPersonId === fromId);
        if (!linked) return res.status(403).json({ message: "لست طرفاً في هذا التوصيل" });
      }

      if (toType === "delivery") {
        const deliveryList = await storage.getDeliveriesByCharity(request.charityId);
        const linked = deliveryList.find((d: any) => d.requestId === requestId && d.deliveryPersonId);
        if (!linked?.deliveryPersonId) return res.status(400).json({ message: "لم يتم تعيين مندوب لهذا الطلب" });
        toId = linked.deliveryPersonId;
      } else if (toType === "restaurant") {
        toId = offer.restaurantId;
      } else {
        toId = request.charityId;
      }

      logContext = `requestId=${requestId}`;
    } else {
      // Basket delivery rating. Basket deliveries usually have requestId = null,
      // so we rate by deliveryId instead.
      const delivery = await storage.getDeliveryById(deliveryId!);
      if (!delivery) return res.status(404).json({ message: "التوصيل غير موجود" });

      if (!["confirmed_by_delivery", "delivered", "completed"].includes(delivery.status)) {
        return res.status(400).json({ message: "يمكن التقييم فقط بعد اكتمال التوصيل" });
      }

      if (fromType === "restaurant" && delivery.restaurantId !== fromId) {
        return res.status(403).json({ message: "لست طرفاً في هذا التوصيل" });
      }
      if (fromType === "charity" && delivery.charityId !== fromId) {
        return res.status(403).json({ message: "لست طرفاً في هذا التوصيل" });
      }
      if (fromType === "delivery" && delivery.deliveryPersonId !== fromId) {
        return res.status(403).json({ message: "لست طرفاً في هذا التوصيل" });
      }

      if (toType === "delivery") {
        if (!delivery.deliveryPersonId) return res.status(400).json({ message: "لم يتم تعيين مندوب لهذا التوصيل" });
        toId = delivery.deliveryPersonId;
      } else if (toType === "charity") {
        toId = delivery.charityId;
      } else {
        if (!delivery.restaurantId) return res.status(400).json({ message: "لا يوجد مطعم مرتبط بهذا التوصيل" });
        toId = delivery.restaurantId;
      }

      logContext = `deliveryId=${deliveryId}`;
    }

    if (fromId === toId) {
      return res.status(400).json({ message: "لا يمكنك تقييم نفسك" });
    }

    const alreadyRated = typeof (storage as any).hasRatedFlexible === "function"
      ? await (storage as any).hasRatedFlexible({
          requestId: requestId ?? null,
          deliveryId: deliveryId ?? null,
          fromId,
          fromType,
          toId,
          toType,
        })
      : requestId
        ? await (storage as any).hasRated(requestId, fromId, fromType, toId, toType)
        : false;
    if (alreadyRated) {
      return res.status(409).json({ message: "لقد قيّمت هذا الطرف مسبقاً" });
    }

    const ratingRecord = await storage.createMultiRating(fromId, fromType, {
      requestId: requestId ?? null,
      deliveryId: deliveryId ?? null,
      toType,
      toId,
      rating,
      comment,
    });

    const toUser = await storage.getUserById(toId);
    if (toUser) {
      await storage.createNotification(
        toId,
        "success",
        `⭐ تقييم جديد — ${rating}/5`,
        comment
          ? `قيّمك "${req.user!.name}" بـ ${rating} نجوم. تعليق: ${comment}`
          : `قيّمك "${req.user!.name}" بـ ${rating} نجوم.`,
        undefined,
        comment ? "notification.newRatingWithComment" : "notification.newRating",
        { fromName: req.user!.name, rating, comment: comment ?? "" }
      );
    }

    await storage.log(fromId, "CREATE_RATING", "ratings", ratingRecord.id, `${logContext} ${fromType}→${toType} rating=${rating}`);
    return res.status(201).json(ratingRecord);
  });

  app.get("/api/ratings/request/:requestId", authenticate, async (req: Request, res: Response) => {
    const requestId = parseInt(req.params.requestId as string, 10);
    const ratingsList = await storage.getRatingsByRequest(requestId);
    return res.json(ratingsList);
  });

  app.get("/api/ratings/restaurant/:restaurantId", async (req: Request, res: Response) => {
    const restaurantId = parseInt(req.params.restaurantId as string, 10);
    const [ratingsList, avg] = await Promise.all([
      storage.getRestaurantRatings(restaurantId),
      storage.getRestaurantAvgRating(restaurantId),
    ]);
    return res.json({ ratings: ratingsList, avg });
  });

  // Ratings submitted by the current user.
  // Frontend uses this list to disable rating buttons after a successful rating.
  app.get("/api/ratings/given", authenticate, async (req: Request, res: Response) => {
    try {
      const roleToActorType: Record<string, "restaurant" | "charity" | "delivery"> = {
        restaurant: "restaurant",
        charity: "charity",
        delivery: "delivery",
      };

      const fromType = roleToActorType[req.user!.role];
      if (!fromType) {
        return res.json({ ratings: [], count: 0 });
      }

      const ratingsList = typeof (storage as any).getRatingsGivenByUser === "function"
        ? await (storage as any).getRatingsGivenByUser(req.user!.id, fromType)
        : [];

      return res.json({ ratings: ratingsList, count: ratingsList.length });
    } catch (err: any) {
      console.error("get given ratings error:", err);
      return res.status(500).json({ message: err.message || "Internal Server Error" });
    }
  });

  app.get("/api/ratings/user/:userId", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId as string, 10);
      if (!Number.isFinite(userId) || userId <= 0) {
        return res.status(400).json({ message: "Invalid user id" });
      }

      const toType = req.query.type as string | undefined;

      const [ratingsList, avg] = await Promise.all([
        storage.getRatingsForUser(userId, toType),
        storage.getAvgRatingForUser(userId, toType),
      ]);

      const relatedUserIds = Array.from(
        new Set(
          ratingsList
            .flatMap((rating: any) => [rating.fromId, rating.toId])
            .filter((id: any) => typeof id === "number" && Number.isFinite(id))
        )
      );

      const usersById = new Map<number, any>();

      await Promise.all(
        relatedUserIds.map(async (id) => {
          const user = await storage.getUserById(id);
          if (user) {
            usersById.set(id, {
              id: user.id,
              name: user.name,
              role: user.role,
              email: user.email,
            });
          }
        })
      );

      const enrichedRatings = ratingsList.map((rating: any) => {
        const fromUser = usersById.get(rating.fromId) ?? null;
        const toUser = usersById.get(rating.toId) ?? null;

        return {
          ...rating,
          fromName: fromUser?.name ?? null,
          toName: toUser?.name ?? null,
          fromUser,
          toUser,
        };
      });

      return res.json({ ratings: enrichedRatings, avg });
    } catch (err: any) {
      console.error("get user ratings error:", err);
      return res.status(500).json({ message: err.message || "Internal Server Error" });
    }
  });

  // ========================= CONTACT =========================

  app.post("/api/contact", async (req: Request, res: Response) => {
    const parsed = insertContactMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "بيانات غير صالحة" });

    const msg = await storage.createContactMessage(parsed.data);

    const allUsers = await storage.getAllUsers();
    const admins = allUsers.filter(u => u.role === "admin");
    for (const admin of admins) {
      await storage.createNotification(
        admin.id, "info",
        `✉️ رسالة جديدة من ${parsed.data.name}`,
        `الموضوع: ${parsed.data.subject} — ${parsed.data.message.substring(0, 100)}`,
        "/admin",
        "notification.newContactMessage",
        { name: parsed.data.name, subject: parsed.data.subject, message: parsed.data.message.substring(0, 100) }
      );
    }

    return res.status(201).json({ message: "تم إرسال رسالتك بنجاح", id: msg.id });
  });

  // ========================= ADMIN =========================

  app.get("/api/admin/users", authenticate, authorize("admin"), async (req: Request, res: Response) => {
    const allUsers = await storage.getAllUsers();
    return res.json(allUsers.map(({ password: _, ...u }) => u));
  });

  app.put("/api/admin/users/:id/status", authenticate, authorize("admin"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    const { isActive } = req.body;
    const updated = await storage.updateUserStatus(id, isActive);
    await storage.log(req.user!.id, isActive ? "ACTIVATE_USER" : "DEACTIVATE_USER", "users", id);

    await storage.createNotification(
      id,
      isActive ? "success" : "warning",
      isActive ? "✅ تم تفعيل حسابك" : "⚠️ تم إيقاف حسابك",
      isActive
        ? "تم تفعيل حسابك من قِبل الإدارة. يمكنك الآن استخدام المنصة."
        : "تم إيقاف حسابك مؤقتاً من قِبل الإدارة. يُرجى التواصل معنا.",
      "/contact",
      isActive ? "notification.accountActivated" : "notification.accountDeactivated",
      {}
    );

    const { password: _, ...safeUser } = updated;
    return res.json(safeUser);
  });

  app.get("/api/admin/offers", authenticate, authorize("admin"), async (req: Request, res: Response) => {
    const offers = await storage.getAllOffers();
    return res.json(offers);
  });

  app.get("/api/admin/requests", authenticate, authorize("admin"), async (_req: Request, res: Response) => {
    const rows = await db.select().from(requests).orderBy(desc(requests.createdAt));
    return res.json(rows);
  });


  app.get("/api/admin/baskets", authenticate, authorize("admin"), async (_req: Request, res: Response) => {
    const rows = await db
      .select({
        basket: baskets,
        charity: {
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          address: users.address,
        },
      })
      .from(baskets)
      .leftJoin(users, eq(baskets.charityId, users.id))
      .orderBy(desc(baskets.createdAt));

    const result = [];
    for (const row of rows) {
      const items = await db.select().from(basketItems).where(eq(basketItems.basketId, row.basket.id));
      const contributions = await db
        .select({ contribution: basketContributions, restaurant: { id: users.id, name: users.name, email: users.email } })
        .from(basketContributions)
        .leftJoin(users, eq(basketContributions.restaurantId, users.id))
        .where(eq(basketContributions.basketId, row.basket.id));

      result.push({
        ...row.basket,
        charity: row.charity,
        items,
        contributions,
        totalRequested: items.reduce((sum: number, item: any) => sum + Number(item.requestedQty || 0), 0),
        totalFulfilled: items.reduce((sum: number, item: any) => sum + Number(item.fulfilledQty || 0), 0),
      });
    }

    return res.json(result);
  });

  app.get("/api/admin/stats", authenticate, authorize("admin"), async (_req: Request, res: Response) => {
    const [stats, unreadMessages, basketRows] = await Promise.all([
      storage.getStats(),
      storage.getUnreadMessagesCount(),
      db.select().from(baskets),
    ]);

    const totalBaskets = basketRows.length;
    const completedBaskets = basketRows.filter((b: any) => b.status === "completed").length;

    return res.json({
      ...stats,
      totalBaskets,
      completedBaskets,
      unreadMessages,
    });
  });

  app.get("/api/admin/logs", authenticate, authorize("admin"), async (req: Request, res: Response) => {
    const logs = await storage.getActivityLogs();
    return res.json(logs);
  });

  app.get("/api/admin/messages", authenticate, authorize("admin"), async (req: Request, res: Response) => {
    const messages = await storage.getContactMessages();
    return res.json(messages);
  });

  app.put("/api/admin/messages/:id/read", authenticate, authorize("admin"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    await storage.markMessageRead(id);
    return res.json({ message: "تم التحديث" });
  });

  app.get("/api/admin/deliveries", authenticate, authorize("admin"), async (_req: Request, res: Response) => {
    const list = await storage.getAllDeliveries();
    return res.json(list);
  });

  app.get("/api/admin/most-active", authenticate, authorize("admin"), async (_req: Request, res: Response) => {
    const [allUsers, allOffers, allRequests, allDeliveries, allBaskets, allContributions] = await Promise.all([
      storage.getAllUsers(),
      storage.getAllOffers(),
      db.select().from(requests),
      storage.getAllDeliveries(),
      db.select().from(baskets),
      db.select().from(basketContributions),
    ]);

    const restaurants = allUsers.filter((u: any) => u.role === "restaurant");
    const charities = allUsers.filter((u: any) => u.role === "charity");
    const drivers = allUsers.filter((u: any) => u.role === "delivery");

    const restaurantStats = restaurants
      .map((user: any) => {
        const offersCount = allOffers.filter((offer: any) => offer.restaurantId === user.id).length;
        const basketContributionsCount = allContributions.filter((c: any) => c.restaurantId === user.id).length;
        const completedOffersCount = allOffers.filter((offer: any) => offer.restaurantId === user.id && offer.status === "completed").length;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          offers: offersCount,
          basketContributions: basketContributionsCount,
          completedOffers: completedOffersCount,
          total: offersCount + basketContributionsCount,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const charityStats = charities
      .map((user: any) => {
        const acceptedOffers = allRequests.filter((req: any) => req.charityId === user.id).length;
        const completedAcceptedOffers = allRequests.filter((req: any) => req.charityId === user.id && req.status === "completed").length;
        const basketsCreated = allBaskets.filter((basket: any) => basket.charityId === user.id).length;
        const completedBaskets = allBaskets.filter((basket: any) => basket.charityId === user.id && basket.status === "completed").length;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          acceptedOffers,
          completedAcceptedOffers,
          basketsCreated,
          completedBaskets,
          total: acceptedOffers + basketsCreated,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const deliveryStats = drivers
      .map((user: any) => {
        const assigned = allDeliveries.filter((d: any) => d.deliveryPersonId === user.id).length;
        const completed = allDeliveries.filter((d: any) =>
          d.deliveryPersonId === user.id && ["confirmed_by_delivery", "delivered", "completed"].includes(d.status)
        ).length;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          assignedDeliveries: assigned,
          completedDeliveries: completed,
          total: completed,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return res.json({
      restaurants: restaurantStats,
      charities: charityStats,
      delivery: deliveryStats,
    });
  });

  // ========================= BASKETS =========================

  app.get("/api/baskets", authenticate, async (req: Request, res: Response) => {
    if (!["restaurant", "charity", "admin"].includes(req.user!.role)) {
      return res.status(403).json({ message: "ليس لديك صلاحية" });
    }
    const list = await storage.getAllOpenBaskets();
    return res.json(list);
  });

  app.get("/api/baskets/my", authenticate, authorize("charity"), async (req: Request, res: Response) => {
    const list = await storage.getBasketsByCharity(req.user!.id);
    return res.json(list);
  });

  app.get("/api/baskets/my-contributions", authenticate, authorize("restaurant"), async (req: Request, res: Response) => {
    const list = await storage.getContributionsByRestaurant(req.user!.id);
    return res.json(list);
  });

  app.get("/api/baskets/:id", authenticate, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    if (!id) return res.status(400).json({ message: "معرف غير صالح" });

    const basket = await storage.getBasketWithDetails(id);
    if (!basket) return res.status(404).json({ message: "السلة غير موجودة" });

    const role = req.user!.role;
    const isOwner = role === "charity" && basket.charityId === req.user!.id;
    const isRestaurant = role === "restaurant";
    const isAdmin = role === "admin";
    if (!isOwner && !isRestaurant && !isAdmin) {
      return res.status(403).json({ message: "ليس لديك صلاحية" });
    }
    return res.json(basket);
  });

  app.post("/api/baskets", authenticate, authorize("charity"), async (req: Request, res: Response) => {
    const parsed = createBasketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "بيانات السلة غير صالحة", errors: parsed.error.flatten() });
    }
    if (parsed.data.expiresAt <= new Date()) {
      return res.status(400).json({ message: "تاريخ الانتهاء يجب أن يكون في المستقبل" });
    }

    const basket = await storage.createBasket(req.user!.id, parsed.data);

    const allUsers = await storage.getAllUsers();
    const restaurants = allUsers.filter(u => u.role === "restaurant" && u.isActive);
    await Promise.all(restaurants.map(r =>
      storage.createNotification(
        r.id, "info",
        "🛒 طلب سلة جديد من جمعية",
        `"${basket.title}" - ${parsed.data.items.length} منتجات مطلوبة. ساهم بما لديك!`,
        "/restaurant/baskets",
        "notification.newBasketRequest",
        { basketTitle: basket.title, itemsCount: parsed.data.items.length }
      )
    ));

    await storage.log(req.user!.id, "CREATE_BASKET", "baskets", basket.id, `سلة جديدة: ${basket.title}`);
    return res.status(201).json(basket);
  });

  app.post("/api/baskets/:id/contribute", authenticate, authorize("restaurant"), async (req: Request, res: Response) => {
    const basketId = parseInt(req.params.id as string, 10);
    if (!basketId) return res.status(400).json({ message: "معرف غير صالح" });

    const parsed = contributeBasketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "بيانات المساهمة غير صالحة" });
    }

    // Pre-check basket existence so we can return a friendlier 404/409 instead of a generic 400.
    const basket = await storage.getBasketById(basketId);
    if (!basket) return res.status(404).json({ message: "السلة غير موجودة" });
    if (basket.status !== "open" && basket.status !== "partial") {
      return res.status(409).json({ message: "السلة مغلقة أو مكتملة" });
    }
    if (basket.expiresAt < new Date()) {
      return res.status(400).json({ message: "انتهت صلاحية هذه السلة" });
    }

    const result = await storage.contributeToBasketAtomic(
      basketId,
      req.user!.id,
      parsed.data.contributions,
    );

    if (!result) {
      return res.status(409).json({
        message: "لم يتم تطبيق أي مساهمة. قد تكون السلة مكتملة أو الكميات المطلوبة قد تم تغطيتها بالفعل.",
      });
    }

    const restaurant = await storage.getUserById(req.user!.id);
    await storage.createNotification(
      basket.charityId, "info",
      "🎁 مساهمة جديدة في سلتك",
      `${restaurant?.name} ساهم في "${basket.title}" - اكتمل ${result.completion}%`,
      "/charity/baskets",
      "notification.newBasketContribution",
      { restaurantName: restaurant?.name || "", basketTitle: basket.title, completion: result.completion }
    );

    // If THIS contribution is the one that completed the basket, auto-create
    // one delivery per contributing restaurant so drivers can pick them up.
    const justCompleted = (basket.status === "open" || basket.status === "partial") && result.basket.status === "completed";
    if (justCompleted) {
      const createdDeliveries = await storage.createDeliveriesForBasket(basketId);

      await storage.createNotification(
        basket.charityId, "success",
        "🎉 اكتملت سلتك!",
        `سلة "${basket.title}" اكتملت بنسبة 100%. تم إرسال ${createdDeliveries.length} طلب توصيل للمندوبين.`,
        "/charity/deliveries",
        "notification.basketCompleted",
        { basketTitle: basket.title, deliveriesCount: createdDeliveries.length }
      );

      // Notify all active drivers that new deliveries are available.
      if (createdDeliveries.length > 0) {
        const allUsers = await storage.getAllUsers();
        const drivers = allUsers.filter(u => u.role === "delivery" && u.isActive);
        await Promise.all(drivers.map(d =>
          storage.createNotification(
            d.id, "info",
            "🚗 طلبات توصيل جديدة من سلة",
            `سلة "${basket.title}" — ${createdDeliveries.length} استلام متاح للتوصيل`,
            "/delivery",
            "notification.newBasketDeliveries",
            { basketTitle: basket.title, deliveriesCount: createdDeliveries.length }
          )
        ));
      }
    }

    await storage.log(req.user!.id, "BASKET_CONTRIBUTION", "basket_contributions", basketId, `مساهمة في: ${basket.title}`);

    return res.status(201).json({
      contributions: result.contributions,
      basket: result.basket,
      completion: result.completion,
      applied: result.applied,
    });
  });

  app.put("/api/baskets/:id/cancel", authenticate, authorize("charity"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    if (!id) return res.status(400).json({ message: "معرف غير صالح" });

    const basket = await storage.getBasketById(id);
    if (!basket) return res.status(404).json({ message: "السلة غير موجودة" });
    if (basket.charityId !== req.user!.id) return res.status(403).json({ message: "ليس لديك صلاحية" });
    if (basket.status === "completed") return res.status(400).json({ message: "لا يمكن إلغاء سلة مكتملة" });

    await storage.updateBasketStatus(id, "cancelled");

    const contributors = await storage.getBasketContributors(id);
    await Promise.all(contributors.map(restaurantId =>
      storage.createNotification(
        restaurantId, "warning",
        "❌ تم إلغاء السلة",
        `الجمعية ألغت سلة "${basket.title}". شكراً لمساهمتك.`,
        "/restaurant/baskets",
        "notification.basketCancelled",
        { basketTitle: basket.title }
      )
    ));

    await storage.log(req.user!.id, "CANCEL_BASKET", "baskets", id, `إلغاء سلة: ${basket.title}`);
    return res.json({ message: "تم إلغاء السلة" });
  });

  app.get("/api/baskets/:id/contributions", authenticate, authorize("charity"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    if (!id) return res.status(400).json({ message: "معرف غير صالح" });

    const basket = await storage.getBasketById(id);
    if (!basket || basket.charityId !== req.user!.id) {
      return res.status(403).json({ message: "ليس لديك صلاحية" });
    }

    const list = await storage.getContributionsByBasket(id);
    return res.json(list);
  });

  // ========================= DELIVERIES =========================

  app.get("/api/deliveries", authenticate, authorize("delivery"), async (_req: Request, res: Response) => {
    const list = await storage.getAvailableDeliveries();
    return res.json(list);
  });

  app.get("/api/deliveries/my", authenticate, authorize("delivery"), async (req: Request, res: Response) => {
    const list = await storage.getDeliveriesByDriver(req.user!.id);
    return res.json(list);
  });

  app.get("/api/deliveries/stats", authenticate, authorize("delivery"), async (req: Request, res: Response) => {
    const stats = await storage.getDriverStats(req.user!.id);
    return res.json(stats);
  });

  // ── DELIVERY WORKFLOW — driver step-by-step ─────────────────────────────────

  // STEP 1: Driver accepts delivery (available → accepted)
  app.put("/api/deliveries/:id/accept", authenticate, authorize("delivery"), async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    if (!id) return res.status(400).json({ message: "معرف غير صالح" });

    const updated = await storage.acceptDeliveryIfAvailable(id, req.user!.id);
    if (!updated) {
      const existing = await storage.getDeliveryById(id);
      if (!existing) return res.status(404).json({ message: "طلب التوصيل غير موجود" });
      return res.status(409).json({ message: "هذا الطلب تم قبوله بالفعل" });
    }

    await storage.createNotification(
      updated.charityId, "info",
      "🚗 تم تعيين مندوب — المندوب في طريقه للمطعم",
      `${req.user!.name} قبل طلب التوصيل وهو في الطريق إلى المطعم`,
      "/charity/deliveries",
      "notification.driverAssignedHeadingRestaurant",
      { driverName: req.user!.name }
    );
    if (updated.restaurantId) {
      await storage.createNotification(
        updated.restaurantId, "info",
        "🚗 مندوب في طريقه إليك",
        `${req.user!.name} سيستلم الطلب منك قريباً. يُرجى التجهيز.`,
        "/restaurants",
        "notification.driverComingToRestaurant",
        { driverName: req.user!.name }
      );
    }
    await storage.log(req.user!.id, "ACCEPT_DELIVERY", "deliveries", id, "قبول طلب توصيل");
    return res.json(updated);
  });

  // STEP 2: Driver going to restaurant (accepted → going_to_restaurant)
  const handleGoToRestaurant = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    if (!id) return res.status(400).json({ message: "معرف غير صالح" });

    const updated = await storage.goToRestaurantAtomic(id, req.user!.id);
    if (!updated) {
      const existing = await storage.getDeliveryById(id);
      if (!existing) return res.status(404).json({ message: "غير موجود" });
      if (existing.deliveryPersonId !== req.user!.id) return res.status(403).json({ message: "ليس طلبك" });
      return res.status(400).json({ message: "يجب قبول الطلب أولاً قبل التوجه للمطعم" });
    }

    if (updated.restaurantId) {
      await storage.createNotification(
        updated.restaurantId, "info",
        "🏃 المندوب في الطريق إليك",
        "مندوب التوصيل يتجه نحو مطعمك الآن. يُرجى تجهيز الطلب.",
        "/restaurants",
        "notification.driverHeadingRestaurant",
        {}
      );
    }
    await storage.createNotification(
      updated.charityId, "info",
      "🚗 المندوب في طريقه للمطعم",
      "المندوب يتجه لاستلام طلبك من المطعم",
      "/charity/deliveries",
      "notification.driverHeadingToPickup",
      {}
    );
    await storage.log(req.user!.id, "GO_TO_RESTAURANT", "deliveries", id, "المندوب في طريقه للمطعم");
    return res.json(updated);
  };
  app.post("/api/deliveries/:id/go-to-restaurant", authenticate, authorize("delivery"), handleGoToRestaurant);
  app.put("/api/deliveries/:id/go-to-restaurant", authenticate, authorize("delivery"), handleGoToRestaurant);

  // STEP 3a: Driver confirms arrived at restaurant (going_to_restaurant → waiting_for_restaurant_confirmation)
  const handlePickup = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    if (!id) return res.status(400).json({ message: "معرف غير صالح" });

    const updated = await storage.deliveryPickupAtomic(id, req.user!.id);
    if (!updated) {
      const existing = await storage.getDeliveryById(id);
      if (!existing) return res.status(404).json({ message: "غير موجود" });
      if (existing.deliveryPersonId !== req.user!.id) return res.status(403).json({ message: "ليس طلبك" });
      return res.status(400).json({ message: "يجب التوجه للمطعم أولاً قبل تأكيد الاستلام" });
    }

    // Notify restaurant that driver is waiting for their confirmation
    if (updated.restaurantId) {
      const driver = await storage.getUserById(req.user!.id);
      await storage.createNotification(
        updated.restaurantId, "info",
        "🚚 المندوب وصل — يرجى تأكيد التسليم",
        `المندوب ${driver?.name || ""} وصل لاستلام الطلب، يرجى تأكيد التسليم`,
        "/restaurants",
        "notification.driverArrivedWaitingRestaurant",
        { driverName: driver?.name || "" }
      );
    }
    await storage.log(req.user!.id, "PICKUP_DELIVERY", "deliveries", id, "المندوب وصل للمطعم وينتظر التأكيد");
    return res.json(updated);
  };
  app.put("/api/deliveries/:id/pickup", authenticate, authorize("delivery"), handlePickup);
  app.post("/api/deliveries/:id/pickup", authenticate, authorize("delivery"), handlePickup);

  // STEP 3b: Restaurant confirms handoff to driver (waiting_for_restaurant_confirmation → picked_up)
  app.put("/api/deliveries/:id/restaurant-confirm", authenticate, authorize("restaurant"), async (req, res) => {
    const id = parseInt(req.params.id as string, 10);
    if (!id) return res.status(400).json({ message: "معرف غير صالح" });

    const updated = await storage.restaurantConfirmPickupAtomic(id, req.user!.id);
    if (!updated) {
      const existing = await storage.getDeliveryById(id);
      if (!existing) return res.status(404).json({ message: "غير موجود" });
      if (existing.restaurantId !== req.user!.id) return res.status(403).json({ message: "ليس طلبك" });
      return res.status(400).json({ message: "التوصيل لا يتطلب تأكيداً الآن" });
    }

    const restaurant = await storage.getUserById(req.user!.id);
    // Notify driver that restaurant confirmed handoff
    if (updated.deliveryPersonId) {
      await storage.createNotification(
        updated.deliveryPersonId, "success",
        "✅ أكد المطعم التسليم — توجه للجمعية",
        `أكد مطعم ${restaurant?.name || ""} تسليم الطلب. يمكنك الآن التوجه للجمعية`,
        "/delivery",
        "notification.restaurantConfirmedHandoff",
        { restaurantName: restaurant?.name || "" }
      );
    }
    // Notify charity that food is on its way
    await storage.createNotification(
      updated.charityId, "info",
      "📦 الطلب في الطريق إليك",
      "تأكد المطعم من تسليم الطعام للمندوب، وهو الآن في طريقه إليك",
      "/charity/deliveries",
      "notification.foodPickedUpHeadingToCharity",
      {}
    );
    await storage.log(req.user!.id, "RESTAURANT_CONFIRM_PICKUP", "deliveries", id, "تأكيد المطعم لتسليم الطلب للمندوب");
    return res.json(updated);
  });

  // GET deliveries pending restaurant confirmation
  app.get("/api/deliveries/restaurant-pending", authenticate, authorize("restaurant"), async (req, res) => {
    const pending = await storage.getDeliveriesPendingRestaurantConfirm(req.user!.id);
    return res.json(pending);
  });

  // GET all deliveries related to the authenticated restaurant
  // Required by client/src/pages/restaurants.tsx for completed offer/basket rating.
  app.get("/api/deliveries/restaurant", authenticate, authorize("restaurant"), async (req: Request, res: Response) => {
    try {
      const list = await storage.getDeliveriesByRestaurant(req.user!.id);
      return res.json(list);
    } catch (err: any) {
      console.error("get restaurant deliveries error:", err);
      return res.status(500).json({ message: err.message || "Internal Server Error" });
    }
  });

  // STEP 4: Driver heading to charity (picked_up → going_to_charity)
  const handleGoToCharity = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    if (!id) return res.status(400).json({ message: "معرف غير صالح" });

    const updated = await storage.goToCharityAtomic(id, req.user!.id);
    if (!updated) {
      const existing = await storage.getDeliveryById(id);
      if (!existing) return res.status(404).json({ message: "غير موجود" });
      if (existing.deliveryPersonId !== req.user!.id) return res.status(403).json({ message: "ليس طلبك" });
      return res.status(400).json({ message: "يجب تأكيد الاستلام من المطعم أولاً" });
    }

    await storage.createNotification(
      updated.charityId, "info",
      "🚗 المندوب في طريقه إليك",
      "المندوب يتجه نحو مكانك الآن. يُرجى الاستعداد للاستلام.",
      "/charity/deliveries",
      "notification.driverHeadingToCharity",
      {}
    );
    await storage.log(req.user!.id, "GO_TO_CHARITY", "deliveries", id, "المندوب في طريقه للجمعية");
    return res.json(updated);
  };
  app.post("/api/deliveries/:id/go-to-charity", authenticate, authorize("delivery"), handleGoToCharity);
  app.put("/api/deliveries/:id/go-to-charity", authenticate, authorize("delivery"), handleGoToCharity);

  // STEP 5: Driver arrives at charity (going_to_charity → arrived)
  // ⛔ After this point, driver CANNOT confirm until charity confirms first.
  const handleArriveAtCharity = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    if (!id) return res.status(400).json({ message: "معرف غير صالح" });

    const updated = await storage.arriveAtCharityAtomic(id, req.user!.id);
    if (!updated) {
      const existing = await storage.getDeliveryById(id);
      if (!existing) return res.status(404).json({ message: "غير موجود" });
      if (existing.deliveryPersonId !== req.user!.id) return res.status(403).json({ message: "ليس طلبك" });
      return res.status(400).json({ message: "يجب التوجه للجمعية أولاً قبل تأكيد الوصول" });
    }

    await storage.createNotification(
      updated.charityId, "info",
      "🔔 المندوب وصل — يُرجى تأكيد الاستلام",
      "وصل المندوب إلى مكانك. الرجاء فتح صفحة التوصيلات وتأكيد الاستلام أولاً لإتمام العملية.",
      "/charity/deliveries",
      "notification.driverArrivedCharityConfirmReceipt",
      {}
    );
    if (updated.restaurantId) {
      await storage.createNotification(updated.restaurantId, "info",
        "📦 المندوب وصل للجمعية",
        "وصل المندوب إلى الجمعية وبانتظار تأكيد الاستلام.",
        "/restaurants",
        "notification.driverArrivedAtCharityRestaurant",
        {}
      );
    }
    await storage.log(req.user!.id, "ARRIVE_AT_CHARITY", "deliveries", id, "المندوب وصل — انتظار تأكيد الجمعية");
    return res.json(updated);
  };
  app.post("/api/deliveries/:id/arrive", authenticate, authorize("delivery"), handleArriveAtCharity);
  app.post("/api/deliveries/:id/complete", authenticate, authorize("delivery"), handleArriveAtCharity); // alias
  app.put("/api/deliveries/:id/deliver", authenticate, authorize("delivery"), handleArriveAtCharity);   // backward compat

  // STEP 7: Driver confirms delivery — ONLY allowed after charity has confirmed receipt
  const handleDriverConfirm = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    if (!id) return res.status(400).json({ message: "معرف غير صالح" });

    const existing = await storage.getDeliveryById(id);
    if (!existing) return res.status(404).json({ message: "غير موجود" });
    if (existing.deliveryPersonId !== req.user!.id) return res.status(403).json({ message: "ليس طلبك" });
    // ⛔ CRITICAL GUARD
    if (!existing.charityConfirmedAt) {
      return res.status(403).json({ message: "⛔ لا يمكنك تأكيد التوصيل — يجب على الجمعية تأكيد الاستلام أولاً" });
    }

    const updated = await storage.driverConfirmDeliveryAtomic(id, req.user!.id);
    if (!updated) return res.status(400).json({ message: "لا يمكن تأكيد التوصيل في الحالة الحالية" });

    await storage.createNotification(
      updated.charityId, "success",
      "✅ اكتمل التوصيل",
      "أكد المندوب التوصيل. اكتمل الطلب بنجاح! يمكنك الآن تقييم المندوب والمطعم.",
      "/charity/deliveries",
      "notification.deliveryCompletedCharity",
      {}
    );
    if (updated.restaurantId) {
      await storage.createNotification(updated.restaurantId, "success",
        "✅ اكتمل التحويل",
        "اكتمل الطلب بنجاح. يمكنك تقييم الجمعية والمندوب.",
        "/restaurants",
        "notification.deliveryCompletedRestaurant",
        {}
      );
    }
    await storage.log(req.user!.id, "DRIVER_CONFIRM_DELIVERY", "deliveries", id, "تأكيد التوصيل من المندوب — الطلب مكتمل");
    return res.json(updated);
  };
  app.post("/api/deliveries/:id/confirm", authenticate, authorize("delivery"), handleDriverConfirm);
  app.put("/api/deliveries/:id/confirm", authenticate, authorize("delivery"), handleDriverConfirm);

  // Charity-side: list & confirm-receipt for the deliveries assigned to this charity.
  app.get("/api/deliveries/charity", authenticate, authorize("charity"), async (req: Request, res: Response) => {
    const list = await storage.getDeliveriesByCharity(req.user!.id);
    return res.json(list);
  });

  // ── STEP 6 (charity): Confirm receipt of delivery
  // Transitions delivery: arrived → waiting_for_delivery_confirmation
  // Transitions request: arrived → charity_confirmedz
  // After this, driver is unblocked to perform the final confirm.
  const handleCharityConfirmReceipt = async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    if (!id) return res.status(400).json({ message: "معرف غير صالح" });

    const updated = await storage.charityConfirmReceiptAtomic(id, req.user!.id);
    if (!updated) {
      const existing = await storage.getDeliveryById(id);
      if (!existing) return res.status(404).json({ message: "غير موجود" });
      if (existing.charityId !== req.user!.id) return res.status(403).json({ message: "ليس طلبك" });
      if (existing.charityConfirmedAt) return res.status(409).json({ message: "تم تأكيد الاستلام مسبقاً" });
      return res.status(400).json({ message: "لم يصل المندوب بعد — يجب أن يصل المندوب أولاً" });
    }

    // Notify driver: they can now confirm their side
    if (updated.deliveryPersonId) {
      await storage.createNotification(
        updated.deliveryPersonId, "success",
        "✅ الجمعية أكدت الاستلام — يمكنك الآن تأكيد التوصيل",
        "أكدت الجمعية استلام الطلب. يمكنك الآن الضغط على زر \"تأكيد التوصيل\" لإغلاق الطلب.",
        "/delivery",
        "notification.charityConfirmedDriverCanClose",
        {}
      );
    }

    await storage.log(req.user!.id, "CHARITY_CONFIRM_RECEIPT", "deliveries", id, "تأكيد استلام التوصيل من الجمعية");
    return res.json(updated);
  };
  app.put("/api/deliveries/:id/confirm-receipt", authenticate, authorize("charity"), handleCharityConfirmReceipt);
  app.post("/api/deliveries/:id/confirm-receipt", authenticate, authorize("charity"), handleCharityConfirmReceipt);

  return httpServer;
}