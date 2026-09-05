import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/components/LanguageProvider";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { ShoppingBasket, Package, CheckCircle } from "lucide-react";

export default function RestaurantBaskets() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const user = getUser();
  const { t, dir, locale } = useLanguage();
  const rb = t.restaurantBaskets;

  const [baskets, setBaskets] = useState<any[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== "restaurant") {
      setLocation("/login");
      return;
    }
    loadBaskets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBaskets = async () => {
    setLoading(true);
    try {
      const data = await api.baskets.getAll();
      setBaskets(data);
    } catch (err: any) {
      toast({ title: rb.toastLoadError, description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleContribute = async (basketId: number) => {
    const basket = baskets.find(b => b.id === basketId);
    if (!basket) return;

    const contributions = basket.items
      .filter((item: any) => quantities[item.id] > 0)
      .map((item: any) => ({
        basketItemId: item.id,
        quantity: quantities[item.id],
      }));

    if (contributions.length === 0) {
      toast({ title: rb.toastAtLeastOne, variant: "destructive" });
      return;
    }

    setSubmitting(basketId);
    try {
      const result: any = await api.baskets.contribute(basketId, { contributions });
      toast({ title: `${rb.toastContributed} ${result.completion}%` });

      const newQty = { ...quantities };
      basket.items.forEach((item: any) => {
        delete newQty[item.id];
      });
      setQuantities(newQty);

      loadBaskets();
    } catch (err: any) {
      toast({ title: rb.toastError, description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-accent/20" dir={dir}>
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-black flex items-center gap-2" data-testid="text-page-title">
            <ShoppingBasket className="w-6 h-6 text-primary" />
            {rb.pageTitle}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{rb.subtitle}</p>
        </div>

        {loading ? (
          [1, 2].map(i => (
            <div key={i} className="h-48 rounded-xl bg-muted/50 animate-pulse mb-4" />
          ))
        ) : baskets.length === 0 ? (
          <div className="text-center py-16 bg-background rounded-2xl border-2 border-dashed">
            <ShoppingBasket className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
            <p className="font-bold text-muted-foreground">{rb.noOpenBaskets}</p>
          </div>
        ) : (
          baskets.map(basket => (
            <Card key={basket.id} className="border-0 shadow-md mb-4" data-testid={`card-basket-${basket.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{basket.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {basket.charity?.name} • {rb.expiresLabel}{" "}
                      {new Date(basket.expiresAt).toLocaleDateString(locale)}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-black text-primary">{basket.completion}%</div>
                    <div className="text-xs text-muted-foreground">{rb.completedPct}</div>
                  </div>
                </div>

                <Progress value={basket.completion} className="h-2 mb-4" />

                <div className="space-y-3 mb-4">
                  {basket.items?.map((item: any) => {
                    const remaining = item.requestedQty - item.fulfilledQty;
                    const isFull = remaining <= 0;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${
                          isFull
                            ? "bg-green-50 border-green-200 opacity-60"
                            : "bg-muted/20 border-border"
                        }`}
                      >
                        {isFull ? (
                          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                        ) : (
                          <Package className="w-5 h-5 text-primary shrink-0" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{item.productName}</span>
                            <Badge className="text-xs bg-muted text-muted-foreground border-0">
                              {item.category}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {rb.remaining}: {remaining} {item.unit} {rb.of} {item.requestedQty}
                          </div>
                        </div>
                        {!isFull && (
                          <Input
                            type="number"
                            min="1"
                            max={remaining}
                            value={quantities[item.id] || ""}
                            onChange={e =>
                              setQuantities(prev => ({
                                ...prev,
                                [item.id]: parseInt(e.target.value) || 0,
                              }))
                            }
                            placeholder="0"
                            className="w-20 h-9 text-center"
                            data-testid={`input-qty-${item.id}`}
                          />
                        )}
                        {isFull && (
                          <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                            {rb.completedBadge}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>

                {basket.items?.some(
                  (i: any) => i.fulfilledQty < i.requestedQty,
                ) && (
                  <Button
                    className="w-full rounded-xl gap-2"
                    onClick={() => handleContribute(basket.id)}
                    disabled={submitting === basket.id}
                    data-testid={`button-contribute-${basket.id}`}
                  >
                    <ShoppingBasket className="w-4 h-4" />
                    {submitting === basket.id ? rb.contributing : rb.contributeBtn}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
