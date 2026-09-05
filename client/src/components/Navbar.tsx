import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HeartHandshake, Menu, X, LogOut, Moon, Sun, Bell, User, Languages } from "lucide-react";
import { getUser, logout, isAuthenticated } from "@/lib/auth";
import { useTheme } from "./ThemeProvider";
import { useLanguage } from "./LanguageProvider";
import { Lang } from "@/lib/translations";
import { api } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LANG_FLAGS: Record<Lang, string> = { ar: "🇸🇦", en: "🇬🇧", ru: "🇷🇺" };

function CountBadge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  return (
    <span className="absolute -top-1 -end-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold leading-none shadow-sm">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default function Navbar() {
  const [location] = useLocation();
  const user = getUser();
  const loggedIn = isAuthenticated();
  const { theme, toggle } = useTheme();
  const { t, lang, setLang, dir } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [basketCount, setBasketCount] = useState(0);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const getDashboardPath = () => {
    if (!user) return "/login";
    if (user.role === "admin") return "/admin";
    if (user.role === "restaurant") return "/restaurants";
    if (user.role === "delivery") return "/delivery";
    if (user.role === "charity") return "/charities";
    return "/login";
  };

  const getBasketsPath = () => {
    if (!user) return null;
    if (user.role === "charity") return "/charity/baskets";
    if (user.role === "restaurant") return "/restaurant/baskets";
    return null;
  };

  useEffect(() => {
    if (!loggedIn) return;

    const load = async () => {
      try {
        const [notifData, basketData] = await Promise.all([
          api.notifications.getUnreadCount().catch(() => ({ count: 0 })),
          getBasketsPath()
            ? user?.role === "restaurant"
              ? api.baskets.getAll().catch(() => [])
              : api.baskets.getMy().catch(() => [])
            : Promise.resolve([]),
        ]);

        setUnreadCount(notifData.count || 0);

        const count = Array.isArray(basketData)
          ? user?.role === "restaurant"
            ? basketData.filter((b: any) => ["open", "partial"].includes(b.status)).length
            : basketData.filter((b: any) => ["open", "partial"].includes(b.status)).length
          : 0;
        setBasketCount(count);
      } catch {
        setUnreadCount(0);
        setBasketCount(0);
      }
    };

    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [loggedIn, user?.role]);

  const navLinks = [
    { href: "/", label: t.nav.home },
    { href: "/about", label: t.nav.about },
    { href: "/faq", label: t.nav.faq },
    { href: "/contact", label: t.nav.contact },
  ];

  const isActive = (href: string) => location === href;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-md shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-primary group" data-testid="link-logo">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
            <HeartHandshake className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-black text-primary">{t.appName}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                isActive(link.href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
              data-testid={`link-nav-${link.href}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-language" title={t.language}>
                <Languages className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={dir === "rtl" ? "start" : "end"} className="min-w-[140px]">
              {(["ar", "en", "ru"] as Lang[]).map(l => (
                <DropdownMenuItem
                  key={l}
                  onClick={() => setLang(l)}
                  className={`gap-2 cursor-pointer ${lang === l ? "bg-primary/10 text-primary font-semibold" : ""}`}
                  data-testid={`lang-option-${l}`}
                >
                  <span>{LANG_FLAGS[l]}</span>
                  <span>{t.languages[l]}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" className="rounded-full" onClick={toggle} data-testid="button-theme-toggle" title={theme === "dark" ? t.nav.lightMode : t.nav.darkMode}>
            {theme === "dark" ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </Button>

          {loggedIn ? (
            <div className="hidden md:flex items-center gap-2">
              {getBasketsPath() && (
                <Link href={getBasketsPath()!}>
                  <Button variant="ghost" size="sm" className="rounded-full text-sm font-semibold relative" data-testid="link-baskets">
                    {t.nav.baskets}
                    <CountBadge count={basketCount} />
                  </Button>
                </Link>
              )}
              {user?.role === "charity" && (
                <Link href="/charity/deliveries">
                  <Button variant="ghost" size="sm" className="rounded-full text-sm font-semibold" data-testid="link-charity-deliveries">
                    {t.nav.myDeliveries}
                  </Button>
                </Link>
              )}
              <Link href="/notifications">
                <Button variant="ghost" size="icon" className="rounded-full relative" data-testid="link-notifications">
                  <Bell className="w-5 h-5" />
                  <CountBadge count={unreadCount} />
                </Button>
              </Link>
              <Link href="/profile">
                <Button variant="ghost" size="icon" className="rounded-full" data-testid="link-profile">
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-sm font-bold">
                    {user?.name?.[0] || "م"}
                  </div>
                </Button>
              </Link>
              <Button asChild className="rounded-full h-9 px-4 text-sm font-semibold shadow-sm" data-testid="link-dashboard">
                <Link href={getDashboardPath()}>{t.nav.dashboard}</Link>
              </Button>
              <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-full" onClick={() => setLogoutDialogOpen(true)} data-testid="button-logout" title={t.nav.logout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          ) : (
            <div className="hidden md:flex gap-2">
              <Button asChild variant="outline" className="rounded-full h-9 px-4 font-semibold text-primary border-primary/40 hover:bg-primary/5">
                <Link href="/login?tab=login" data-testid="link-login">{t.nav.login}</Link>
              </Button>
              <Button asChild className="rounded-full h-9 px-4 font-semibold shadow-sm">
                <Link href="/login?tab=register" data-testid="link-register">{t.nav.signup}</Link>
              </Button>
            </div>
          )}

          <Button variant="ghost" size="icon" className="md:hidden rounded-full" onClick={() => setMobileOpen(!mobileOpen)} data-testid="button-mobile-menu">
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t bg-background/98 backdrop-blur-md px-4 py-4 space-y-2 animate-fade-in">
          {navLinks.map(link => (
            <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className={`block px-4 py-3 rounded-xl text-sm font-semibold transition-all ${isActive(link.href) ? "bg-primary/10 text-primary" : "hover:bg-accent"}`}>
              {link.label}
            </Link>
          ))}

          <div className="flex gap-2 px-4 py-2">
            {(["ar", "en", "ru"] as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)} className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all border ${lang === l ? "bg-primary text-white border-primary" : "border-border hover:bg-accent"}`} data-testid={`mobile-lang-${l}`}>
                {LANG_FLAGS[l]} {t.languages[l]}
              </button>
            ))}
          </div>

          <div className="pt-2 border-t space-y-2">
            {loggedIn ? (
              <>
                {getBasketsPath() && (
                  <Link href={getBasketsPath()!} onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" className="w-full gap-2 justify-start rounded-xl relative">
                      {t.nav.baskets}
                      <CountBadge count={basketCount} />
                    </Button>
                  </Link>
                )}
                <Link href="/profile" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" className="w-full gap-2 justify-start rounded-xl">
                    <User className="w-4 h-4" /> {t.nav.profile}
                  </Button>
                </Link>
                <Link href={getDashboardPath()} onClick={() => setMobileOpen(false)}>
                  <Button className="w-full rounded-xl">{t.nav.dashboard}</Button>
                </Link>
                <Button variant="outline" className="w-full text-red-600 border-red-200 rounded-xl gap-2 justify-start" onClick={() => { setMobileOpen(false); setLogoutDialogOpen(true); }}>
                  <LogOut className="w-4 h-4" /> {t.nav.logout}
                </Button>
              </>
            ) : (
              <>
                <Link href="/login?tab=login" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" className="w-full rounded-xl">{t.nav.login}</Button>
                </Link>
                <Link href="/login?tab=register" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full rounded-xl">{t.nav.signup}</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmDialog.logoutTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.confirmDialog.logoutDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-logout-cancel">{t.confirmDialog.logoutCancel}</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={logout} data-testid="button-logout-confirm">
              {t.confirmDialog.logoutConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
