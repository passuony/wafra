import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { useLanguage } from "@/components/LanguageProvider";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BarChart3,
  Building2,
  CheckCircle,
  Edit,
  Eye,
  Home,
  Mail,
  MapPin,
  MessageSquare,
  Moon,
  Package,
  Phone,
  Search,
  Shield,
  Trash2,
  TrendingUp,
  Truck,
  Users,
  UserRound,
  Globe2,
  Bell,
  Box,
} from "lucide-react";

type Section =
  | "home"
  | "restaurants"
  | "charities"
  | "donations"
  | "reports"
  | "logs"
  | "messages"
type DonationView = "offers" | "baskets";
type ActiveView = "restaurants" | "charities" | "drivers";

const completedDeliveryStatuses = [
  "confirmed_by_delivery",
  "delivered",
  "completed",
];
const activeOfferStatuses = [
  "available",
  "reserved",
  "confirmed",
  "transferred",
];

function numberValue(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatDate(value: any, locale: string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

function labelStatus(
  status: string,
  statusLabels: Record<string, string>,
  basketStatus?: Record<string, string>,
) {
  return basketStatus?.[status] ?? statusLabels[status as keyof typeof statusLabels] ?? status;
}

function safeLower(value: any) {
  return String(value ?? "").toLowerCase();
}

function getCharityPickupStats(
  charityId: number,
  deliveries: any[],
  requests: any[],
  offers: any[],
  baskets: any[],
) {
  const completed = deliveries.filter(
    (d) =>
      Number(d.charityId) === Number(charityId) &&
      completedDeliveryStatuses.includes(d.status),
  );

  const requestById = new Map(requests.map((r) => [Number(r.id), r]));
  const offerById = new Map(offers.map((o) => [Number(o.id), o]));
  const basketById = new Map(baskets.map((b) => [Number(b.id), b]));
  const basketKgCounted = new Set<number>();

  let kg = 0;
  let offerPickups = 0;
  let basketPickups = 0;

  const countedRequestIds = new Set<number>();

  for (const d of completed) {
    if (d.requestId) {
      const requestId = Number(d.requestId);
      countedRequestIds.add(requestId);
      offerPickups += 1;
      const req = requestById.get(requestId);
      const offer = req ? offerById.get(Number(req.offerId)) : null;
      if (offer) kg += getQtyKg(offer);
    } else if (d.basketId) {
      basketPickups += 1;
      const basketId = Number(d.basketId);
      const basket = basketById.get(basketId);
      if (basket && !basketKgCounted.has(basketId)) {
        kg += numberValue(basket.totalFulfilled || basket.totalRequested);
        basketKgCounted.add(basketId);
      }
    }
  }

  // Fallback: completed surplus offers (requests) without a completed delivery row
  for (const req of requests) {
    if (Number(req.charityId) !== Number(charityId)) continue;
    if (req.status !== "completed") continue;
    if (countedRequestIds.has(Number(req.id))) continue;

    offerPickups += 1;
    const offer = offerById.get(Number(req.offerId));
    if (offer) kg += getQtyKg(offer);
  }

  return {
    pickups: offerPickups + basketPickups,
    offerPickups,
    basketPickups,
    kg: Math.round(kg),
  };
}

function getQtyKg(row: any) {
  const qty = numberValue(
    row?.quantity ?? row?.totalFulfilled ?? row?.totalRequested ?? 0,
  );
  const unit = String(row?.unit ?? "").toLowerCase();
  if (
    unit.includes("kg") ||
    unit.includes("kilogram") ||
    unit.includes("كيلو") ||
    unit.includes("кил")
  )
    return qty;
  return qty;
}

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  accent = "text-emerald-500",
}: {
  title: string;
  value: string | number;
  icon: any;
  trend?: string;
  accent?: string;
}) {
  return (
    <Card className="rounded-2xl border border-border/60 bg-card shadow-md">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <Icon className={`h-6 w-6 ${accent}`} />
          </div>
          <Icon className="h-9 w-9 text-muted-foreground/10" />
        </div>
        <div className="mt-5 flex items-end gap-3">
          <div className="text-3xl font-black tracking-tight">{value}</div>
          {trend && (
            <div className="pb-1 text-xs text-muted-foreground">{trend}</div>
          )}
        </div>
        <div className="mt-1 text-sm font-medium text-muted-foreground">
          {title}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  title,
  value,
  color = "text-emerald-500",
}: {
  title: string;
  value: string | number;
  color?: string;
}) {
  return (
    <Card className="rounded-2xl border-0 shadow-md bg-card">
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground mb-2">{title}</div>
        <div className={`text-2xl font-black ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function AdminSidebar({
  section,
  setSection,
  unreadMessages,
}: {
  section: Section;
  setSection: (s: Section) => void;
  unreadMessages: number;
}) {
  const { t } = useLanguage();
  const a: any = t.admin;

  const items: Array<{
    key: Section;
    label: string;
    icon: any;
    badge?: number;
  }> = [
    { key: "home", label: a.navHome, icon: Home },
    { key: "restaurants", label: a.navRestaurants, icon: Building2 },
    { key: "charities", label: a.navCharities, icon: Users },
    { key: "donations", label: a.navDonations, icon: Package },
    { key: "reports", label: a.navReports, icon: BarChart3 },
    { key: "logs", label: a.navLogs, icon: Activity },
    {
      key: "messages",
      label: a.navMessages,
      icon: MessageSquare,
      badge: unreadMessages,
    },
  ];

  return (
    <aside className="fixed top-16 bottom-0 start-0 z-30 w-[290px] border-e bg-background/95 backdrop-blur hidden lg:flex flex-col">
      <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const active = section === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setSection(item.key)}
              className={`relative w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-start font-semibold transition-all ${active ? "bg-emerald-500/10 text-emerald-600 shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              {active && (
                <span className="absolute start-0 top-3 bottom-3 w-1 rounded-full bg-emerald-500" />
              )}
              <Icon className="w-5 h-5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function TopBar() {
  const user = getUser();
  return (
    <header className="sticky top-0 z-20 h-20 border-b bg-background/90 backdrop-blur flex items-center justify-between px-6 lg:px-10">
      <div>
        <div className="font-bold text-lg">Welcome Back!</div>
        <div className="text-xs text-muted-foreground">
          {user?.name || "Admin"}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Moon className="w-5 h-5 text-muted-foreground" />
        <Globe2 className="w-5 h-5 text-muted-foreground" />
        <div className="relative">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-red-500" />
        </div>
        <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-200">
          <UserRound className="w-5 h-5 text-emerald-600" />
        </div>
      </div>
    </header>
  );
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const { t, dir } = useLanguage();
  const a: any = t.admin;
  const [, setLocation] = useLocation();
  const [section, setSection] = useState<Section>("home");
  const [donationView, setDonationView] = useState<DonationView>("offers");
  const [activeView, setActiveView] = useState<ActiveView>("restaurants");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [baskets, setBaskets] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [mostActive, setMostActive] = useState<any>({
    restaurants: [],
    charities: [],
    drivers: [],
  });

  useEffect(() => {
    const user = getUser();
    if (!user || user.role !== "admin") {
      setLocation("/login");
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [u, st, l, o, req, dv, msg, b, active] = await Promise.all([
        api.admin.users(),
        api.admin.stats(),
        api.admin.logs(),
        api.admin.offers(),
        api.admin.requests(),
        api.admin.deliveries(),
        api.admin.messages(),
        api.admin.baskets(),
        api.admin.mostActive(),
      ]);
      setUsers(u || []);
      setStats(st || {});
      setLogs(l || []);
      setOffers(o || []);
      setRequests(req || []);
      setDeliveries(dv || []);
      setMessages(msg || []);
      setBaskets(b || []);
      setMostActive({
        restaurants: active?.restaurants || [],
        charities: active?.charities || [],
        drivers:
          active?.drivers ||
          active?.delivery ||
          active?.deliveryStats ||
          active?.deliveries ||
          [],
      });
    } catch (err: any) {
      toast({
        title: t.errors.loadError,
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: number, isActive: boolean) => {
    try {
      await api.admin.setUserStatus(id, !isActive);
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, isActive: !isActive } : u)),
      );
      toast({ title: !isActive ? a.userActivated : a.userDisabled });
    } catch (err: any) {
      toast({
        title: t.errors.error,
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const markMessageRead = async (id: number) => {
    try {
      await api.admin.markMessageRead(id);
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, isRead: true } : m)),
      );
    } catch (err: any) {
      toast({
        title: t.errors.error,
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const restaurants = users.filter((u) => u.role === "restaurant");
  const charities = users.filter((u) => u.role === "charity");
  const drivers = users.filter((u) => u.role === "delivery");

  const filteredRestaurants = restaurants.filter(
    (r) =>
      !search ||
      safeLower(r.name).includes(safeLower(search)) ||
      safeLower(r.email).includes(safeLower(search)),
  );
  const filteredCharities = charities.filter(
    (c) =>
      !search ||
      safeLower(c.name).includes(safeLower(search)) ||
      safeLower(c.email).includes(safeLower(search)),
  );
  const filteredOffers = offers.filter(
    (o) =>
      !search ||
      safeLower(o.title).includes(safeLower(search)) ||
      safeLower(o.restaurant?.name).includes(safeLower(search)),
  );
  const filteredBaskets = baskets.filter(
    (b) =>
      !search ||
      safeLower(b.title).includes(safeLower(search)) ||
      safeLower(b.charity?.name).includes(safeLower(search)),
  );

  const unreadMessages = messages.filter((m) => !m.isRead).length;
  const completedOffers = offers.filter((o) => o.status === "completed").length;
  const completedBaskets = baskets.filter(
    (b) => b.status === "completed",
  ).length;
  const totalFoodSaved = Math.round(
    offers
      .filter((o) => o.status === "completed")
      .reduce((sum, o) => sum + getQtyKg(o), 0) +
      baskets.reduce((sum, b) => sum + numberValue(b.totalFulfilled), 0),
  );

  const monthLabels: string[] = a.months ?? [];

  const monthlyData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return {
        month: monthLabels[d.getMonth()] ?? String(d.getMonth() + 1),
        monthIndex: d.getMonth(),
        year: d.getFullYear(),
        donations: 0,
        kg: 0,
      };
    });
    for (const offer of offers) {
      const d = new Date(offer.createdAt || offer.updatedAt || Date.now());
      const row = months.find(
        (m) => m.monthIndex === d.getMonth() && m.year === d.getFullYear(),
      );
      if (row) {
        row.donations += 1;
        row.kg += getQtyKg(offer);
      }
    }
    for (const basket of baskets) {
      const d = new Date(basket.createdAt || basket.updatedAt || Date.now());
      const row = months.find(
        (m) => m.monthIndex === d.getMonth() && m.year === d.getFullYear(),
      );
      if (row) {
        row.donations += 1;
        row.kg += numberValue(basket.totalFulfilled || basket.totalRequested);
      }
    }
    return months;
  }, [offers, baskets, monthLabels]);

  const userDistribution = [
    { name: t.roles.restaurant, value: restaurants.length, fill: "#22c55e" },
    { name: t.roles.charity, value: charities.length, fill: "#3b82f6" },
    { name: t.roles.delivery, value: drivers.length, fill: "#f59e0b" },
  ];

  const statusData = [
    {
      name: a.chartAvailable,
      value: offers.filter((o) => o.status === "available").length,
      fill: "#3b82f6",
    },
    {
      name: a.chartInProgress,
      value: offers.filter((o) => activeOfferStatuses.includes(o.status))
        .length,
      fill: "#f59e0b",
    },
    { name: a.chartCompleted, value: completedOffers, fill: "#22c55e" },
    { name: a.chartBaskets, value: baskets.length, fill: "#8b5cf6" },
  ].filter((x) => x.value > 0);

  const activeRows =
    activeView === "restaurants"
      ? mostActive.restaurants || []
      : activeView === "charities"
        ? mostActive.charities || []
        : mostActive.drivers ||
          mostActive.delivery ||
          mostActive.deliveryStats ||
          mostActive.deliveries ||
          [];
  const activeChartData = activeRows.map((row: any) => ({
    name: row.name,
    total: numberValue(row.total),
    offers: numberValue(row.offers),
    contributions: numberValue(row.contributions),
    reservations: numberValue(row.reservations),
    basketsCreated: numberValue(row.basketsCreated),
    completedDeliveries: numberValue(row.completedDeliveries),
  }));

  const restaurantRows = filteredRestaurants
    .map((r) => {
      const userOffers = offers.filter(
        (o) => o.restaurantId === r.id || o.restaurant?.id === r.id,
      );
      const contributions = baskets
        .flatMap((b) => b.contributions || [])
        .filter(
          (c: any) => c.restaurantId === r.id || c.restaurant?.id === r.id,
        );
      const donations = userOffers.length + contributions.length;
      const kg = Math.round(
        userOffers.reduce((sum, o) => sum + getQtyKg(o), 0) +
          contributions.reduce(
            (sum: number, c: any) =>
              sum + numberValue(c.quantity || c.contribution?.quantity),
            0,
          ),
      );
      return { ...r, donations, kg, engagementScore: donations * 1000 + kg };
    })
    .sort(
      (a, b) =>
        b.engagementScore - a.engagementScore ||
        b.donations - a.donations ||
        b.kg - a.kg ||
        String(a.name ?? "").localeCompare(String(b.name ?? "")),
    );

  const charityRows = filteredCharities
    .map((c) => {
      const { pickups, offerPickups, basketPickups, kg } = getCharityPickupStats(
        c.id,
        deliveries,
        requests,
        offers,
        baskets,
      );
      return {
        ...c,
        pickups,
        offerPickups,
        basketPickups,
        kg,
        engagementScore: pickups * 1000 + kg,
      };
    })
    .sort(
      (a, b) =>
        b.engagementScore - a.engagementScore ||
        b.pickups - a.pickups ||
        b.kg - a.kg ||
        String(a.name ?? "").localeCompare(String(b.name ?? "")),
    );

  return (
    <div className="min-h-screen bg-background text-foreground" dir={dir}>
      <Navbar />
      <div className="relative">
        <AdminSidebar
          section={section}
          setSection={(s) => {
            setSection(s);
            setSearch("");
          }}
          unreadMessages={unreadMessages}
        />
        <div className="lg:ps-[290px] min-h-screen">
          <main className="p-5 md:p-8 max-w-[1600px] mx-auto space-y-8">
            {section === "home" && (
              <>
                <div>
                  <h1 className="text-3xl font-black tracking-tight">
                    {a.dashboardTitle}
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    {a.dashboardSubtitle}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-5">
                  <StatCard
                    title={a.statTotalRestaurants}
                    value={restaurants.length}
                    icon={Building2}
                    trend={a.trendRegistered}
                  />
                  <StatCard
                    title={a.statTotalCharities}
                    value={charities.length}
                    icon={Users}
                    trend={a.trendRegistered}
                  />
                  <StatCard
                    title={a.totalOffers}
                    value={stats.totalOffers ?? offers.length}
                    icon={Package}
                    trend={a.trendFoodOffers}
                  />
                  <StatCard
                    title={a.statTotalBaskets}
                    value={stats.totalBaskets ?? baskets.length}
                    icon={Box}
                    trend={a.trendCharityBaskets}
                  />
                  <StatCard
                    title={a.statCompletedOffers}
                    value={stats.completedTransfers ?? completedOffers}
                    icon={CheckCircle}
                    trend={a.trendCompleted}
                  />
                  <StatCard
                    title={a.statCompletedBaskets}
                    value={stats.completedBaskets ?? completedBaskets}
                    icon={Shield}
                    trend={a.trendCompleted}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card className="rounded-2xl border shadow-md bg-card">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold">{a.monthlyDonations}</h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        {a.monthlyDonationsDesc}
                      </p>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyData}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                              stroke="hsl(var(--border))"
                            />
                            <XAxis
                              dataKey="month"
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              allowDecimals={false}
                            />
                            <Tooltip contentStyle={{ borderRadius: 12 }} />
                            <Bar
                              dataKey="donations"
                              fill="#22c55e"
                              radius={[6, 6, 0, 0]}
                              barSize={40}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border shadow-md bg-card">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold">
                        {a.foodSavedTrend}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        {a.foodSavedDesc}
                      </p>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={monthlyData}>
                            <defs>
                              <linearGradient
                                id="foodSavedGradient"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor="#22c55e"
                                  stopOpacity={0.3}
                                />
                                <stop
                                  offset="95%"
                                  stopColor="#22c55e"
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                              stroke="hsl(var(--border))"
                            />
                            <XAxis
                              dataKey="month"
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: 12 }} />
                            <Area
                              type="monotone"
                              dataKey="kg"
                              stroke="#22c55e"
                              strokeWidth={2}
                              fill="url(#foodSavedGradient)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="rounded-2xl border shadow-md bg-card">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-bold">{a.recentActivity}</h3>
                        <p className="text-sm text-muted-foreground">
                          {a.recentActivityDesc}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        className="text-emerald-600"
                        onClick={() => setSection("logs")}
                      >
                        {a.viewAll}
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {logs.slice(0, 6).map((log: any) => (
                        <div
                          key={log.id}
                          className="flex items-center gap-4 rounded-2xl border p-4 hover:bg-muted/40 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <Activity className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">
                              <span className="font-bold">
                                {log.user?.name || log.userName || a.system}
                              </span>{" "}
                              <span className="text-muted-foreground">
                                {log.action}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {log.summary ||
                                log.details ||
                                log.resource ||
                                "—"}
                            </p>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(log.createdAt, t.locale)}
                          </div>
                        </div>
                      ))}
                      {logs.length === 0 && (
                        <div className="text-center text-muted-foreground py-8">
                          {a.noActivityYet}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {section === "restaurants" && (
              <>
                <div>
                  <h1 className="text-2xl font-bold">{a.manageRestaurants}</h1>
                  <p className="text-muted-foreground mt-1">
                    {a.manageRestaurantsDesc}
                  </p>
                </div>
                <Card className="rounded-2xl border-0 shadow-md bg-card">
                  <CardContent className="p-6">
                    <SearchBox
                      value={search}
                      setValue={setSearch}
                      placeholder={a.searchRestaurants}
                    />
                  </CardContent>
                </Card>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                  <MiniStat
                    title={a.statTotalRestaurants}
                    value={restaurants.length}
                  />
                  <MiniStat
                    title={a.active}
                    value={restaurants.filter((r) => r.isActive).length}
                  />
                  <MiniStat
                    title={a.totalDonations}
                    value={restaurantRows.reduce((s, r) => s + r.donations, 0)}
                    color="text-blue-600"
                  />
                  <MiniStat
                    title={a.totalFoodSaved}
                    value={`${restaurantRows.reduce((s, r) => s + r.kg, 0)} kg`}
                    color="text-orange-600"
                  />
                </div>
                <RestaurantTable
                  rows={restaurantRows}
                  toggleStatus={toggleStatus}
                />
              </>
            )}

            {section === "charities" && (
              <>
                <div>
                  <h1 className="text-2xl font-bold">
                    {a.manageCharities}
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    {a.manageCharitiesDesc}
                  </p>
                </div>
                <Card className="rounded-2xl border-0 shadow-md bg-card">
                  <CardContent className="p-6">
                    <SearchBox
                      value={search}
                      setValue={setSearch}
                      placeholder={a.searchCharities}
                    />
                  </CardContent>
                </Card>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                  <MiniStat title={a.statTotalCharities} value={charities.length} />
                  <MiniStat
                    title={a.active}
                    value={charities.filter((c) => c.isActive).length}
                  />
                  <MiniStat
                    title={a.totalPickups}
                    value={charityRows.reduce((s, c) => s + c.pickups, 0)}
                    color="text-blue-600"
                  />
                  <MiniStat
                    title={a.totalFoodCollected}
                    value={`${charityRows.reduce((s, c) => s + c.kg, 0)} kg`}
                    color="text-orange-600"
                  />
                </div>
                <CharityTable rows={charityRows} toggleStatus={toggleStatus} />
              </>
            )}

            {section === "donations" && (
              <>
                <div>
                  <h1 className="text-2xl font-bold">{a.reviewDonations}</h1>
                  <p className="text-muted-foreground mt-1">
                    {a.reviewDonationsDesc}
                  </p>
                </div>
                <div className="flex gap-2 rounded-2xl bg-muted/50 p-1 w-fit">
                  <TabButton
                    active={donationView === "offers"}
                    onClick={() => setDonationView("offers")}
                  >
                    {a.tabOffersCount} ({offers.length})
                  </TabButton>
                  <TabButton
                    active={donationView === "baskets"}
                    onClick={() => setDonationView("baskets")}
                  >
                    {a.tabBasketsCount} ({baskets.length})
                  </TabButton>
                </div>
                {donationView === "offers" ? (
                  <OffersTable rows={filteredOffers} />
                ) : (
                  <BasketsTable rows={filteredBaskets} />
                )}
              </>
            )}

            {section === "reports" && (
              <>
                <div>
                  <h1 className="text-2xl font-bold">{a.systemReports}</h1>
                  <p className="text-muted-foreground mt-1">
                    {a.systemReportsDesc}
                  </p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card className="rounded-2xl shadow-md">
                    <CardContent className="p-6">
                      <h3 className="font-bold mb-4">{a.userDistribution}</h3>
                      <div className="h-[260px]">
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              data={userDistribution}
                              dataKey="value"
                              innerRadius={55}
                              outerRadius={90}
                            >
                              {userDistribution.map((x, i) => (
                                <Cell key={i} fill={x.fill} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl shadow-md">
                    <CardContent className="p-6">
                      <h3 className="font-bold mb-4">
                        {a.offersBasketsStatus}
                      </h3>
                      <div className="h-[260px]">
                        <ResponsiveContainer>
                          <BarChart data={statusData}>
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                              {statusData.map((x, i) => (
                                <Cell key={i} fill={x.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="rounded-2xl shadow-md">
                  <CardContent className="p-6 space-y-5">
                    <div className="flex flex-wrap gap-2">
                      <TabButton
                        active={activeView === "restaurants"}
                        onClick={() => setActiveView("restaurants")}
                      >
                        {a.mostActiveRestaurants}
                      </TabButton>
                      <TabButton
                        active={activeView === "charities"}
                        onClick={() => setActiveView("charities")}
                      >
                        {a.mostActiveCharities}
                      </TabButton>
                      <TabButton
                        active={activeView === "drivers"}
                        onClick={() => setActiveView("drivers")}
                      >
                        {a.mostActiveDelivery}
                      </TabButton>
                    </div>
                    {activeRows.length === 0 && (
                      <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                        {a.noRankingYet}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {activeRows.slice(0, 6).map((row: any, i: number) => (
                        <Card key={row.id || i}>
                          <CardContent className="p-4">
                            <div className="text-xs text-muted-foreground">
                              #{i + 1}
                            </div>
                            <div className="font-bold truncate">{row.name}</div>
                            <div className="text-2xl font-black text-emerald-600 mt-2">
                              {row.total ?? 0}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {a.totalActions}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {section === "logs" && <LogsList logs={logs} />}
            {section === "messages" && (
              <MessagesList messages={messages} markRead={markMessageRead} />
            )}
            {loading && (
              <div className="text-center text-muted-foreground py-10">
                {a.loading}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function SearchBox({
  value,
  setValue,
  placeholder,
}: {
  value: string;
  setValue: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="rounded-2xl h-12 ps-12"
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: any;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${active ? "bg-background shadow-md text-emerald-600" : "text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

function ActionButtons({
  onToggle,
  active,
}: {
  onToggle?: () => void;
  active?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <button className="p-2 hover:bg-muted rounded-lg transition-colors">
        <Eye className="w-4 h-4 text-muted-foreground" />
      </button>
      <button className="p-2 hover:bg-muted rounded-lg transition-colors">
        <Edit className="w-4 h-4 text-blue-600" />
      </button>
      {onToggle && (
        <button
          onClick={onToggle}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <Trash2
            className={`w-4 h-4 ${active ? "text-red-600" : "text-emerald-600"}`}
          />
        </button>
      )}
    </div>
  );
}

function RestaurantTable({
  rows,
  toggleStatus,
}: {
  rows: any[];
  toggleStatus: (id: number, active: boolean) => void;
}) {
  const { t } = useLanguage();
  const a: any = t.admin;
  return (
    <EntityTable
      title={a.restaurant}
      rows={rows}
      type="restaurant"
      toggleStatus={toggleStatus}
    />
  );
}

function CharityTable({
  rows,
  toggleStatus,
}: {
  rows: any[];
  toggleStatus: (id: number, active: boolean) => void;
}) {
  const { t } = useLanguage();
  const a: any = t.admin;
  return (
    <EntityTable
      title={a.organization}
      rows={rows}
      type="charity"
      toggleStatus={toggleStatus}
    />
  );
}

function EntityTable({
  title,
  rows,
  type,
  toggleStatus,
}: {
  title: string;
  rows: any[];
  type: "restaurant" | "charity";
  toggleStatus: (id: number, active: boolean) => void;
}) {
  const { t } = useLanguage();
  const a: any = t.admin;

  return (
    <Card className="rounded-2xl border-0 shadow-md overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-start p-5 font-bold">{title}</th>
              <th className="text-start p-5 font-bold">{a.contact}</th>
              <th className="text-start p-5 font-bold">{a.location}</th>
              <th className="text-start p-5 font-bold">
                {type === "restaurant" ? a.donations : a.pickups}
              </th>
              <th className="text-start p-5 font-bold">{a.totalKg}</th>
              <th className="text-start p-5 font-bold">{a.status}</th>
              <th className="text-start p-5 font-bold">{a.actions}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b hover:bg-muted/30 transition-colors"
              >
                <td className="p-5">
                  <div className="font-semibold">{row.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.joined} {formatDate(row.createdAt, t.locale)}
                  </div>
                </td>
                <td className="p-5">
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3 h-3" />
                      {row.email}
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3" />
                      {row.phone || "—"}
                    </div>
                  </div>
                </td>
                <td className="p-5">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {row.address || "—"}
                  </div>
                </td>
                <td className="p-5 text-blue-600 font-bold">
                  {type === "restaurant" ? row.donations : row.pickups}
                </td>
                <td className="p-5 text-emerald-600 font-bold">
                  {row.kg || 0} kg
                </td>
                <td className="p-5">
                  <Badge
                    className={
                      row.isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-700"
                    }
                  >
                    {row.isActive ? a.activeStatus : a.inactiveStatus}
                  </Badge>
                </td>
                <td className="p-5">
                  <ActionButtons
                    active={row.isActive}
                    onToggle={() => toggleStatus(row.id, row.isActive)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {a.noDataFound}
        </div>
      )}
    </Card>
  );
}

function OffersTable({ rows }: { rows: any[] }) {
  const { t } = useLanguage();
  const a: any = t.admin;
  const statusLabels: Record<string, string> = t.status as Record<string, string>;

  return (
    <Card className="rounded-2xl shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-start p-5">{a.offerCol}</th>
              <th className="text-start p-5">{a.restaurantCol}</th>
              <th className="text-start p-5">{a.quantity}</th>
              <th className="text-start p-5">{a.expires}</th>
              <th className="text-start p-5">{a.status}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="border-b hover:bg-muted/30">
                <td className="p-5 font-semibold">{o.title}</td>
                <td className="p-5">{o.restaurant?.name || "—"}</td>
                <td className="p-5">
                  {o.quantity} {o.unit}
                </td>
                <td className="p-5">{formatDate(o.expiresAt, t.locale)}</td>
                <td className="p-5">
                  <Badge>{labelStatus(o.status, statusLabels)}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function BasketsTable({ rows }: { rows: any[] }) {
  const { t } = useLanguage();
  const a: any = t.admin;
  const basketStatus: Record<string, string> = a.basketStatus ?? {};

  return (
    <Card className="rounded-2xl shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-start p-5">{a.basketCol}</th>
              <th className="text-start p-5">{a.charityCol}</th>
              <th className="text-start p-5">{a.requested}</th>
              <th className="text-start p-5">{a.fulfilled}</th>
              <th className="text-start p-5">{a.status}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-b hover:bg-muted/30">
                <td className="p-5 font-semibold">{b.title}</td>
                <td className="p-5">{b.charity?.name || "—"}</td>
                <td className="p-5">{b.totalRequested ?? 0}</td>
                <td className="p-5">{b.totalFulfilled ?? 0}</td>
                <td className="p-5">
                  <Badge>{labelStatus(b.status, {}, basketStatus)}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function LogsList({ logs }: { logs: any[] }) {
  const { t } = useLanguage();
  const a: any = t.admin;

  return (
    <Card className="rounded-2xl shadow-md">
      <CardContent className="p-6 space-y-3">
        <h1 className="text-2xl font-bold mb-4">{a.activityLog}</h1>
        {logs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">{a.noLogs}</div>
        )}
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex items-center justify-between gap-4 border rounded-2xl p-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Activity className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold truncate">{log.action}</div>
                <div className="text-sm text-muted-foreground truncate">
                  {log.summary || log.details || log.resource}
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground shrink-0">
              {formatDate(log.createdAt, t.locale)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MessagesList({
  messages,
  markRead,
}: {
  messages: any[];
  markRead: (id: number) => void;
}) {
  const { t } = useLanguage();
  const a: any = t.admin;

  return (
    <Card className="rounded-2xl shadow-md">
      <CardContent className="p-6 space-y-3">
        <h1 className="text-2xl font-bold mb-4">{a.messages}</h1>
        {messages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">{a.noDataFound}</div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="border rounded-2xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-bold">{msg.subject}</div>
                <div className="text-sm text-muted-foreground">
                  {msg.name} — {msg.email}
                </div>
              </div>
              {!msg.isRead && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => markRead(msg.id)}
                >
                  {a.markRead}
                </Button>
              )}
            </div>
            <p className="mt-3 text-sm whitespace-pre-wrap break-words">
              {msg.message}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
