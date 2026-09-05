import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/LanguageProvider";
import { Bell, CheckCircle, AlertCircle, Info, CheckCheck, ExternalLink } from "lucide-react";
import { getUser, isAuthenticated } from "@/lib/auth";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const typeStyles: Record<string, { color: string; icon: any }> = {
  success: { color: "text-green-500 bg-green-50 dark:bg-green-950/30", icon: CheckCircle },
  info:    { color: "text-blue-500 bg-blue-50 dark:bg-blue-950/30", icon: Info },
  warning: { color: "text-amber-500 bg-amber-50 dark:bg-amber-950/30", icon: AlertCircle },
  error:   { color: "text-red-500 bg-red-50 dark:bg-red-950/30", icon: AlertCircle },
};

function interpolate(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(params[key] ?? ""));
}

function getByPath(source: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], source);
}

function parseParams(raw: unknown): Record<string, string | number> {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, string | number>;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

export default function Notifications() {
  const [, setLocation] = useLocation();
  const { t, dir } = useLanguage();
  const { toast } = useToast();
  const user = getUser();
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [fullMessage, setFullMessage] = useState<{ title: string; message: string } | null>(null);

  const readMoreLabel = (t as any).common?.readMore ?? "Read more";
  const fullMessageTitle = (t as any).common?.fullMessage ?? "Full message";

  const renderExpandableText = (value: unknown, className = "text-sm text-muted-foreground mt-1 leading-relaxed break-words", limit = 120) => {
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

  function resolveNotificationText(notif: any): { title: string; body: string } {
    if (!notif.messageKey) {
      return { title: notif.title, body: notif.body };
    }

    const params = parseParams(notif.messageParams);
    const translated = getByPath(t, notif.messageKey);

    if (typeof translated === "string") {
      return {
        title: notif.title,
        body: interpolate(translated, params) || notif.body,
      };
    }

    if (translated && typeof translated === "object") {
      return {
        title: interpolate(translated.title ?? "", params) || notif.title,
        body: interpolate(translated.body ?? "", params) || notif.body,
      };
    }

    return { title: notif.title, body: notif.body };
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return t.notifications.timeJustNow;
    if (m < 60) return `${m}${t.notifications.timeMin}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}${t.notifications.timeHour}`;
    return `${Math.floor(h / 24)}${t.notifications.timeDay}`;
  }

  useEffect(() => {
    if (!isAuthenticated()) { setLocation("/login"); return; }
    loadNotifs();
  }, []);

  const loadNotifs = async () => {
    setLoading(true);
    try {
      const data = await api.notifications.getAll();
      setNotifs(data);
    } catch {
      toast({ title: t.notifications.errorLoading, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: number) => {
    await api.notifications.markRead(id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const handleNotifClick = (notif: any) => {
    if (!notif.isRead) {
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
      api.notifications.markRead(notif.id).catch(() => {});
    }
    if (notif.link) {
      setLocation(notif.link);
    }
  };

  const handleMarkAllRead = async () => {
    await api.notifications.markAllRead();
    setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
    toast({ title: t.notifications.markAllRead });
  };

  const unreadCount = notifs.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen flex flex-col bg-accent/20" dir={dir}>
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2">
              <Bell className="w-7 h-7 text-primary" />
              {t.notifications.title}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">{user?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <>
                <Badge className="bg-primary text-white rounded-full px-3">
                  {unreadCount} {t.notifications.newBadge}
                </Badge>
                <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={handleMarkAllRead} data-testid="button-mark-all-read">
                  <CheckCheck className="w-4 h-4" /> {t.notifications.markRead}
                </Button>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />)}
          </div>
        ) : notifs.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Bell className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-semibold">{t.notifications.empty}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifs.map((notif) => {
              const style = typeStyles[notif.type] ?? typeStyles.info;
              const Icon = style.icon;
              const text = resolveNotificationText(notif);
              return (
                <Card
                  key={notif.id}
                  className={`border-0 shadow-sm transition-all ${notif.link ? "cursor-pointer card-hover" : !notif.isRead ? "cursor-pointer" : ""} ${!notif.isRead ? "ring-1 ring-primary/20 shadow-md" : ""}`}
                  onClick={() => handleNotifClick(notif)}
                  data-testid={`notification-${notif.id}`}
                >
                  <CardContent className="p-5 flex gap-4 items-start">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${style.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className={`font-bold text-sm ${!notif.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                          {text.title}
                        </h3>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(notif.createdAt)}</span>
                      </div>
                      {renderExpandableText(text.body)}
                      {notif.link && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-primary font-semibold">
                          <ExternalLink className="w-3 h-3" /> {t.notifications.clickToNavigate}
                        </div>
                      )}
                    </div>
                    {!notif.isRead && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
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
    </div>
  );
}