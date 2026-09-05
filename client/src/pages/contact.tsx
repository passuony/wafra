import { useState } from "react";
import Navbar from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/components/LanguageProvider";
import { Mail, Phone, MapPin, Clock, Send, CheckCircle } from "lucide-react";

export default function Contact() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const c = t.contact;
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  const contactInfo = [
    { icon: Mail, label: c.emailLabel, value: "hello@wafra.com", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
    { icon: Phone, label: c.phoneLabel, value: "+966 50 000 0000", color: "text-green-500", bg: "bg-green-50 dark:bg-green-950/30" },
    { icon: MapPin, label: c.locationLabel, value: c.locationValue, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/30" },
    { icon: Clock, label: c.hoursLabel, value: c.hoursValue, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30" },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setLoading(true);
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, subject: form.subject || "General Inquiry" }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).message);
      });
      setSent(true);
      toast({ title: c.successMsg });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <section className="py-16 bg-gradient-to-br from-primary/5 to-background">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-5 bg-primary/10 text-primary border-primary/20">{c.title}</Badge>
          <h1 className="text-4xl md:text-5xl font-black mb-4">
            <span className="text-gradient">{c.title}</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">{c.subtitle}</p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="space-y-5">
              <h2 className="text-xl font-bold mb-2">{c.infoTitle}</h2>
              {contactInfo.map(({ icon: Icon, label, value, color, bg }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                    <div className="font-semibold text-sm">{value}</div>
                  </div>
                </div>
              ))}

              <div className="mt-8 p-5 bg-primary/10 rounded-2xl border border-primary/20">
                <h3 className="font-bold text-primary mb-2">⚡ {c.responseTime}</h3>
                <p className="text-sm text-muted-foreground">{c.responseTimeDesc}</p>
              </div>
            </div>

            <div className="lg:col-span-2">
              <Card className="border-0 shadow-xl">
                <CardContent className="p-8">
                  {sent ? (
                    <div className="text-center py-12 animate-fade-in-up">
                      <CheckCircle className="w-20 h-20 text-primary mx-auto mb-5" />
                      <h3 className="text-2xl font-black mb-3">{c.messageSent}</h3>
                      <p className="text-muted-foreground max-w-sm mx-auto">{c.successMsg}</p>
                      <Button className="mt-6 rounded-full px-8" onClick={() => { setSent(false); setForm({ name: "", email: "", subject: "", message: "" }); }}>
                        {c.sendAnother}
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <h2 className="text-xl font-bold mb-4">{c.sendMessage}</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <Label htmlFor="name">{c.name} *</Label>
                          <Input id="name" name="name" value={form.name} onChange={handleChange} required data-testid="input-name" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">{c.email} *</Label>
                          <Input id="email" name="email" type="email" placeholder="email@example.com" value={form.email} onChange={handleChange} required data-testid="input-email" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="subject">{c.subject}</Label>
                        <Input id="subject" name="subject" value={form.subject} onChange={handleChange} data-testid="input-subject" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="message">{c.message} *</Label>
                        <Textarea
                          id="message"
                          name="message"
                          rows={5}
                          value={form.message}
                          onChange={handleChange}
                          required
                          data-testid="input-message"
                        />
                      </div>
                      <Button type="submit" className="w-full h-12 text-base font-bold rounded-xl gap-2" disabled={loading} data-testid="button-send">
                        {loading ? c.sending : <><Send className="w-5 h-5" /> {c.send}</>}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
