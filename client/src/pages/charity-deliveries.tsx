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
  Truck, MapPin, Navigation, CheckCircle, Clock, Package,
  Map as MapIcon, Hourglass, PackageCheck, Store, MoveRight, Star, AlertCircle,
} from "lucide-react";

const NEEDS_CONFIRMATION = ["arrived", "waiting_for_charity_confirmation"];
const IN_PROGRESS = ["available", "pending", "accepted", "going_to_restaurant", "picked_up", "going_to_charity", "waiting_for_delivery_confirmation"];
const COMPLETED = ["confirmed_by_delivery", "delivered"];

const STEP_KEYS = ["accepted", "going_to_restaurant", "picked_up", "going_to_charity", "arrived", "confirmed_by_delivery"];

export default function CharityDeliveriesPage() {
  const { t, dir } = useLanguage();
  const cd = t.charityDeliveries;
  const ds = t.deliveryStatuses;
  const r = t.ratings;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const user = getUser();

  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [mapDelivery, setMapDelivery] = useState<any | null>(null);

  const [givenRatings, setGivenRatings] = useState<any[]>([]);
  const [ratingDialog, setRatingDialog] = useState<{ open: boolean; delivery: any } | null>(null);
  const [ratingTarget, setRatingTarget] = useState<"restaurant" | "delivery">("delivery");
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);

  const ratedLabel = (t as any).common?.rated ?? "Rated";

  useEffect(() => {
    if (!user || user.role !== "charity") { setLocation("/login"); return; }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [deliveryList, given] = await Promise.all([
        api.deliveries.getCharityDeliveries(),
        api.ratings.getGiven().catch(() => ({ ratings: [] })),
      ]);
      setDeliveries(deliveryList);
      setGivenRatings(given?.ratings ?? []);
    } catch (e: any) {
      toast({ title: t.errors.loadError, description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
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

  const handleConfirmReceipt = async (delivery: any) => {
    setActing(delivery.id);
    try {
      await api.deliveries.charityConfirmReceipt(delivery.id);
      toast({ title: cd.confirmedMsg, description: cd.confirmedDesc });
      loadData();
    } catch (err: any) {
      toast({ title: t.errors.error, description: err.message, variant: "destructive" });
    } finally { setActing(null); }
  };

  const handleSubmitRating = async () => {
    if (!ratingDialog?.delivery?.requestId && !ratingDialog?.delivery?.id) return;
    setRatingLoading(true);
    try {
      await api.ratings.create({
        requestId: ratingDialog.delivery.requestId ?? null,
        deliveryId: ratingDialog.delivery.requestId ? null : ratingDialog.delivery.id,
        toType: ratingTarget,
        rating: ratingValue,
        comment: ratingComment || undefined,
      } as any);
      toast({ title: `${r.submittedMsg} (${ratingValue}/5)` });
      setRatingDialog(null);
      setRatingComment("");
      setRatingValue(5);
      loadData();
    } catch (err: any) {
      toast({ title: r.errorMsg, description: err.message, variant: "destructive" });
    } finally { setRatingLoading(false); }
  };

  // Status info map using translation keys
  const getStatusInfo = (status: string) => {
    const map: Record<string, { label: string; color: string; icon: any }> = {
      available: { label: ds.available, color: "bg-blue-100 text-blue-700", icon: Hourglass },
      pending: { label: ds.pending, color: "bg-blue-100 text-blue-700", icon: Hourglass },
      accepted: { label: ds.accepted, color: "bg-amber-100 text-amber-700", icon: Truck },
      going_to_restaurant: { label: ds.going_to_restaurant, color: "bg-orange-100 text-orange-700", icon: Store },
      picked_up: { label: ds.picked_up, color: "bg-purple-100 text-purple-700", icon: Navigation },
      going_to_charity: { label: ds.going_to_charity, color: "bg-indigo-100 text-indigo-700", icon: Truck },
      arrived: { label: ds.charity_arrived, color: "bg-orange-100 text-orange-700", icon: PackageCheck },
      waiting_for_charity_confirmation: { label: ds.charity_arrived, color: "bg-orange-100 text-orange-700", icon: PackageCheck },
      waiting_for_delivery_confirmation: { label: ds.charity_waiting_for_delivery, color: "bg-green-100 text-green-700", icon: CheckCircle },
      confirmed_by_delivery: { label: ds.confirmed_by_delivery, color: "bg-green-200 text-green-800", icon: CheckCircle },
      cancelled: { label: ds.cancelled, color: "bg-red-100 text-red-700", icon: Package },
      delivered: { label: ds.delivered, color: "bg-green-100 text-green-700", icon: CheckCircle },
    };
    return map[status] || map.available;
  };

  const STEPS = [
    { key: "accepted", label: t.delivery.stepAccepted },
    { key: "going_to_restaurant", label: t.delivery.stepGoRestaurant },
    { key: "picked_up", label: t.delivery.stepPickup },
    { key: "going_to_charity", label: t.delivery.stepGoCharity },
    { key: "arrived", label: t.delivery.stepArrived },
    { key: "confirmed_by_delivery", label: t.delivery.stepConfirm },
  ];

  const needsConfirmationList = deliveries.filter(dv => NEEDS_CONFIRMATION.includes(dv.status));
  const inProgressList = deliveries.filter(dv => IN_PROGRESS.includes(dv.status));
  const completedList = deliveries.filter(dv => COMPLETED.includes(dv.status));
  const stepIndex = (s: string) => STEP_KEYS.indexOf(s);

  const renderCard = (dv: any) => {
    const info = getStatusInfo(dv.status);
    const Icon = info.icon;
    const needsConfirm = NEEDS_CONFIRMATION.includes(dv.status);
    const isDone = COMPLETED.includes(dv.status);
    const isBasketDelivery = Boolean(dv.basketId);
    const typeLabel = isBasketDelivery
      ? ((cd as any).basketDelivery ?? "Basket Delivery")
      : ((cd as any).offerDelivery ?? "Offer Delivery");
    const si = stepIndex(dv.status);

    return (
      <Card key={dv.id} className="border-0 shadow-md" data-testid={`card-delivery-${dv.id}`}>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <span className="font-bold">{dv.basketId ? `#${dv.basketId}` : `#${dv.requestId}`}</span>
              <Badge className={isBasketDelivery ? "bg-purple-100 text-purple-700 border-0 text-xs" : "bg-sky-100 text-sky-700 border-0 text-xs"}>
                {typeLabel}
              </Badge>
              <Badge className={`${info.color} border-0 text-xs gap-1`}><Icon className="w-3 h-3" />{info.label}</Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />{new Date(dv.createdAt).toLocaleString(t.locale)}
            </div>
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 shrink-0 text-red-400" />
              <span><span className="font-bold text-foreground">{cd.from}: </span>
                {dv.restaurant?.name ? `${dv.restaurant.name} — ` : ""}{dv.pickupAddress}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 shrink-0 text-green-500" />
              <span><span className="font-bold text-foreground">{cd.to}: </span>{dv.dropoffAddress}</span>
            </div>
          </div>

          {/* Progress stepper */}
          {si >= 0 && !isDone && (
            <div className="flex items-center gap-1 overflow-x-auto py-1">
              {STEPS.map((step, idx) => (
                <div key={step.key} className="flex items-center gap-1 shrink-0">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${idx < si ? "bg-green-500 text-white" : idx === si ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                    }`}>
                    {idx < si ? "✓" : idx + 1}
                  </div>
                  <span className={`text-xs hidden sm:inline ${idx <= si ? "text-foreground font-medium" : "text-muted-foreground"}`}>{step.label}</span>
                  {idx < STEPS.length - 1 && <MoveRight className={`w-3 h-3 ${idx < si ? "text-green-500" : "text-muted-foreground/40"}`} />}
                </div>
              ))}
            </div>
          )}

          {/* Confirm receipt action */}
          {needsConfirm && (
            <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <span className="font-bold text-orange-700 dark:text-orange-400 text-sm">{cd.confirmReceiptAlert}</span>
              </div>
              <p className="text-xs text-orange-600 dark:text-orange-500 mb-3">{cd.confirmReceiptDesc}</p>
              <Button className="w-full rounded-xl gap-2 bg-green-600 hover:bg-green-700"
                onClick={() => handleConfirmReceipt(dv)} disabled={acting === dv.id}
                data-testid={`button-confirm-receipt-${dv.id}`}>
                <CheckCircle className="w-4 h-4" />
                {acting === dv.id ? cd.confirming : cd.confirmReceiptBtn}
              </Button>
            </div>
          )}

          {dv.status === "waiting_for_delivery_confirmation" && (
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <CheckCircle className="w-4 h-4" />{cd.awaitingDriver}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => setMapDelivery(dv)} data-testid={`button-map-${dv.id}`}>
              <MapIcon className="w-4 h-4" />{cd.mapBtn}
            </Button>
            {isDone && (dv.requestId || dv.basketId) && (() => {
              const restaurantRated = hasGivenRating({
                requestId: dv.requestId ?? null,
                deliveryId: dv.id ?? null,
                toType: "restaurant",
              });
              const driverRated = hasGivenRating({
                requestId: dv.requestId ?? null,
                deliveryId: dv.id ?? null,
                toType: "delivery",
              });

              return (
                <>
                  <Button
                    size="sm"
                    variant={restaurantRated ? "secondary" : "outline"}
                    disabled={restaurantRated}
                    className={
                      restaurantRated
                        ? "rounded-xl gap-1.5 bg-muted text-muted-foreground cursor-not-allowed opacity-70"
                        : "rounded-xl gap-1.5 border-amber-200 text-amber-600 hover:bg-amber-50"
                    }
                    onClick={() => {
                      if (restaurantRated) return;
                      setRatingTarget("restaurant");
                      setRatingDialog({ open: true, delivery: dv });
                    }}
                    data-testid={`button-rate-restaurant-${dv.id}`}
                  >
                    <Star className="w-4 h-4" />
                    {restaurantRated ? ratedLabel : cd.rateRestaurant}
                  </Button>
                  <Button
                    size="sm"
                    variant={driverRated ? "secondary" : "outline"}
                    disabled={driverRated}
                    className={
                      driverRated
                        ? "rounded-xl gap-1.5 bg-muted text-muted-foreground cursor-not-allowed opacity-70"
                        : "rounded-xl gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50"
                    }
                    onClick={() => {
                      if (driverRated) return;
                      setRatingTarget("delivery");
                      setRatingDialog({ open: true, delivery: dv });
                    }}
                    data-testid={`button-rate-driver-${dv.id}`}
                  >
                    <Star className="w-4 h-4" />
                    {driverRated ? ratedLabel : cd.rateDriver}
                  </Button>
                </>
              );
            })()}
          </div>

          {isDone && (
            <div className="flex items-center gap-2 text-green-600 text-sm font-bold">
              <CheckCircle className="w-4 h-4" />{cd.completedLabel}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-accent/20" dir={dir}>
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2" data-testid="text-page-title">
            <Truck className="w-7 h-7 text-primary" />{cd.pageTitle}
          </h1>
          <p className="text-muted-foreground mt-1">{cd.subtitle}</p>
        </div>

        {loading ? (
          <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-28 rounded-xl bg-muted/50 animate-pulse" />)}</div>
        ) : deliveries.length === 0 ? (
          <div className="text-center py-16 bg-background rounded-2xl border-2 border-dashed">
            <Truck className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
            <p className="font-bold text-muted-foreground">{cd.noDeliveries}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {needsConfirmationList.length > 0 && (
              <section>
                <h2 className="font-black text-orange-700 dark:text-orange-300 mb-3 flex items-center gap-2">
                  <PackageCheck className="w-5 h-5" />{cd.sectionNeedsConfirmation} ({needsConfirmationList.length})
                </h2>
                <div className="space-y-3">{needsConfirmationList.map(renderCard)}</div>
              </section>
            )}
            {inProgressList.length > 0 && (
              <section>
                <h2 className="font-black text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
                  <Truck className="w-5 h-5" />{cd.sectionInProgress} ({inProgressList.length})
                </h2>
                <div className="space-y-3">{inProgressList.map(renderCard)}</div>
              </section>
            )}
            {completedList.length > 0 && (
              <section>
                <h2 className="font-black text-green-700 dark:text-green-300 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />{cd.sectionCompleted} ({completedList.length})
                </h2>
                <div className="space-y-3">{completedList.map(renderCard)}</div>
              </section>
            )}
          </div>
        )}
      </main>

      <Dialog open={!!mapDelivery} onOpenChange={(open) => !open && setMapDelivery(null)}>
        <DialogContent className="max-w-3xl" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MapIcon className="w-5 h-5 text-primary" />{t.delivery.mapTitle}</DialogTitle>
          </DialogHeader>
          {mapDelivery && <DeliveryMap pickupAddress={mapDelivery.pickupAddress} dropoffAddress={mapDelivery.dropoffAddress} pickupLabel={mapDelivery.restaurant?.name || cd.from} dropoffLabel={cd.to} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!ratingDialog?.open} onOpenChange={(open) => !open && setRatingDialog(null)}>
        <DialogContent dir={dir} className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400" />
              {ratingTarget === "restaurant" ? r.rateRestaurant : r.rateDriver}
            </DialogTitle>
            <DialogDescription>{r.dialogDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setRatingValue(n)}
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