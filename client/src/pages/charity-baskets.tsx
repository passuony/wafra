import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/components/LanguageProvider";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { ShoppingBasket, Plus, Trash2, Clock, CheckCircle } from "lucide-react";

type ItemDraft = {
  productName: string;
  category: string;
  requestedQty: number;
  unit: string;
  notes: string;
};

export default function CharityBaskets() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const user = getUser();
  const { t, dir, locale } = useLanguage();
  const tb = t.charityBaskets;

  const emptyItem = (): ItemDraft => ({
    productName: "",
    category: "hot",
    requestedQty: 1,
    unit: tb.units[0],
    notes: "",
  });

  const [tab, setTab] = useState<"browse" | "my" | "create">("browse");
  const [baskets, setBaskets] = useState<any[]>([]);
  const [myBaskets, setMyBaskets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [creating, setCreating] = useState(false);

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
      const [all, my] = await Promise.all([
        api.baskets.getAll(),
        api.baskets.getMy(),
      ]);
      setBaskets(all);
      setMyBaskets(my);
    } catch (e: any) {
      toast({ title: tb.toastLoadError, description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    if (items.length >= 20) return;
    setItems([...items, emptyItem()]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ItemDraft, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value } as ItemDraft;
    setItems(updated);
  };

  const handleCreateBasket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !expiresAt) {
      toast({ title: tb.toastFillRequired, variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await api.baskets.create({
        title,
        description: description || undefined,
        expiresAt,
        items: items.map(it => ({
          productName: it.productName,
          category: it.category,
          requestedQty: it.requestedQty,
          unit: it.unit,
          notes: it.notes || undefined,
        })),
      });
      toast({ title: tb.toastCreated });
      setTitle("");
      setDescription("");
      setExpiresAt("");
      setItems([emptyItem()]);
      setTab("my");
      loadData();
    } catch (err: any) {
      toast({ title: tb.toastError, description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = async (basketId: number) => {
    try {
      await api.baskets.cancel(basketId);
      toast({ title: tb.toastCancelled });
      loadData();
    } catch (err: any) {
      toast({ title: tb.toastError, description: err.message, variant: "destructive" });
    }
  };

  const getStatusColor = (status: string) =>
    ({
      open: "bg-blue-100 text-blue-700",
      partial: "bg-amber-100 text-amber-700",
      completed: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700",
      expired: "bg-gray-100 text-gray-600",
    } as Record<string, string>)[status] || "bg-gray-100";

  const getStatusLabel = (status: string) =>
    ({
      open: tb.statusOpen,
      partial: tb.statusPartial,
      completed: tb.statusCompleted,
      cancelled: tb.statusCancelled,
      expired: tb.statusExpired,
    } as Record<string, string>)[status] || status;

  const categoryOptions = [
    { value: "hot", label: tb.categoryHot },
    { value: "cold", label: tb.categoryCold },
    { value: "bakery", label: tb.categoryBakery },
    { value: "fruits", label: tb.categoryFruits },
    { value: "dairy", label: tb.categoryDairy },
    { value: "other", label: tb.categoryOther },
  ];

  const tabs = [
    { key: "browse", label: tb.tabBrowse },
    { key: "my", label: tb.tabMy },
    { key: "create", label: tb.tabCreate },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-accent/20" dir={dir}>
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2" data-testid="text-page-title">
            <ShoppingBasket className="w-7 h-7 text-primary" />
            {tb.pageTitle}
          </h1>
          <p className="text-muted-foreground mt-1">{tb.subtitle}</p>
        </div>

        <div className="flex gap-2 mb-6 bg-muted/50 p-1 rounded-xl w-fit">
          {tabs.map(tabItem => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key as any)}
              data-testid={`tab-${tabItem.key}`}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                tab === tabItem.key
                  ? "bg-background shadow-md text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tabItem.label}
            </button>
          ))}
        </div>

        {tab === "browse" && (
          <div className="space-y-4">
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="h-32 rounded-xl bg-muted/50 animate-pulse" />
              ))
            ) : baskets.length === 0 ? (
              <div className="text-center py-16 bg-background rounded-2xl border-2 border-dashed">
                <ShoppingBasket className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground font-bold">{tb.noOpenBaskets}</p>
              </div>
            ) : (
              baskets.map(basket => (
                <Card key={basket.id} className="border-0 shadow-md" data-testid={`card-basket-${basket.id}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold" data-testid={`text-basket-title-${basket.id}`}>
                            {basket.title}
                          </h3>
                          <Badge className={`${getStatusColor(basket.status)} border-0 text-xs`}>
                            {getStatusLabel(basket.status)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {basket.charity?.name} • {tb.expiresLabel}{" "}
                          {new Date(basket.expiresAt).toLocaleDateString(locale)}
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-black text-primary">{basket.completion}%</div>
                        <div className="text-xs text-muted-foreground">{tb.completedPct}</div>
                      </div>
                    </div>
                    <Progress value={basket.completion} className="h-2 mb-3" />
                    <div className="flex flex-wrap gap-2">
                      {basket.items?.map((item: any) => (
                        <div
                          key={item.id}
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${
                            item.status === "fulfilled"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : item.status === "partial"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-gray-50 text-gray-600 border-gray-200"
                          }`}
                        >
                          {item.productName}: {item.fulfilledQty}/{item.requestedQty} {item.unit}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {tab === "my" && (
          <div className="space-y-4">
            {myBaskets.length === 0 ? (
              <div className="text-center py-16 bg-background rounded-2xl border-2 border-dashed">
                <ShoppingBasket className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground font-bold mb-4">{tb.noMyBaskets}</p>
                <Button
                  onClick={() => setTab("create")}
                  className="rounded-full"
                  data-testid="button-create-first-basket"
                >
                  {tb.createFirstBasket}
                </Button>
              </div>
            ) : (
              myBaskets.map(basket => (
                <Card key={basket.id} className="border-0 shadow-md" data-testid={`card-my-basket-${basket.id}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold">{basket.title}</h3>
                          <Badge className={`${getStatusColor(basket.status)} border-0 text-xs`}>
                            {getStatusLabel(basket.status)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {tb.expiresLabel} {new Date(basket.expiresAt).toLocaleDateString(locale)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <div className="text-2xl font-black text-primary">{basket.completion}%</div>
                          <div className="text-xs text-muted-foreground">{tb.completedPct}</div>
                        </div>
                        {(basket.status === "open" || basket.status === "partial") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50 rounded-xl text-xs"
                            onClick={() => handleCancel(basket.id)}
                            data-testid={`button-cancel-basket-${basket.id}`}
                          >
                            {tb.cancelBtn}
                          </Button>
                        )}
                      </div>
                    </div>
                    <Progress value={basket.completion} className="h-2 mb-3" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {basket.items?.map((item: any) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm"
                        >
                          <span className="font-medium">{item.productName}</span>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={(item.fulfilledQty / item.requestedQty) * 100}
                              className="w-16 h-1.5"
                            />
                            <span className="text-xs text-muted-foreground">
                              {item.fulfilledQty}/{item.requestedQty}
                            </span>
                            {item.status === "fulfilled" && (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {tab === "create" && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBasket className="w-5 h-5 text-primary" />
                {tb.createCardTitle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateBasket} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{tb.basketTitle}</Label>
                    <Input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder={tb.basketTitlePlaceholder}
                      required
                      data-testid="input-basket-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{tb.expiresAt}</Label>
                    <Input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={e => setExpiresAt(e.target.value)}
                      required
                      data-testid="input-basket-expires"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{tb.description}</Label>
                  <Input
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={tb.descPlaceholder}
                    data-testid="input-basket-description"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-bold">
                      {tb.itemsLabel} ({items.length}/20)
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addItem}
                      disabled={items.length >= 20}
                      className="gap-1 rounded-xl"
                      data-testid="button-add-item"
                    >
                      <Plus className="w-4 h-4" /> {tb.addItemBtn}
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <div key={index} className="p-4 border rounded-xl bg-muted/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-primary">{tb.itemN} {index + 1}</span>
                          {items.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(index)}
                              className="text-red-500 hover:text-red-600 h-7 w-7 p-0"
                              data-testid={`button-remove-item-${index}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">{tb.productName}</Label>
                            <Input
                              value={item.productName}
                              onChange={e => updateItem(index, "productName", e.target.value)}
                              placeholder={tb.productNamePlaceholder}
                              required
                              className="h-9"
                              data-testid={`input-item-name-${index}`}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">{tb.quantity}</Label>
                            <Input
                              type="number"
                              value={item.requestedQty}
                              onChange={e => updateItem(index, "requestedQty", parseInt(e.target.value) || 1)}
                              min="1"
                              required
                              className="h-9"
                              data-testid={`input-item-qty-${index}`}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">{tb.unit}</Label>
                            <Select
                              value={item.unit}
                              onValueChange={v => updateItem(index, "unit", v)}
                            >
                              <SelectTrigger className="h-9" data-testid={`select-item-unit-${index}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {tb.units.map(u => (
                                  <SelectItem key={u} value={u}>{u}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2 sm:col-span-4 space-y-1">
                            <Label className="text-xs">{tb.category}</Label>
                            <Select
                              value={item.category}
                              onValueChange={v => updateItem(index, "category", v)}
                            >
                              <SelectTrigger className="h-9" data-testid={`select-item-category-${index}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {categoryOptions.map(c => (
                                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 font-bold rounded-xl gap-2"
                  disabled={creating}
                  data-testid="button-create-basket"
                >
                  <ShoppingBasket className="w-5 h-5" />
                  {creating ? tb.creating : tb.createBtn}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
