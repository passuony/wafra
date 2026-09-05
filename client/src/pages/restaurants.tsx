import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Plus, Clock, Trash2, MapPin, Utensils, PackageCheck, Star, TrendingUp, AlertCircle, Truck, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { useLanguage } from "@/components/LanguageProvider";

const statusDots: Record<string, string> = {
  available: "bg-blue-500",
  reserved: "bg-amber-500",
  completed: "bg-green-500",
  cancelled: "bg-red-500",
  expired: "bg-gray-400",
  confirmed: "bg-purple-500",
};

const statusBadgeColors: Record<string, string> = {
  available: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  reserved: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  expired: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  confirmed: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color: string }) {
  return (
    <Card className="border-0 shadow-md card-hover">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="text-2xl font-black">{value}</div>
          <div className="text-muted-foreground text-sm">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Restaurants() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const user = getUser();
  const { t, dir } = useLanguage();
  const [offers, setOffers] = useState<any[]>([]);
  const [ratingData, setRatingData] = useState<{ ratings: any[]; avg: number }>({ ratings: [], avg: 0 });
  const [pendingConfirmations, setPendingConfirmations] = useState<any[]>([]);
  const [restaurantDeliveries, setRestaurantDeliveries] = useState<any[]>([]);
  const [basketContributions, setBasketContributions] = useState<any[]>([]);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [itemsTab, setItemsTab] = useState<"offers" | "baskets">("offers");
  const [givenRatings, setGivenRatings] = useState<any[]>([]);
  const [fullMessage, setFullMessage] = useState<{ title: string; message: string } | null>(null);

  const readMoreLabel = (t as any).common?.readMore ?? "Read more";
  const fullMessageTitle = (t as any).common?.fullMessage ?? "Full message";

  const renderExpandableText = (value: unknown, className = "text-sm text-muted-foreground break-words leading-relaxed", limit = 120) => {
    const text = String(value ?? "");
    if (!text.trim()) return null;

    const isLong = text.length > limit;
    const preview = isLong ? `${text.slice(0, limit).trim()}...` : text;

    return (
      <p className={className}>
        <span className="whitespace-pre-wrap break-words">{preview}</span>
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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("meal");
  const [category, setCategory] = useState("hot");
  const [pickupLocation, setPickupLocation] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);

  const [ratingDialog, setRatingDialog] = useState<{ open: boolean; delivery: any } | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "restaurant") {
      setLocation("/login");
      return;
    }
    loadOffers();
  }, []);

  const loadOffers = async () => {
    setLoading(true);
    try {
      const [data, rd, pending, restaurantDeliveryList, contributionList, given] = await Promise.all([
        api.offers.getMy(),
        user ? api.ratings.getByRestaurant(user.id) : Promise.resolve({ ratings: [], avg: 0 }),
        api.deliveries.getRestaurantPending(),
        api.deliveries.getRestaurantDeliveries(),
        api.baskets.getMyContributions(),
        api.ratings.getGiven().catch(() => ({ ratings: [] })),
      ]);
      setOffers(data);
      setRatingData(rd);
      setPendingConfirmations(pending);
      setRestaurantDeliveries(restaurantDeliveryList);
      setBasketContributions(contributionList);
      setGivenRatings(given?.ratings ?? []);
    } catch (e: any) {
      toast({ title: t.errors.loadError, description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRestaurantConfirm = async (id: number) => {
    setConfirmingId(id);
    try {
      await api.deliveries.restaurantConfirm(id);
      toast({ title: "✅ " + (t.restaurantBaskets?.confirmed ?? "تم التأكيد") });
      loadOffers();
    } catch (err: any) {
      toast({ title: t.errors.error, description: err.message, variant: "destructive" });
    } finally {
      setConfirmingId(null);
    }
  };

  const getCompletedDeliveryForBasket = (basketId?: number | null) => {
    if (!basketId) return null;
    return completedRestaurantDeliveries.find((dv: any) =>
      dv.basketId === basketId &&
      dv.deliveryPersonId &&
      ["confirmed_by_delivery", "delivered"].includes(dv.status)
    ) ?? null;
  };

  const openBasketRating = (ratingTarget: "charity" | "delivery", contribution: any) => {
    const basketId = contribution?.basketId ?? contribution?.basket?.id;
    const completedDelivery = getCompletedDeliveryForBasket(basketId);

    if (!completedDelivery) {
      toast({
        title: t.errors.error,
        description: "No completed delivery is linked to this basket yet. Make sure the driver has fully confirmed the delivery.",
        variant: "destructive",
      });
      return;
    }

    setRatingDialog({
      open: true,
      delivery: { ...completedDelivery, ratingTarget },
    });
  };

  const handleSubmitDeliveryRating = async () => {
    const rawRequestId = ratingDialog?.delivery?.requestId;
    const rawDeliveryId = ratingDialog?.delivery?.id;
    const requestId = rawRequestId ? Number(rawRequestId) : null;
    const deliveryId = rawDeliveryId ? Number(rawDeliveryId) : null;
    const toType = ratingDialog?.delivery?.ratingTarget ?? "delivery";

    if (!requestId && !deliveryId) {
      toast({ title: t.ratings.errorMsg, description: "No requestId or deliveryId found for this rating.", variant: "destructive" });
      return;
    }

    const payload = {
      ...(requestId ? { requestId } : { deliveryId }),
      toType,
      rating: Number(ratingValue),
      ...(ratingComment.trim() ? { comment: ratingComment.trim() } : {}),
    };

    console.log("RATING PAYLOAD", payload, ratingDialog?.delivery);

    setRatingLoading(true);
    try {
      await api.ratings.create(payload);
      toast({ title: `${t.ratings.submittedMsg} (${ratingValue}/5)` });
      setRatingDialog(null);
      setRatingComment("");
      setRatingValue(5);
      loadOffers();
    } catch (err: any) {
      toast({ title: t.ratings.errorMsg, description: err.message, variant: "destructive" });
    } finally {
      setRatingLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const unitValue = (t.units as any)[unit] ?? unit;
      await api.offers.create({ title, description, quantity, unit: unitValue, category, pickupLocation, expiresAt, isUrgent });
      toast({ title: t.restaurants.postSuccess, description: t.restaurants.postSuccessDesc });
      setTitle(""); setDescription(""); setQuantity(""); setPickupLocation(""); setExpiresAt(""); setIsUrgent(false);
      loadOffers();
    } catch (err: any) {
      toast({ title: t.errors.error, description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRequest = (id: number) => {
    setDeleteConfirmId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    try {
      await api.offers.delete(deleteConfirmId);
      setOffers(p => p.filter(x => x.id !== deleteConfirmId));
      toast({ title: t.restaurants.deleteSuccess });
    } catch (err: any) {
      toast({ title: t.errors.error, description: err.message, variant: "destructive" });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const ACTIVE_DELIVERY_STATUSES = [
    "available", "pending", "accepted", "going_to_restaurant",
    "waiting_for_restaurant_confirmation", "picked_up", "going_to_charity",
    "arrived", "waiting_for_charity_confirmation", "waiting_for_delivery_confirmation",
  ];
  const COMPLETED_DELIVERY_STATUSES = ["confirmed_by_delivery", "delivered"];

  const completedRestaurantDeliveries = restaurantDeliveries.filter((d: any) =>
    COMPLETED_DELIVERY_STATUSES.includes(d.status) && d.deliveryPersonId
  );

  const getCompletedDeliveryForOffer = (offerId?: number | null) => {
    if (!offerId) return null;

    return completedRestaurantDeliveries.find((dv: any) => {
      const linkedOfferId =
        dv.request?.offerId ??
        dv.requestOfferId ??
        dv.offerId ??
        dv.offer?.id ??
        dv.request?.offer?.id ??
        null;

      return Number(linkedOfferId) === Number(offerId) && dv.deliveryPersonId;
    }) ?? null;
  };

  const hasGivenRating = (params: { requestId?: number | null; deliveryId?: number | null; toType: "restaurant" | "charity" | "delivery" }) => {
    return givenRatings.some((rating: any) =>
      rating.toType === params.toType &&
      (
        (params.requestId && Number(rating.requestId) === Number(params.requestId)) ||
        (params.deliveryId && Number(rating.deliveryId) === Number(params.deliveryId))
      )
    );
  };

  const charityReviews = ratingData.ratings.filter((r: any) => r.fromType === "charity");
  const deliveryReviews = ratingData.ratings.filter((r: any) => r.fromType === "delivery");

  // Stats are calculated per visible offer/contribution only.
  // Do not add delivery workflow steps here, otherwise one completed order
  // is counted twice: once as an offer and once as a delivery.
  const offerInProgressStatuses = ["reserved", "confirmed", "transferred"] as const;

  const stats = {
    total: offers.length + basketContributions.length,
    available: offers.filter((o: any) => o.status === "available").length,
    inProgress:
      offers.filter((o: any) => offerInProgressStatuses.includes(o.status as any)).length +
      basketContributions.filter((c: any) => ["open", "partial"].includes(c.basket?.status)).length,
    completed:
      offers.filter((o: any) => o.status === "completed").length +
      basketContributions.filter((c: any) => c.basket?.status === "completed").length,
  };

  const chartData = [
    { name: t.status.available, value: stats.available, fill: "#3b82f6" },
    { name: (t.charityDeliveries?.sectionInProgress ?? "In Progress"), value: stats.inProgress, fill: "#f59e0b" },
    { name: t.dashboard.completed, value: stats.completed, fill: "#22c55e" },
  ];

  const renderReviewsSection = (title: string, reviews: any[], avg: number, avatarFallback: string) => (
    reviews.length > 0 ? (
      <Card className="border-0 shadow-md h-full">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
              <Star className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base">{title}</h2>
              <div className="flex items-center gap-1 mt-0.5">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star key={s} className={`w-4 h-4 ${s <= Math.round(avg) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                ))}
                <span className="text-sm font-bold text-amber-500 ml-1">{avg.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground ml-1">({reviews.length})</span>
              </div>
            </div>
          </div>
          <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
            {reviews.map((review: any) => (
              <div key={review.id} className="flex gap-3 pb-4 border-b last:border-0 last:pb-0">
                <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {review.fromName?.[0] ?? avatarFallback}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{review.fromName ?? avatarFallback}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.createdAt).toLocaleDateString(t.locale, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  {renderExpandableText(review.comment, "text-sm text-muted-foreground mt-1 leading-relaxed break-words")}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    ) : null
  );

  return (
    <div className="min-h-screen flex flex-col bg-accent/20">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-black">{t.restaurants.title}</h1>
          <p className="text-muted-foreground mt-1">
            {t.restaurants.Welcome} <span className="font-bold text-primary">{user?.name}</span> — {t.restaurants.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard label={t.restaurants.totalOffers} value={stats.total} icon={Utensils} color="gradient-primary" />
          <StatCard label={t.restaurants.availableNow} value={stats.available} icon={TrendingUp} color="bg-blue-500" />
          <StatCard label={t.restaurants.inProgress ?? (t.charityDeliveries?.sectionInProgress ?? "In Progress")} value={stats.inProgress} icon={Clock} color="bg-amber-500" />
          <StatCard label={t.restaurants.completedLabel ?? t.dashboard.completed} value={stats.completed} icon={PackageCheck} color="bg-green-500" />
          <Card className="border-0 shadow-md card-hover">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-500">
                <Star className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-black text-amber-500">
                  {ratingData.avg > 0 ? ratingData.avg.toFixed(1) : "—"}
                </div>
                <div className="text-muted-foreground text-sm">{ratingData.ratings.length} {ratingData.ratings.length === 1 ? "review" : "reviews"}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {(charityReviews.length > 0 || deliveryReviews.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="min-w-0">
              {renderReviewsSection(
                t.restaurants.charityReviews ?? "Charity Reviews",
                charityReviews,
                charityReviews.length ? charityReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / charityReviews.length : 0,
                "?"
              )}
            </div>
            <div className="min-w-0">
              {renderReviewsSection(
                t.restaurants.deliveryReviews ?? "Delivery Reviews",
                deliveryReviews,
                deliveryReviews.length ? deliveryReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / deliveryReviews.length : 0,
                "D"
              )}
            </div>
          </div>
        )}

        {/* ── Pending Driver Confirmations ── */}
        {pendingConfirmations.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-base">{t.deliveryStatuses.restaurant_waiting_confirm}</h2>
                <p className="text-sm text-muted-foreground">{pendingConfirmations.length}</p>
              </div>
            </div>
            <div className="space-y-3">
              {pendingConfirmations.map(dv => (
                <Card key={dv.id} className="border-0 shadow-md border-s-4 border-s-amber-500" data-testid={`card-pending-confirm-${dv.id}`}>
                  <CardContent className="p-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Truck className="w-4 h-4 text-amber-600" />
                        <span className="font-semibold text-sm">{dv.driver?.name || "—"}</span>
                        {dv.driver?.phone && <span className="text-xs text-muted-foreground">{dv.driver.phone}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span>{dv.dropoffAddress}</span>
                      </div>
                      {dv.basket && <p className="text-xs text-muted-foreground mt-1">🧺 {dv.basket.title}</p>}
                    </div>
                    <Button size="sm" className="rounded-xl gap-1.5 bg-green-600 hover:bg-green-700 shrink-0"
                      onClick={() => handleRestaurantConfirm(dv.id)}
                      disabled={confirmingId === dv.id}
                      data-testid={`button-confirm-handoff-${dv.id}`}>
                      <CheckCircle2 className="w-4 h-4" />
                      {confirmingId === dv.id ? t.delivery.processing : (t.restaurantBaskets?.confirmHandoff ?? "تأكيد التسليم")}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <Card className="border-0 shadow-lg sticky top-24">
              <CardHeader className="pb-4 border-b">
                <CardTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  {t.restaurants.addOfferTitle}
                </CardTitle>
                <CardDescription>{t.restaurants.addOfferDesc}</CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>{t.restaurants.mealName}</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t.restaurants.mealNamePlaceholder} required data-testid="input-title" />
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t.restaurants.description}</Label>
                    <Input value={description} onChange={e => setDescription(e.target.value)} placeholder={t.restaurants.descPlaceholder} data-testid="input-description" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>{t.restaurants.quantity}</Label>
                      <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="20" min="1" required data-testid="input-quantity" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t.restaurants.unit}</Label>
                      <Select value={unit} onValueChange={setUnit}>
                        <SelectTrigger data-testid="select-unit"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="meal">{t.units.meal}</SelectItem>
                          <SelectItem value="kg">{t.units.kg}</SelectItem>
                          <SelectItem value="piece">{t.units.piece}</SelectItem>
                          <SelectItem value="liter">{t.units.liter}</SelectItem>
                          <SelectItem value="tray">{t.units.tray}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t.restaurants.category}</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(t.categories).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t.restaurants.expiresAt}</Label>
                    <Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} required data-testid="input-expires" />
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t.restaurants.pickupLocation}</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input value={pickupLocation} onChange={e => setPickupLocation(e.target.value)} placeholder={t.restaurants.locationPlaceholder} required className="pl-10" data-testid="input-location" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/20">
                    <div>
                      <Label className="text-red-700 dark:text-red-400 font-semibold">{t.restaurants.urgent}</Label>
                      <p className="text-xs text-muted-foreground">{t.restaurants.urgentDesc}</p>
                    </div>
                    <Switch checked={isUrgent} onCheckedChange={setIsUrgent} data-testid="switch-urgent" />
                  </div>

                  <Button type="submit" className="w-full h-12 text-base font-bold rounded-xl shadow-md gap-2" disabled={submitting} data-testid="button-submit-offer">
                    <Plus className="w-5 h-5" />
                    {submitting ? t.restaurants.posting : t.restaurants.postOffer}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {offers.length > 0 && (
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    {t.restaurants.offerStats}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={chartData} barSize={40}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                      <YAxis hide allowDecimals={false} />
                      <Tooltip formatter={(v) => [v, t.restaurants.offers]} contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={itemsTab === "offers" ? "default" : "ghost"}
                className="rounded-xl gap-2"
                onClick={() => setItemsTab("offers")}
                data-testid="tab-posted-offers"
              >
                <Utensils className="w-5 h-5" />
                {t.restaurants.myOffers}
                <Badge variant="secondary" className="ms-1">{offers.length}</Badge>
              </Button>

              <Button
                type="button"
                variant={itemsTab === "baskets" ? "default" : "ghost"}
                className="rounded-xl gap-2"
                onClick={() => setItemsTab("baskets")}
                data-testid="tab-charity-baskets"
              >
                <PackageCheck className="w-5 h-5" />
                {t.restaurantBaskets?.pageTitle ?? "Charity Baskets"}
                <Badge variant="secondary" className="ms-1">{basketContributions.length}</Badge>
              </Button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-28 rounded-xl bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : itemsTab === "offers" && offers.length === 0 ? (
              <div className="text-center py-16 bg-background rounded-2xl border-2 border-dashed">
                <Utensils className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="font-bold text-muted-foreground mb-1">{t.restaurants.noOffers}</h3>
                <p className="text-sm text-muted-foreground">{t.restaurants.noOffersHint}</p>
              </div>
            ) : itemsTab === "offers" ? (
              <div className="space-y-4">
                {offers.map(offer => {
                  const borderColor = offer.status === "available" ? "border-s-blue-500" :
                    offer.status === "reserved" ? "border-s-amber-500" :
                      offer.status === "completed" ? "border-s-green-500" : "border-s-gray-300";
                  const statusLabel = (t.status as any)[offer.status] ?? offer.status;
                  const badgeColor = statusBadgeColors[offer.status] ?? "bg-gray-100 text-gray-700";
                  const dotColor = statusDots[offer.status] ?? "bg-gray-400";
                  return (
                    <Card
                      key={offer.id}
                      className={`border-0 shadow-md overflow-hidden card-hover border-s-4 ${borderColor}`}
                      data-testid={`card-offer-${offer.id}`}
                    >
                      <CardContent className="p-5">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <h3 className="font-bold text-base">{offer.title}</h3>
                              <Badge className={`${badgeColor} border-0 gap-1.5 text-xs font-semibold`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                                {statusLabel}
                              </Badge>
                              {offer.isUrgent && (
                                <Badge className="bg-red-100 text-red-700 border-0 text-xs gap-1">
                                  <AlertCircle className="w-3 h-3" /> {t.restaurants.urgent}
                                </Badge>
                              )}
                            </div>
                            {offer.description && renderExpandableText(offer.description, "text-sm text-muted-foreground mb-2 leading-relaxed break-words")}
                            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <PackageCheck className="w-4 h-4" />
                                {offer.quantity} {offer.unit}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4" />
                                {new Date(offer.expiresAt).toLocaleString(t.locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <MapPin className="w-4 h-4" />
                                {offer.pickupLocation}
                              </span>
                            </div>
                          </div>
                          {offer.status === "available" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl gap-1.5 shrink-0"
                              onClick={() => handleDeleteRequest(offer.id)}
                              data-testid={`button-delete-${offer.id}`}
                            >
                              <Trash2 className="w-4 h-4" /> {t.restaurants.deleteOffer}
                            </Button>
                          )}
                          {offer.status === "reserved" && (
                            <span className="text-sm text-amber-600 font-semibold bg-amber-50 dark:bg-amber-950/20 px-3 py-1 rounded-full shrink-0">
                              {t.restaurants.awaitingPickup}
                            </span>
                          )}
                          {offer.status === "completed" && (() => {
                            const completedDelivery = getCompletedDeliveryForOffer(offer.id);

                            return (
                              <div className="flex flex-col sm:items-end gap-2 shrink-0">
                                <div className="flex items-center gap-1.5 text-green-600 text-sm font-semibold">
                                  <Star className="w-4 h-4" /> {t.restaurants.completedLabel ?? t.dashboard.completed}
                                </div>

                                {completedDelivery && (() => {
                                  const rated = hasGivenRating({
                                    requestId: completedDelivery.requestId ?? null,
                                    deliveryId: completedDelivery.id ?? null,
                                    toType: "delivery",
                                  });

                                  return (
                                    <Button
                                      size="sm"
                                      variant={rated ? "secondary" : "outline"}
                                      disabled={rated}
                                      className={
                                        rated
                                          ? "rounded-xl gap-1.5 bg-muted text-muted-foreground cursor-not-allowed opacity-70"
                                          : "rounded-xl gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50"
                                      }
                                      onClick={() => {
                                        if (rated) return;
                                        setRatingDialog({
                                          open: true,
                                          delivery: {
                                            ...completedDelivery,
                                            ratingTarget: "delivery",
                                          },
                                        });
                                      }}
                                    >
                                      <Star className="w-4 h-4" />
                                      {rated ? ((t as any).common?.rated ?? "Rated") : (t.ratings.rateDriver ?? "Rate Driver")}
                                    </Button>
                                  );
                                })()}
                              </div>
                            );
                          })()}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : itemsTab === "baskets" && basketContributions.length === 0 ? (
              <div className="text-center py-16 bg-background rounded-2xl border-2 border-dashed">
                <PackageCheck className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="font-bold text-muted-foreground mb-1">{t.restaurantBaskets?.noOpenBaskets ?? "No charity baskets"}</h3>
              </div>
            ) : itemsTab === "baskets" ? (
              <div className="space-y-4">
                <h2 className="text-lg font-bold flex items-center gap-2 pt-2">
                  <PackageCheck className="w-5 h-5 text-muted-foreground" />
                  {t.restaurantBaskets?.pageTitle ?? "Charity Baskets"}
                  <Badge variant="outline" className="ms-2">{basketContributions.length}</Badge>
                </h2>
                {basketContributions.map((c: any) => {
                  const basketStatus = c.basket?.status ?? "open";
                  const isCompleted = basketStatus === "completed";
                  return (
                    <Card key={`contribution-${c.id}`} className={`border-0 shadow-md overflow-hidden card-hover border-s-4 ${isCompleted ? "border-s-green-500" : "border-s-amber-500"}`}>
                      <CardContent className="p-5">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <h3 className="font-bold text-base">{c.basket?.title ?? "Basket contribution"}</h3>
                              <Badge className={`${isCompleted ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"} border-0 gap-1.5 text-xs font-semibold`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? "bg-green-500" : "bg-amber-500"}`} />
                                {isCompleted ? (t.restaurants.completedLabel ?? t.dashboard.completed) : (t.restaurants.inProgress ?? (t.charityDeliveries?.sectionInProgress ?? "In Progress"))}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <PackageCheck className="w-4 h-4" />
                                {c.quantity} {c.unit ?? ""}
                              </span>
                              {c.basket?.expiresAt && (
                                <span className="flex items-center gap-1.5">
                                  <Clock className="w-4 h-4" />
                                  {new Date(c.basket.expiresAt).toLocaleDateString(t.locale)}
                                </span>
                              )}
                            </div>
                          </div>
                          {isCompleted ? (
                            <div className="flex flex-col sm:items-end gap-2 shrink-0">
                              <div className="flex items-center gap-1.5 text-green-600 text-sm font-semibold">
                                <Star className="w-4 h-4" /> {t.restaurants.completedLabel ?? t.dashboard.completed}
                              </div>
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl gap-1.5 border-amber-200 text-amber-600 hover:bg-amber-50"
                                  onClick={() => openBasketRating("charity", c)}
                                  data-testid={`button-rate-charity-basket-${c.id}`}
                                >
                                  <Star className="w-4 h-4" />
                                  {t.ratings.rateCharity}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50"
                                  onClick={() => openBasketRating("delivery", c)}
                                  data-testid={`button-rate-driver-basket-${c.id}`}
                                >
                                  <Star className="w-4 h-4" />
                                  {t.ratings.rateDriver}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-amber-600 font-semibold bg-amber-50 dark:bg-amber-950/20 px-3 py-1 rounded-full shrink-0">
                              {t.restaurants.inProgress ?? (t.charityDeliveries?.sectionInProgress ?? "In Progress")}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </main>

      {/* Full Message Dialog */}
      <Dialog open={!!fullMessage} onOpenChange={(open) => !open && setFullMessage(null)}>
        <DialogContent dir={dir} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{fullMessage?.title ?? fullMessageTitle}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
            {fullMessage?.message}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!ratingDialog?.open} onOpenChange={(open) => !open && setRatingDialog(null)}>
        <DialogContent dir={dir} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400" />
              {ratingDialog?.delivery?.ratingTarget === "charity" ? t.ratings.rateCharity : t.ratings.rateDriver}
            </DialogTitle>
            <DialogDescription>{t.ratings.dialogDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setRatingValue(n)}
                  className={`text-3xl transition-transform hover:scale-110 ${n <= ratingValue ? "text-amber-400" : "text-muted-foreground/30"}`}>★</button>
              ))}
            </div>
            <Textarea placeholder={t.ratings.commentPlaceholder} value={ratingComment} onChange={e => setRatingComment(e.target.value)} rows={3} />
            <Button className="w-full" onClick={handleSubmitDeliveryRating} disabled={ratingLoading}>
              {ratingLoading ? t.ratings.submitting : `${t.ratings.submitBtn} (${ratingValue}/5)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-sm" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              {t.confirmDialog.cancelOfferTitle}
            </DialogTitle>
            <DialogDescription>
              {t.confirmDialog.cancelOfferDesc}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 flex-row justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} data-testid="button-cancel-delete">
              {t.confirmDialog.cancelOfferCancel}
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} data-testid="button-confirm-delete">
              <Trash2 className="w-4 h-4 me-1" /> {t.confirmDialog.cancelOfferConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}