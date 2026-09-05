import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { getUser, isAuthenticated, setUser } from "@/lib/auth";
import { useLanguage } from "@/components/LanguageProvider";
import { User, Mail, Phone, MapPin, Shield, Save, LogOut, CheckCircle } from "lucide-react";
import { logout } from "@/lib/auth";

export default function Profile() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();
  const p = t.profile;

  const user = getUser();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setAddress] = useState(user?.address || "");
  const [saved, setSaved] = useState(false);

  const roleLabels: Record<string, { label: string; color: string }> = {
    restaurant: { label: t.login.restaurant, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
    charity: { label: t.login.charity, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
    admin: { label: t.lang === "ar" ? "مدير النظام" : t.lang === "ru" ? "Администратор" : "Admin", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  };

  useEffect(() => {
    if (!isAuthenticated()) setLocation("/login");
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await api.auth.updateProfile({ name, phone, address });
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast({ title: p.saved });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const roleInfo = user ? roleLabels[user.role] ?? { label: user.role, color: "" } : null;

  return (
    <div className="min-h-screen flex flex-col bg-accent/20">
      <Navbar />
      <main className="flex-grow container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-black flex items-center gap-2">
            <User className="w-7 h-7 text-primary" />
            {p.title}
          </h1>
        </div>

        <Card className="border-0 shadow-md mb-6">
          <CardContent className="p-6 flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center text-white text-3xl font-black shadow-lg">
              {user?.name?.[0] || "م"}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{user?.name}</h2>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" />
                <span>{user?.email}</span>
              </div>
              {roleInfo && (
                <Badge className={`mt-2 ${roleInfo.color} border-0`}>{roleInfo.label}</Badge>
              )}
            </div>
            {saved && (
              <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium animate-fade-in">
                <CheckCircle className="w-4 h-4" />
                {p.saved}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5 text-primary" />
              {t.lang === "ar" ? "تعديل المعلومات" : t.lang === "ru" ? "Изменить данные" : "Edit Information"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">{p.name}</Label>
                <div className="relative">
                  <User className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="pe-10"
                    required
                    data-testid="input-name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{p.email}</Label>
                <div className="relative">
                  <Mail className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    value={user?.email || ""}
                    disabled
                    className="pe-10 bg-muted/50"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.lang === "ar" ? "البريد الإلكتروني لا يمكن تغييره" : t.lang === "ru" ? "Email нельзя изменить" : "Email cannot be changed"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{p.phone}</Label>
                <div className="relative">
                  <Phone className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="pe-10"
                    placeholder="05xxxxxxxx"
                    data-testid="input-phone"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">{p.address}</Label>
                <div className="relative">
                  <MapPin className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="address"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="pe-10"
                    data-testid="input-address"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-12 font-bold rounded-xl gap-2" disabled={loading} data-testid="button-save-profile">
                <Save className="w-5 h-5" />
                {loading ? p.saving : p.save}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md border-red-100 dark:border-red-900/20">
          <CardContent className="p-6">
            <h3 className="font-bold text-red-600 mb-1">
              {t.lang === "ar" ? "منطقة الخطر" : t.lang === "ru" ? "Опасная зона" : "Danger Zone"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t.lang === "ar" ? "سيؤدي تسجيل الخروج إلى إنهاء جلستك الحالية." : t.lang === "ru" ? "Выход завершит вашу текущую сессию." : "Logging out will end your current session."}
            </p>
            <Button
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 gap-2 rounded-xl"
              onClick={logout}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
              {t.nav.logout}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
