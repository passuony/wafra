import { useEffect, useState, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Clock, MapPin, Package, Search, CheckCircle, XCircle, Filter, Star, Utensils, HandHeart, Map, Truck, ShoppingBasket } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

const LeafletMap = lazy(() => import("@/components/LeafletMap"));

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  accepted_by_charity: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  waiting_for_delivery: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  delivery_assigned: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  picked_up: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  on_the_way_to_charity: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  arrived: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  charity_confirmed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  delivery_confirmed: "bg-green-200 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  delivered: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

const DONE_DELIVERY_STATUSES = ["confirmed_by_delivery", "delivered", "completed"];
const DONE_REQUEST_STATUSES = ["approved", "completed", "delivery_confirmed"];

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

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          className="transition-transform hover:scale-110"
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(s)}
          data-testid={`star-${s}`}
        >
          <Star
            className={`w-8 h-8 ${(hovered || value) >= s ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
          />
        </button>
      ))}
    </div>
  );
}

export default function Charities() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const user = getUser();
  const { t, dir } = useLanguage();
  const tc: any = t.charities;

  const seenPrefix = `wafra_charity_seen_${user?.id ?? "guest"}`;
  const readSeenCount = (key: string) => {
    const raw = window.localStorage.getItem(`${seenPrefix}_${key}`);
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  };

  const [tab, setTab] = useState<"browse" | "map" | "my" | "ratings">("browse");
  const [reservationTab, setReservationTab] = useState<"offers" | "baskets">("offers");
  const [reviewsTab, setReviewsTab] = useState<"restaurant" | "delivery">("restaurant");

  const [seenReservationsCount, setSeenReservationsCount] = useState(() => readSeenCount("reservations"));
  const [seenCompletedOffersCount, setSeenCompletedOffersCount] = useState(() => readSeenCount("offers_completed"));
  const [seenCompletedBasketsCount, setSeenCompletedBasketsCount] = useState(() => readSeenCount("baskets_completed"));

  const [availableOffers, setAvailableOffers] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [myBaskets, setMyBaskets] = useState<any[]>([]);
  const [charityDeliveries, setCharityDeliveries] = useState<any[]>([]);
  const [restaurantReviews, setRestaurantReviews] = useState<any[]>([]);
  const [deliveryReviews, setDeliveryReviews] = useState<any[]>([]);
  const [givenRatings, setGivenRatings] = useState<any[]>([]);
  const [fullMessage, setFullMessage] = useState<{ title: string; message: string } | null>(null);

  const ratedLabel = (t as any).common?.rated ?? "Rated";
  const readMoreLabel = (t as any).common?.readMore ?? "Read more";
  const fullMessageTitle = (t as any).common?.fullMessage ?? "Full message";

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [reserving, setReserving] = useState<number | null>(null);

  const [ratingDialog, setRatingDialog] = useState<{
    open: boolean;
    targetType: "restaurant" | "delivery";
    requestId?: number | null;
    deliveryId?: number | null;
    title?: string;
  } | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "charity") {
      setLocation("/login");
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [offers, reqs, baskets, deliveries, ratingsRes, given] = await Promise.all([
        api.offers.getAll(),
        api.requests.getMy(),
        api.baskets.getMy().catch(() => []),
        api.deliveries.getCharityDeliveries().catch(() => []),
        user ? api.ratings.getByUser(user.id, "charity").catch(() => ({ ratings: [] })) : Promise.resolve({ ratings: [] }),
        api.ratings.getGiven().catch(() => ({ ratings: [] })),
      ]);

      setAvailableOffers(offers);
      setMyRequests(reqs);
      setMyBaskets(baskets);
      setCharityDeliveries(deliveries);

      const allReviews = ratingsRes?.ratings || [];
      setRestaurantReviews(allReviews.filter((r: any) => r.fromType === "restaurant"));
      setDeliveryReviews(allReviews.filter((r: any) => r.fromType === "delivery"));
      setGivenRatings(given?.ratings ?? []);
    } catch (e: any) {
      toast({ title: t.errors.loadError, description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReserve = async (offerId: number) => {
    setReserving(offerId);
    try {
      await api.requests.create({ offerId });
      toast({ title: tc.reservedMsg, description: tc.reservedDesc });
      loadData();
    } catch (err: any) {
      toast({ title: t.errors.error, description: err.message, variant: "destructive" });
    } finally {
      setReserving(null);
    }
  };

  const handleConfirm = async (id: number) => {
    try {
      await api.requests.acceptByCharity(id);
      toast({
        title: "✅ تم القبول وإنشاء طلب التوصيل",
        description: "سيتم إخطار مندوبي التوصيل المتاحين قريباً",
      });
      loadData();
    } catch (err: any) {
      toast({ title: t.errors.error, description: err.message, variant: "destructive" });
    }
  };

  const handleConfirmReceipt = async (id: number) => {
    try {
      await api.requests.confirmReceipt(id);
      toast({
        title: "✅ تم تأكيد الاستلام",
        description: "اكتمل الطلب بنجاح. شكراً لاستخدامك منصة وفرة!",
      });
      loadData();
    } catch (err: any) {
      toast({ title: t.errors.error, description: err.message, variant: "destructive" });
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await api.requests.cancel(id);
      toast({ title: tc.cancelledMsg });
      loadData();
    } catch (err: any) {
      toast({ title: t.errors.error, description: err.message, variant: "destructive" });
    }
  };

  const getCompletedDeliveryForRequest = (requestId: number) => {
    return charityDeliveries.find((d: any) =>
      d.requestId === requestId && DONE_DELIVERY_STATUSES.includes(d.status)
    );
  };

  const getCompletedDeliveriesForBasket = (basketId: number) => {
    return charityDeliveries.filter((d: any) =>
      d.basketId === basketId && DONE_DELIVERY_STATUSES.includes(d.status)
    );
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

  const ratingButtonClass = (rated: boolean, color: "blue" | "amber" = "blue") =>
    rated
      ? "rounded-xl gap-1.5 border-green-200 text-green-700 bg-green-50 cursor-not-allowed"
      : color === "amber"
        ? "rounded-xl gap-1.5 border-amber-200 text-amber-600 hover:bg-amber-50"
        : "rounded-xl gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50";

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

  const openRatingDialog = (targetType: "restaurant" | "delivery", source: { requestId?: number | null; deliveryId?: number | null; title?: string }) => {
    setRatingValue(5);
    setRatingComment("");
    setRatingDialog({
      open: true,
      targetType,
      requestId: source.requestId ?? null,
      deliveryId: source.deliveryId ?? null,
      title: source.title,
    });
  };

  const handleSubmitRating = async () => {
    if (!ratingDialog) return;
    if (!ratingDialog.requestId && !ratingDialog.deliveryId) {
      toast({ title: t.ratings.errorMsg, description: "No request or delivery is linked to this rating", variant: "destructive" });
      return;
    }
    setRatingSubmitting(true);
    try {
      const requestId = ratingDialog.requestId ? Number(ratingDialog.requestId) : null;
      const deliveryId = ratingDialog.deliveryId ? Number(ratingDialog.deliveryId) : null;

      // The backend requires EXACTLY ONE context:
      // - offer reservations use requestId
      // - basket deliveries use deliveryId
      // If both exist, prefer requestId because this is a normal offer request.
      const payload: any = {
        ...(requestId ? { requestId } : { deliveryId }),
        toType: ratingDialog.targetType,
        rating: Number(ratingValue),
        ...(ratingComment.trim() ? { comment: ratingComment.trim() } : {}),
      };

      await api.ratings.create(payload);
      setRatingDialog(null);
      setRatingComment("");
      setRatingValue(5);
      toast({ title: `${t.ratings.submittedMsg} (${ratingValue}/5)` });
      loadData();
    } catch (err: any) {
      toast({ title: t.ratings.errorMsg || t.errors.error, description: err.message, variant: "destructive" });
    } finally {
      setRatingSubmitting(false);
    }
  };

  const filteredOffers = availableOffers.filter(o => {
    const matchSearch = search === "" ||
      o.title?.toLowerCase().includes(search.toLowerCase()) ||
      o.restaurant?.name?.toLowerCase().includes(search.toLowerCase()) ||
      o.pickupLocation?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || o.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const mapMarkers = availableOffers.map(o => ({
    id: o.id,
    lat: o.latitude ?? (24.7 + Math.random() * 0.1),
    lng: o.longitude ?? (46.7 + Math.random() * 0.1),
    title: o.title,
    subtitle: `${o.restaurant?.name ?? ""} · ${o.quantity} ${o.unit}`,
    urgent: o.isUrgent,
  }));

  // All offer reservations must appear in My Reservations, not only completed ones.
  // Pending / waiting-for-delivery items stay visible so the charity can track them.
  const offerReservationRequests = myRequests.filter((r: any) =>
    !["cancelled", "rejected"].includes(r.status)
  );

  const completedOfferRequests = myRequests.filter(r =>
    DONE_REQUEST_STATUSES.includes(r.status) || Boolean(getCompletedDeliveryForRequest(r.id))
  );
  const completedBaskets = myBaskets.filter((b: any) =>
    b.status === "completed" || getCompletedDeliveriesForBasket(b.id).length > 0
  );

  const markSeenCount = (key: string, count: number, setter: (value: number) => void) => {
    window.localStorage.setItem(`${seenPrefix}_${key}`, String(count));
    setter(count);
  };

  const openMainTab = (nextTab: "browse" | "map" | "my" | "ratings") => {
    if (nextTab === "my") {
      markSeenCount("reservations", offerReservationRequests.length + completedBaskets.length, setSeenReservationsCount);
    }
    setTab(nextTab);
  };

  const openReservationTab = (nextTab: "offers" | "baskets") => {
    if (nextTab === "offers") {
      markSeenCount("offers_completed", offerReservationRequests.length, setSeenCompletedOffersCount);
    } else {
      markSeenCount("baskets_completed", completedBaskets.length, setSeenCompletedBasketsCount);
    }
    setReservationTab(nextTab);
  };

  const completedOffersTotal = completedOfferRequests.length;
  const offerReservationsTotal = offerReservationRequests.length;
  const completedBasketsTotal = completedBaskets.length;
  const completedReservationsTotal = completedOffersTotal + completedBasketsTotal;
  const reservationsTotal = offerReservationsTotal + completedBasketsTotal;

  const reservationsUnread = Math.max(reservationsTotal - seenReservationsCount, 0);
  const completedOffersUnread = Math.max(offerReservationsTotal - seenCompletedOffersCount, 0);
  const completedBasketsUnread = Math.max(completedBasketsTotal - seenCompletedBasketsCount, 0);

  const stats = {
    available: availableOffers.length,
    reserved: myRequests.filter((r: any) => !["cancelled", "rejected", "completed", "delivery_confirmed"].includes(r.status)).length,
    completed: completedReservationsTotal,
  };

  const renderReviewList = (items: any[], emptyLabel: string) => (
    items.length === 0 ? (
      <div className="text-sm text-muted-foreground p-6 bg-background rounded-2xl border border-dashed">
        {emptyLabel}
      </div>
    ) : (
      <div className="space-y-3">
        {items.map((review: any) => (
          <Card key={review.id} className="border-0 shadow-md">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-sm">{review.fromUser?.name || review.fromName || review.fromType}</div>
                <div className="text-amber-500 font-bold">{"★".repeat(review.rating)}</div>
              </div>
              {renderExpandableText(review.comment)}
              <div className="text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleDateString(t.locale)}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  );

  return (
    <div className="min-h-screen flex flex-col bg-accent/20">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-black">{tc.title}</h1>
          <p className="text-muted-foreground mt-1">
            Welcome, <span className="font-bold text-primary">{user?.name}</span> — {tc.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard label={tc.availableNow} value={stats.available} icon={Utensils} color="gradient-primary" />
          <StatCard label={tc.reservedByMe} value={stats.reserved} icon={Package} color="bg-amber-500" />
          <StatCard label={tc.received} value={stats.completed} icon={Star} color="bg-green-500" />
        </div>

        <div className="flex gap-2 mb-6 bg-muted/50 p-1 rounded-xl w-fit flex-wrap">
          {[
            { key: "browse", label: tc.browseOffers, icon: Utensils },
            { key: "map", label: tc.mapView ?? "Map View", icon: Map },
            { key: "my", label: tc.myReservations, icon: Package, badge: reservationsUnread },
            { key: "ratings", label: tc.myRating ?? "My Rating", icon: Star },
          ].map((item) => {
            const { key, label, icon: Icon } = item;
            const badgeCount = "badge" in item && typeof item.badge === "number" ? item.badge : 0;

            return (
              <button
                key={key}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-bold transition-all relative ${tab === key ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => openMainTab(key as "browse" | "map" | "my" | "ratings")}
                data-testid={`tab-${key}`}
              >
                <Icon className="w-4 h-4" /> {label}
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -start-1 w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab === "browse" ? (
          <div>
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={tc.searchPlaceholder} className="pl-10 rounded-xl" data-testid="input-search" />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-44 rounded-xl" data-testid="select-category">
                    <SelectValue placeholder={tc.allCategories} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tc.allCategories}</SelectItem>
                    {Object.entries(t.categories).map(([k, v]) => <SelectItem key={k} value={k}>{v as string}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-40 rounded-xl bg-muted/50 animate-pulse" />)}
              </div>
            ) : filteredOffers.length === 0 ? (
              <div className="text-center py-16 bg-background rounded-2xl border-2 border-dashed">
                <HandHeart className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="font-bold text-muted-foreground mb-1">{tc.noOffers}</h3>
                <p className="text-sm text-muted-foreground">{tc.trySearch}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredOffers.map(offer => (
                  <Card key={offer.id} className="border-0 shadow-md card-hover overflow-hidden" data-testid={`card-offer-${offer.id}`}>
                    {offer.isUrgent && <div className="bg-red-500 text-white text-xs font-bold px-3 py-1 text-center">{tc.urgent}</div>}
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h3 className="font-bold text-base mb-0.5">{offer.title}</h3>
                          <span className="text-xs text-muted-foreground">{(t.categories as any)[offer.category] ?? offer.category}</span>
                        </div>
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold whitespace-nowrap">
                          {offer.quantity} {offer.unit}
                        </Badge>
                      </div>
                      <div className="space-y-1.5 text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-2"><MapPin className="w-4 h-4 shrink-0" /><span className="truncate">{offer.pickupLocation}</span></div>
                        <div className="flex items-center gap-2"><Clock className="w-4 h-4 shrink-0" /><span>{tc.expiresAt} {new Date(offer.expiresAt).toLocaleString(t.locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div>
                        {offer.restaurant && <div className="flex items-center gap-2"><Utensils className="w-4 h-4 shrink-0" /><span>{offer.restaurant.name}</span></div>}
                      </div>
                      <Button className="w-full rounded-xl h-10 font-bold" onClick={() => handleReserve(offer.id)} disabled={reserving === offer.id} data-testid={`button-reserve-${offer.id}`}>
                        {reserving === offer.id ? tc.reserving : tc.reserveNow}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : tab === "map" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {(tc.mapHint ?? "Showing {{count}} available pickup locations on the map. Click a marker to see details.").replace("{{count}}", String(mapMarkers.length))}
            </p>
            <div className="rounded-2xl overflow-hidden border shadow-md" style={{ height: 500 }}>
              <Suspense fallback={<div className="w-full h-full bg-muted/30 flex items-center justify-center text-muted-foreground text-sm animate-pulse">Loading map...</div>}>
                <LeafletMap markers={mapMarkers} center={[24.7136, 46.6753]} zoom={12} />
              </Suspense>
            </div>
          </div>
        ) : tab === "my" ? (
          <div className="space-y-4">
            <div className="flex gap-2 bg-muted/50 p-1 rounded-xl w-fit flex-wrap mb-4">
              <button
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${reservationTab === "offers" ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => openReservationTab("offers")}
              >
                {tc.offersCompleted ?? "Offers"}
                {completedOffersUnread > 0 && (
                  <Badge className="ms-2 bg-amber-500 text-white">{completedOffersUnread > 9 ? "9+" : completedOffersUnread}</Badge>
                )}
              </button>
              <button
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${reservationTab === "baskets" ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => openReservationTab("baskets")}
              >
                {tc.basketsCompleted ?? "Baskets Completed"}
                {completedBasketsUnread > 0 && (
                  <Badge className="ms-2 bg-amber-500 text-white">{completedBasketsUnread > 9 ? "9+" : completedBasketsUnread}</Badge>
                )}
              </button>
            </div>

            {reservationTab === "offers" ? (
              offerReservationRequests.length === 0 ? (
                <div className="text-center py-16 bg-background rounded-2xl border-2 border-dashed">
                  <Package className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="font-bold text-muted-foreground mb-1">{tc.noReservations}</h3>
                  <Button className="mt-4 rounded-full" onClick={() => setTab("browse")}>{tc.browseOffers}</Button>
                </div>
              ) : (
                offerReservationRequests.map(req => {
                  const stColor = statusColors[req.status] ?? "bg-green-100 text-green-700";
                  const stLabel = ((t as any).requestStatuses as Record<string, string>)?.[req.status] ?? (t.status as any)?.[req.status] ?? req.status;
                  const delivery = getCompletedDeliveryForRequest(req.id);
                  return (
                    <Card key={req.id} className="border-0 shadow-md card-hover" data-testid={`card-request-${req.id}`}>
                      <CardContent className="p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-bold">{req.offer?.title}</h3>
                              <Badge className={`${stColor} border-0 text-xs`}>{stLabel}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                              {req.offer?.restaurant && <span className="flex items-center gap-1.5"><Utensils className="w-4 h-4" />{req.offer.restaurant.name}</span>}
                              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{req.offer?.pickupLocation}</span>
                              <span className="flex items-center gap-1.5"><Package className="w-4 h-4" />{req.offer?.quantity} {req.offer?.unit}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 justify-end">
                            {req.status === "pending" ? (
                              <Button
                                size="sm"
                                className="rounded-xl gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => handleConfirm(req.id)}
                                data-testid={`button-accept-reservation-${req.id}`}
                              >
                                <CheckCircle className="w-4 h-4" />
                                {tc.acceptReservation ?? tc.acceptOffer ?? "Accept request"}
                              </Button>
                            ) : (DONE_REQUEST_STATUSES.includes(req.status) || delivery) ? (
                              <>
                                {(() => {
                                  const restaurantRated = hasGivenRating({ requestId: req.id, toType: "restaurant" });
                                  return (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className={ratingButtonClass(restaurantRated, "amber")}
                                      disabled={restaurantRated}
                                      onClick={() => !restaurantRated && openRatingDialog("restaurant", { requestId: req.id, title: req.offer?.title })}
                                    >
                                      <Star className="w-4 h-4" /> {restaurantRated ? ratedLabel : (tc.rateRestaurant ?? t.ratings.rateRestaurant)}
                                    </Button>
                                  );
                                })()}
                                {(() => {
                                  const driverRated = hasGivenRating({ requestId: req.id, deliveryId: delivery?.id ?? null, toType: "delivery" });
                                  return (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className={ratingButtonClass(driverRated, "blue")}
                                      disabled={driverRated}
                                      onClick={() => !driverRated && openRatingDialog("delivery", { requestId: req.id, deliveryId: delivery?.id ?? null, title: req.offer?.title })}
                                    >
                                      <Truck className="w-4 h-4" /> {driverRated ? ratedLabel : (tc.rateDriver ?? t.ratings.rateDriver)}
                                    </Button>
                                  );
                                })()}
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground font-medium">
                                {tc.waitingForDelivery ?? "Waiting for delivery"}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )
            ) : (
              completedBaskets.length === 0 ? (
                <div className="text-center py-16 bg-background rounded-2xl border-2 border-dashed">
                  <ShoppingBasket className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="font-bold text-muted-foreground mb-1">{tc.noReservations}</h3>
                </div>
              ) : (
                completedBaskets.flatMap((basket: any) => {
                  const deliveries = getCompletedDeliveriesForBasket(basket.id);
                  return (deliveries.length ? deliveries : [{ basketId: basket.id, id: null, restaurant: null, deliveryPersonId: null }]).map((delivery: any, idx: number) => (
                    <Card key={`${basket.id}-${delivery.id ?? idx}`} className="border-0 shadow-md card-hover" data-testid={`card-basket-completed-${basket.id}-${idx}`}>
                      <CardContent className="p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-bold">{basket.title}</h3>
                              <Badge className="bg-green-100 text-green-700 border-0 text-xs">{tc.statusCompleted ?? "Completed"}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                              {delivery.restaurant?.name && <span className="flex items-center gap-1.5"><Utensils className="w-4 h-4" />{delivery.restaurant.name}</span>}
                              <span className="flex items-center gap-1.5"><ShoppingBasket className="w-4 h-4" />#{basket.id}</span>
                              {basket.expiresAt && <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{new Date(basket.expiresAt).toLocaleDateString(t.locale)}</span>}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 justify-end">
                            {(() => {
                              const restaurantRated = delivery.id ? hasGivenRating({ deliveryId: delivery.id, toType: "restaurant" }) : false;
                              return (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={ratingButtonClass(restaurantRated, "amber")}
                                  disabled={!delivery.id || restaurantRated}
                                  onClick={() => delivery.id && !restaurantRated && openRatingDialog("restaurant", { deliveryId: delivery.id, title: basket.title })}
                                >
                                  <Star className="w-4 h-4" /> {restaurantRated ? ratedLabel : (tc.rateRestaurant ?? t.ratings.rateRestaurant)}
                                </Button>
                              );
                            })()}
                            {(() => {
                              const driverRated = delivery.id ? hasGivenRating({ deliveryId: delivery.id, toType: "delivery" }) : false;
                              return (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={ratingButtonClass(driverRated, "blue")}
                                  disabled={!delivery.id || driverRated}
                                  onClick={() => delivery.id && !driverRated && openRatingDialog("delivery", { deliveryId: delivery.id, title: basket.title })}
                                >
                                  <Truck className="w-4 h-4" /> {driverRated ? ratedLabel : (tc.rateDriver ?? t.ratings.rateDriver)}
                                </Button>
                              );
                            })()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ));
                })
              )
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2 bg-muted/50 p-1 rounded-xl w-fit flex-wrap mb-4">
              <button className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${reviewsTab === "restaurant" ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setReviewsTab("restaurant")}>
                {tc.restaurantReviews ?? "Restaurant Reviews"}
              </button>
              <button className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${reviewsTab === "delivery" ? "bg-background shadow-md text-primary" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setReviewsTab("delivery")}>
                {tc.deliveryReviews ?? "Delivery Reviews"}
              </button>
            </div>
            {reviewsTab === "restaurant"
              ? renderReviewList(restaurantReviews, tc.noRestaurantReviews ?? "No restaurant reviews yet")
              : renderReviewList(deliveryReviews, tc.noDeliveryReviews ?? "No delivery reviews yet")}
          </div>
        )}
      </main>

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

      <Dialog open={!!ratingDialog?.open} onOpenChange={() => setRatingDialog(null)}>
        <DialogContent className="rounded-2xl max-w-sm" data-testid="dialog-rating">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400" /> {ratingDialog?.targetType === "delivery" ? (tc.rateDriver ?? t.ratings.rateDriver) : (tc.rateRestaurant ?? t.ratings.rateRestaurant)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <p className="text-sm text-muted-foreground">{t.ratings.dialogDesc} {ratingDialog?.title ? <>— <strong>{ratingDialog.title}</strong></> : null}</p>
            <div className="flex justify-center">
              <StarRating value={ratingValue} onChange={setRatingValue} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.ratings.commentPlaceholder}</label>
              <Textarea
                placeholder={t.ratings.commentPlaceholder}
                value={ratingComment}
                onChange={e => setRatingComment(e.target.value)}
                rows={3}
                className="rounded-xl resize-none"
                data-testid="input-rating-comment"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setRatingDialog(null)}>{tc.cancel}</Button>
            <Button className="rounded-xl gap-1.5" onClick={handleSubmitRating} disabled={ratingSubmitting || ratingValue === 0} data-testid="button-submit-rating">
              <Star className="w-4 h-4" /> {ratingSubmitting ? t.ratings.submitting : t.ratings.submitBtn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
