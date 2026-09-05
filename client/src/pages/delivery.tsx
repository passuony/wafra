import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { useLanguage } from "@/components/LanguageProvider";
import DeliveryMap from "@/components/DeliveryMap";
import {
  Truck, MapPin, Package, CheckCircle, Clock, TrendingUp,
  Navigation, Map as MapIcon, Store, MoveRight, Lock, Star, HeartHandshake,
} from "lucide-react";

type ActionKey = "accept" | "go-to-restaurant" | "pickup" | "go-to-charity" | "arrive" | "confirm";

const ACTIVE_STATUSES = ["accepted", "going_to_restaurant", "waiting_for_restaurant_confirmation", "picked_up", "going_to_charity", "arrived", "waiting_for_charity_confirmation", "waiting_for_delivery_confirmation"];
const DONE_STATUSES = ["confirmed_by_delivery", "delivered"];

export default function DeliveryPage() {
  const { t, dir } = useLanguage();
  const d = t.delivery;
  const ds = t.deliveryStatuses;
  const r = t.ratings;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const user = getUser();

  const [tab, setTab] = useState<"available" | "my" | "stats" | "ratings">("available");
  const [available, setAvailable] = useState<any[]>([]);
  const [myDeliveries, setMy] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [mapDelivery, setMapDelivery] = useState<any | null>(null);

  const [ratingDialog, setRatingDialog] = useState<{ open: boolean; delivery: any } | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingTarget, setRatingTarget] = useState<"restaurant" | "charity">("restaurant");
  const [ratingLoading, setRatingLoading] = useState(false);

  const [reviewsTab, setReviewsTab] = useState<"restaurant" | "charity">("restaurant");
  const [myRestaurantReviews, setMyRestaurantReviews] = useState<any[]>([]);
  const [myCharityReviews, setMyCharityReviews] = useState<any[]>([]);
  const [givenRatings, setGivenRatings] = useState<any[]>([]);

  const [fullMessage, setFullMessage] = useState<{ title: string; message: string } | null>(null);

  const readMoreLabel = (t as any).common?.readMore ?? "Read more";
  const fullMessageTitle = (t as any).common?.fullMessage ?? "Full message";

  const renderExpandableText = (value: unknown, className = "text-sm text-muted-foreground break-all leading-relaxed", limit = 120) => {
    const text = String(value ?? "");
    if (!text.trim()) return null;

    const isLong = text.length > limit;
    const preview = isLong ? `${text.slice(0, limit).trim()}...` : text;

    return (
      <p className={className}>
        <span className="whitespace-pre-wrap break-all">{preview}</span>
        {isLong && (
          <button
            type="button"
            className="ms-2 text-primary font-bold hover:underline"
            onClick={(event) => {
              event.stopPropagation();
              setFullMessage({ title: fullMessageTitle, message: text });
            }}
          >
            {readMoreLabel}
          </button>
        )}
      </p>
    );
  };

  useEffect(() => {
    if (!user || user.role !== "delivery") { setLocation("/login"); return; }
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [avail, my, st, ratingRes, given] = await Promise.all([
        api.deliveries.getAll(),
        api.deliveries.getMy(),
        api.deliveries.getStats(),
        api.ratings.getByUser(user!.id, "delivery"),
        api.ratings.getGiven().catch(() => ({ ratings: [] })),
      ]);

      const allDriverRatings = ratingRes?.ratings || [];

      setAvailable(avail);
      setMy(my);
      setStats(st);
      setGivenRatings(given?.ratings ?? []);
      setMyRestaurantReviews(allDriverRatings.filter((item: any) => item.fromType === "restaurant"));
      setMyCharityReviews(allDriverRatings.filter((item: any) => item.fromType === "charity"));
    } catch (e: any) {
      toast({ title: t.errors.loadError, description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (id: number) => {
    setActing(id);
    try {
      await api.deliveries.accept(id);
      toast({ title: `✅ ${d.accept}` });
      setTab("my");
      loadData();
    } catch (err: any) {
      toast({ title: t.errors.error, description: err.message, variant: "destructive" });
    } finally { setActing(null); }
  };

  const handleStep = async (id: number, action: ActionKey) => {
    setActing(id);
    try {
      switch (action) {
        case "go-to-restaurant": await api.deliveries.goToRestaurant(id); break;
        case "pickup":           await api.deliveries.confirmPickup(id); break;
        case "go-to-charity":    await api.deliveries.goToCharity(id); break;
        case "arrive":           await api.deliveries.arrive(id); break;
        case "confirm":          await api.deliveries.driverConfirm(id); break;
      }
      const messages: Record<ActionKey, string> = {
        "accept":           d.accept,
        "go-to-restaurant": d.msgGoToRestaurant,
        "pickup":           d.msgPickup,
        "go-to-charity":    d.msgGoToCharity,
        "arrive":           d.msgArrive,
        "confirm":          d.msgConfirm,
      };
      toast({ title: messages[action] });
      loadData();
    } catch (err: any) {
      toast({ title: t.errors.error, description: err.message, variant: "destructive" });
    } finally { setActing(null); }
  };

  const handleSubmitRating = async () => {
    const delivery = ratingDialog?.delivery;
    if (!delivery) return;

    const requestId = delivery.requestId ?? null;
    const deliveryId = delivery.id ?? null;

    if (!requestId && !deliveryId) {
      toast({ title: r.errorMsg, description: "No request or delivery is linked to this rating", variant: "destructive" });
      return;
    }

    setRatingLoading(true);
    try {
      await api.ratings.create({
        ...(requestId ? { requestId } : { deliveryId }),
        toType: ratingTarget,
        rating: ratingValue,
        comment: ratingComment || undefined,
      });

      toast({ title: `${r.submittedMsg} (${ratingValue}/5)` });
      setRatingDialog(null);
      setRatingComment("");
      setRatingValue(5);
      loadData();
    } catch (err: any) {
      toast({ title: r.errorMsg, description: err.message, variant: "destructive" });
    } finally { setRatingLoading(false); }
  };

  // Derive status config from translation keys
  type StatusCfg = {
    label: string;
    color: string;
    next?: ActionKey;
    nextLabel?: string;
    nextIcon?: any;
    blocked?: boolean;
    blockedTitle?: string;
    blockedMsg?: string;
  };
  const STATUS_CONFIG: Record<string, StatusCfg> = {
    available:   { label: ds.available, color: "bg-blue-100 text-blue-700" },
    pending:     { label: ds.pending,   color: "bg-blue-100 text-blue-700" },
    accepted:    { label: ds.accepted,  color: "bg-amber-100 text-amber-700",  next: "go-to-restaurant", nextLabel: d.goToRestaurantBtn, nextIcon: Store },
    going_to_restaurant:             { label: ds.going_to_restaurant,             color: "bg-orange-100 text-orange-700", next: "pickup",        nextLabel: d.pickupBtn,         nextIcon: Package },
    waiting_for_restaurant_confirmation: {
      label: ds.waiting_for_restaurant_confirmation,
      color: "bg-amber-100 text-amber-800",
      blocked: true,
      blockedTitle: d.waitingRestaurantTitle,
      blockedMsg: d.waitingRestaurantMsg,
    },
    picked_up:                       { label: ds.picked_up,                       color: "bg-purple-100 text-purple-700", next: "go-to-charity", nextLabel: d.goToCharityBtn,     nextIcon: Navigation },
    going_to_charity:    { label: ds.going_to_charity,    color: "bg-indigo-100 text-indigo-700", next: "arrive",        nextLabel: d.arriveBtn,          nextIcon: MapPin },
    arrived: {
      label: ds.arrived,
      color: "bg-yellow-100 text-yellow-700",
      blocked: true,
      blockedTitle: d.waitingCharityTitle,
      blockedMsg: d.waitingCharityMsg,
    },
    waiting_for_charity_confirmation: {
      label: ds.waiting_for_charity_confirmation,
      color: "bg-yellow-100 text-yellow-700",
      blocked: true,
      blockedTitle: d.waitingCharityTitle,
      blockedMsg: d.waitingCharityMsg,
    },
    waiting_for_delivery_confirmation: { label: ds.waiting_for_delivery_confirmation, color: "bg-green-100 text-green-700", next: "confirm", nextLabel: d.confirmBtn, nextIcon: CheckCircle },
    confirmed_by_delivery: { label: ds.confirmed_by_delivery, color: "bg-green-200 text-green-800" },
    delivered:   { label: ds.delivered, color: "bg-green-100 text-green-700" },
    cancelled:   { label: ds.cancelled, color: "bg-red-100 text-red-700" },
  };

  const STEPS = [
    { key: "accepted",            label: d.stepAccepted },
    { key: "going_to_restaurant", label: d.stepGoRestaurant },
    { key: "waiting_for_restaurant_confirmation", label: d.stepWaitRestaurant ?? "⏳" },
    { key: "picked_up",           label: d.stepPickup },
    { key: "going_to_charity",    label: d.stepGoCharity },
    { key: "arrived",             label: d.stepArrived },
    { key: "waiting_for_delivery_confirmation", label: d.stepConfirm },
  ];

  const activeCount = myDeliveries.filter(dv => ACTIVE_STATUSES.includes(dv.status)).length;
  const stepIndex = (status: string) => STEPS.findIndex(s => s.key === status);

  const hasGivenRating = (delivery: any, toType: "restaurant" | "charity") => {
    return givenRatings.some((rating: any) =>
      rating.toType === toType &&
      (
        (delivery.requestId && Number(rating.requestId) === Number(delivery.requestId)) ||
        (delivery.id && Number(rating.deliveryId) === Number(delivery.id))
      )
    );
  };

  const ratingButtonClass = (rated: boolean, color: "amber" | "blue" = "amber") =>
    rated
      ? "rounded-xl gap-1.5 border-green-200 text-green-700 bg-green-50 cursor-not-allowed"
      : color === "blue"
        ? "rounded-xl gap-1.5 border-sky-200 text-sky-600 hover:bg-sky-50"
        : "rounded-xl gap-1.5 border-amber-200 text-amber-600 hover:bg-amber-50";

  const ratedLabel = (t as any).common?.rated ?? "Rated";


  return (
    <div className="min-h-screen flex flex-col bg-accent/20" dir={dir}>
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2" data-testid="text-page-title">
            <Truck className="w-7 h-7 text-primary" />
            {d.pageTitle}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t.dashboard.welcome} {user?.name} — {available.length} {d.tabAvailable}
          </p>
        </div>

        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: d.statCompleted, value: stats.completed, icon: CheckCircle, color: "bg-green-500" },
              { label: d.statActive,    value: activeCount,     icon: Truck,        color: "bg-blue-500" },
              { label: d.statTotal,     value: stats.total,     icon: TrendingUp,   color: "bg-primary" },
            ].map(s => (
              <Card key={s.label} className="border-0 shadow-md">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                    <s.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-xl font-black" data-testid={`stat-${s.label}`}>{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-muted/50 p-1 rounded-xl w-fit">
          {[
            { key: "available", label: d.tabAvailable },
            { key: "my",        label: `${d.tabMy}${activeCount > 0 ? ` (${activeCount})` : ""}` },
            { key: "stats",     label: d.tabStats },
            { key: "ratings",   label: (d as any).tabRatings ?? "My Rating" },
          ].map(tab_ => (
            <button
              key={tab_.key}
              onClick={() => setTab(tab_.key as any)}
              data-testid={`tab-${tab_.key}`}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                tab === tab_.key ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab_.label}
            </button>
          ))}
        </div>

        {/* ── AVAILABLE TAB ── */}
        {tab === "available" && (
          <div className="space-y-4">
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="h-28 rounded-xl bg-muted/50 animate-pulse" />)
            ) : available.length === 0 ? (
              <div className="text-center py-16 bg-background rounded-2xl border-2 border-dashed">
                <Truck className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
                <p className="font-bold text-muted-foreground">{d.noAvailable}</p>
              </div>
            ) : (
              available.map(dv => (
                <Card key={dv.id} className="border-0 shadow-md" data-testid={`card-available-${dv.id}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="w-4 h-4 text-primary" />
                          <span className="font-bold">{dv.requestId ? t.dashboard.offers : t.dashboard.requests}</span>
                          <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">{t.dashboard.available}</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2"><MapPin className="w-4 h-4 shrink-0 text-red-400" /><span>{d.from}: {dv.pickupAddress}</span></div>
                          <div className="flex items-center gap-2"><Navigation className="w-4 h-4 shrink-0 text-green-500" /><span>{d.to}: {dv.dropoffAddress}</span></div>
                        </div>
                      </div>
                      <div className="text-right flex flex-col gap-2">
                        {dv.distance && <div className="text-sm font-bold text-primary">{dv.distance}</div>}
                        <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => setMapDelivery(dv)} data-testid={`button-map-available-${dv.id}`}>
                          <MapIcon className="w-4 h-4" />{d.mapBtn}
                        </Button>
                        <Button size="sm" className="rounded-xl gap-1.5" onClick={() => handleAccept(dv.id)} disabled={acting === dv.id} data-testid={`button-accept-${dv.id}`}>
                          <Truck className="w-4 h-4" />{acting === dv.id ? d.accepting : d.accept}
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {new Date(dv.createdAt).toLocaleString(t.locale)}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* ── MY DELIVERIES TAB ── */}
        {tab === "my" && (
          <div className="space-y-4">
            {myDeliveries.length === 0 ? (
              <div className="text-center py-16 bg-background rounded-2xl border-2 border-dashed">
                <Truck className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
                <p className="font-bold text-muted-foreground">{d.noDeliveries}</p>
              </div>
            ) : (
              myDeliveries.map(dv => {
                const cfg = STATUS_CONFIG[dv.status] || STATUS_CONFIG.available;
                const si = stepIndex(dv.status);
                const isDone = DONE_STATUSES.includes(dv.status);

                return (
                  <Card key={dv.id} className="border-0 shadow-md" data-testid={`card-my-${dv.id}`}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{dv.requestId ? t.dashboard.offers : t.dashboard.requests}</span>
                          <Badge className={`${cfg.color} border-0 text-xs`}>{cfg.label}</Badge>
                        </div>
                      </div>

                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-red-400" />{dv.pickupAddress}</div>
                        <div className="flex items-center gap-2"><Navigation className="w-4 h-4 text-green-500" />{dv.dropoffAddress}</div>
                      </div>

                      {/* Progress stepper */}
                      {si >= 0 && (
                        <div className="flex items-center gap-1 overflow-x-auto py-1">
                          {STEPS.map((step, idx) => (
                            <div key={step.key} className="flex items-center gap-1 shrink-0">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                idx < si ? "bg-green-500 text-white" : idx === si ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                              }`}>
                                {idx < si ? "✓" : idx + 1}
                              </div>
                              <span className={`text-xs hidden sm:inline ${idx <= si ? "text-foreground font-medium" : "text-muted-foreground"}`}>{step.label}</span>
                              {idx < STEPS.length - 1 && <MoveRight className={`w-3 h-3 ${idx < si ? "text-green-500" : "text-muted-foreground/40"}`} />}
                            </div>
                          ))}
                        </div>
                      )}

                      <Button variant="outline" className="w-full rounded-xl gap-2" onClick={() => setMapDelivery(dv)} data-testid={`button-map-my-${dv.id}`}>
                        <MapIcon className="w-4 h-4" />{d.mapBtn}
                      </Button>

                      {/* Blocked state */}
                      {cfg.blocked && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                          <div className="font-bold flex items-center gap-2">
                            <Lock className="w-4 h-4" />
                            {cfg.blockedTitle}
                          </div>
                          <div className="text-sm mt-1">
                            {cfg.blockedMsg}
                          </div>
                        </div>
                      )}

                      {/* Active next step */}
                      {cfg.next && !cfg.blocked && (
                        <Button className="w-full rounded-xl gap-2" onClick={() => handleStep(dv.id, cfg.next!)} disabled={acting === dv.id} data-testid={`button-step-${cfg.next}-${dv.id}`}>
                          {cfg.nextIcon && <cfg.nextIcon className="w-4 h-4" />}
                          {acting === dv.id ? d.processing : cfg.nextLabel}
                        </Button>
                      )}

                      {/* Completed — rating */}
                      {isDone && (dv.requestId || dv.id) && (
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            const rated = hasGivenRating(dv, "restaurant");
                            return (
                              <Button
                                size="sm"
                                variant="outline"
                                className={ratingButtonClass(rated, "amber")}
                                disabled={rated}
                                onClick={() => { if (!rated) { setRatingTarget("restaurant"); setRatingDialog({ open: true, delivery: dv }); } }}
                                data-testid={`button-rate-restaurant-${dv.id}`}
                              >
                                <Star className="w-4 h-4" />{rated ? ratedLabel : d.rateRestaurant}
                              </Button>
                            );
                          })()}
                          {(() => {
                            const rated = hasGivenRating(dv, "charity");
                            return (
                              <Button
                                size="sm"
                                variant="outline"
                                className={ratingButtonClass(rated, "blue")}
                                disabled={rated}
                                onClick={() => { if (!rated) { setRatingTarget("charity"); setRatingDialog({ open: true, delivery: dv }); } }}
                                data-testid={`button-rate-charity-${dv.id}`}
                              >
                                <HeartHandshake className="w-4 h-4" />{rated ? ratedLabel : d.rateCharity}
                              </Button>
                            );
                          })()}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {/* ── STATS TAB ── */}
        {tab === "stats" && stats && (
          <Card className="border-0 shadow-md">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />{d.tabStats}
              </h2>
              {[
                { label: d.statTotal,     value: stats.total,     icon: Truck },
                { label: d.statCompleted, value: stats.completed, icon: CheckCircle },
                { label: d.statActive,    value: stats.active,    icon: Navigation },
                { label: ds.cancelled,    value: stats.cancelled, icon: Package },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <s.icon className="w-5 h-5 text-primary" />
                    <span className="font-medium">{s.label}</span>
                  </div>
                  <span className="text-xl font-black text-primary">{s.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── MY RATING TAB ── */}
        {tab === "ratings" && (
          <div className="space-y-5">
            <div className="flex gap-2 bg-muted/50 p-1 rounded-xl w-fit">
              <button
                onClick={() => setReviewsTab("restaurant")}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  reviewsTab === "restaurant" ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {(d as any).restaurantReviews ?? "Restaurant Reviews"}
              </button>
              <button
                onClick={() => setReviewsTab("charity")}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  reviewsTab === "charity" ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {(d as any).charityReviews ?? "Charity Reviews"}
              </button>
            </div>

            {(reviewsTab === "restaurant" ? myRestaurantReviews : myCharityReviews).length === 0 ? (
              <div className="text-center py-14 bg-background rounded-2xl border-2 border-dashed">
                <Star className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="font-bold text-muted-foreground">
                  {reviewsTab === "restaurant"
                    ? ((d as any).noRestaurantReviews ?? "No restaurant reviews yet")
                    : ((d as any).noCharityReviews ?? "No charity reviews yet")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {(reviewsTab === "restaurant" ? myRestaurantReviews : myCharityReviews).map((review: any) => (
                  <Card key={review.id} className="border-0 shadow-md">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold">
                          {review.fromName || review.fromUser?.name || review.from?.name || review.reviewerName || (reviewsTab === "restaurant" ? ((d as any).unknownRestaurant ?? "Restaurant") : ((d as any).unknownCharity ?? "Charity"))}
                        </div>
                        <div className="text-amber-500 font-bold">
                          {"★".repeat(Number(review.rating || 0))}
                        </div>
                      </div>

                      {renderExpandableText(review.comment)}

                      {review.createdAt && (
                        <div className="text-xs text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString(t.locale)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Map Dialog */}
      <Dialog open={!!mapDelivery} onOpenChange={(open) => !open && setMapDelivery(null)}>
        <DialogContent className="max-w-3xl" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MapIcon className="w-5 h-5 text-primary" />{d.mapTitle}</DialogTitle>
          </DialogHeader>
          {mapDelivery && <DeliveryMap pickupAddress={mapDelivery.pickupAddress} dropoffAddress={mapDelivery.dropoffAddress} />}
        </DialogContent>
      </Dialog>


      {/* Full Message Dialog */}
      <Dialog open={!!fullMessage} onOpenChange={(open) => !open && setFullMessage(null)}>
        <DialogContent dir={dir} className="w-[min(92vw,900px)] max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{fullMessage?.title ?? fullMessageTitle}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto whitespace-pre-wrap break-all text-sm leading-relaxed text-muted-foreground">
            {fullMessage?.message}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rating Dialog */}
      <Dialog open={!!ratingDialog?.open} onOpenChange={(open) => !open && setRatingDialog(null)}>
        <DialogContent dir={dir} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400" />
              {ratingTarget === "restaurant" ? r.rateRestaurant : r.rateCharity}
            </DialogTitle>
            <DialogDescription>{r.dialogDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setRatingValue(n)} data-testid={`star-${n}`}
                  className={`text-3xl transition-transform hover:scale-110 ${n <= ratingValue ? "text-amber-400" : "text-muted-foreground/30"}`}>★</button>
              ))}
            </div>
            <Textarea placeholder={r.commentPlaceholder} value={ratingComment} onChange={e => setRatingComment(e.target.value)} rows={3} data-testid="input-rating-comment" />
            <Button className="w-full" onClick={handleSubmitRating} disabled={ratingLoading}>
              {ratingLoading ? r.submitting : `${r.submitBtn} (${ratingValue}/5)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}