import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HeartHandshake, LogIn, UserPlus, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { saveAuth } from "@/lib/auth";
import { useLanguage } from "@/components/LanguageProvider";

export default function Login() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();
  const getTabFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") === "register" ? "register" : "login";
  };
  
  const [activeTab, setActiveTab] = useState<"login" | "register">(getTabFromUrl());
  
  useEffect(() => {
    const syncTabWithUrl = () => {
      setActiveTab(getTabFromUrl());
    };
  
    window.addEventListener("popstate", syncTabWithUrl);
  
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
  
    window.history.pushState = function (...args) {
      originalPushState.apply(this, args);
      syncTabWithUrl();
    };
  
    window.history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      syncTabWithUrl();
    };
  
    syncTabWithUrl();
  
    return () => {
      window.removeEventListener("popstate", syncTabWithUrl);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);
  const l = t.login;

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState<"restaurant" | "charity" | "delivery">("restaurant");
  const [regPhone, setRegPhone] = useState("");
  const [regAddress, setRegAddress] = useState("");

  const redirect = (role: string) => {
    if (role === "admin") setLocation("/admin");
    else if (role === "restaurant") setLocation("/restaurants");
    else if (role === "delivery") setLocation("/delivery");
    else setLocation("/charities");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { token, user } = await api.auth.login({ email: loginEmail, password: loginPassword });
      saveAuth(token, user);
      redirect(user.role);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { token, user } = await api.auth.register({ email: regEmail, password: regPassword, name: regName, role: regRole, phone: regPhone, address: regAddress });
      saveAuth(token, user);
      redirect(user.role);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans">
      <Navbar />
      <main className="flex-grow flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
              <HeartHandshake className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold">{l.welcome}</h1>
            <p className="text-muted-foreground mt-2">{l.subtitle}</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              if (value === "login" || value === "register") setActiveTab(value);
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-6 h-12">
              <TabsTrigger value="login" className="text-base">{l.tabLogin}</TabsTrigger>
              <TabsTrigger value="register" className="text-base">{l.tabRegister}</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card className="border-2 border-primary/10 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><LogIn className="w-5 h-5" /> {l.loginTitle}</CardTitle>
                  <CardDescription>{l.loginDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label>{l.email}</Label>
                      <Input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="example@email.com" required data-testid="input-login-email" />
                    </div>
                    <div className="space-y-2">
                      <Label>{l.password}</Label>
                      <Input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required data-testid="input-login-password" />
                    </div>
                    <Button type="submit" className="w-full text-lg h-12 mt-2" disabled={loading} data-testid="button-login-submit">
                      {loading ? l.loading : l.enterBtn}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card className="border-2 border-secondary/10 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> {l.registerTitle}</CardTitle>
                  <CardDescription>{l.registerDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label>{l.accountType}</Label>
                      <Select value={regRole} onValueChange={(v: any) => setRegRole(v)}>
                        <SelectTrigger data-testid="select-register-role"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="restaurant">{l.restaurant}</SelectItem>
                          <SelectItem value="charity">{l.charity}</SelectItem>
                          <SelectItem value="delivery">{l.delivery}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{l.officialName}</Label>
                      <Input value={regName} onChange={e => setRegName(e.target.value)} placeholder={l.namePlaceholder} required data-testid="input-register-name" />
                    </div>
                    <div className="space-y-2">
                      <Label>{l.email}</Label>
                      <Input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required data-testid="input-register-email" />
                    </div>
                    <div className="space-y-2">
                      <Label>{l.password}</Label>
                      <Input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} minLength={6} required data-testid="input-register-password" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>{l.phone}</Label>
                        <Input value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder="05XXXXXXXX" data-testid="input-register-phone" />
                      </div>
                      <div className="space-y-2">
                        <Label>{l.address}</Label>
                        <Input value={regAddress} onChange={e => setRegAddress(e.target.value)} placeholder={l.addressPlaceholder} data-testid="input-register-address" />
                      </div>
                    </div>
                    <Button type="submit" className="w-full text-lg h-12 mt-2 bg-secondary hover:bg-secondary/90 text-white" disabled={loading} data-testid="button-register-submit">
                      {loading ? l.registerLoading : l.registerBtn}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
