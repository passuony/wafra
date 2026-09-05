import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HeartHandshake, Utensils, Building2, ArrowLeft, ArrowRight, CheckCircle, Star, Users, PackageCheck, Leaf, Clock, Shield, ChevronDown } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

const featureIcons = [Leaf, Clock, Shield, Users];
const featureColors = [
  { color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30" },
  { color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
  { color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30" },
  { color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
];
const statIcons = [Utensils, Building2, HeartHandshake, Star];

function Footer() {
  const { t } = useLanguage();
  const h = t.home;

  return (
    <footer className="bg-gray-900 dark:bg-gray-950 text-white py-14">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <HeartHandshake className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-black">{t.appName}</span>
            </div>
            <p className="text-gray-400 max-w-sm leading-relaxed">{h.footerDesc}</p>
            <div className="flex gap-3 mt-5">
              {["X", "f", "in"].map(s => (
                <div key={s} className="w-9 h-9 rounded-full bg-white/10 hover:bg-primary/40 transition-colors cursor-pointer flex items-center justify-center text-sm font-bold">
                  {s}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-bold mb-4 text-white/90">{h.footerLinks}</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              {[[t.nav.about, "/about"], [t.nav.faq, "/faq"], [t.nav.contact, "/contact"]].map(([l, href]) => (
                <li key={l}><Link href={href} className="hover:text-white transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4 text-white/90">{h.footerJoin}</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              {[[h.footerForRestaurants, "/login?tab=register"], [h.footerForCharities, "/login?tab=register"], [h.footerForDeliveryDrivers, "/login?tab=register"]].map(([l, href]) => (
                <li key={l}><Link href={href} className="hover:text-white transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-gray-500 text-sm">
          <span>{h.footerRights}</span>
          <span>{h.footerMade}</span>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  const { t, dir } = useLanguage();
  const h = t.home;
  const ArrowIcon = dir === "rtl" ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/5 py-20 md:py-28">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 text-sm px-4 py-1.5 rounded-full font-semibold animate-fade-in">
              {h.heroBadge}
            </Badge>
            <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              {h.heroTitle1}{" "}
              <span className="text-gradient">{h.heroTitle2}</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              {h.heroDesc}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
              <Button asChild size="lg" className="h-13 px-8 text-base font-bold rounded-full shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow">
                <Link href="/login?tab=register">{h.startFree} <ArrowIcon className="ms-2 w-5 h-5" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-13 px-8 text-base font-bold rounded-full border-2">
                <Link href="/about">{h.learnMore}</Link>
              </Button>
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-4 md:gap-6 text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: "0.5s" }}>
              {[h.freeBadge1, h.freeBadge2, h.freeBadge3].map(item => (
                <div key={item} className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-center mt-14">
          <ChevronDown className="w-6 h-6 text-muted-foreground animate-bounce" />
        </div>
      </section>

      {/* Stats */}
      <section className="py-14 bg-primary">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {h.stats.map(({ value, label }, i) => {
              const Icon = statIcons[i];
              return (
                <div key={label} className="text-center text-white">
                  <Icon className="w-8 h-8 mx-auto mb-2 text-white/80" />
                  <div className="text-3xl md:text-4xl font-black mb-1">{value}</div>
                  <div className="text-white/80 text-sm font-medium">{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">{h.whyBadge}</Badge>
            <h2 className="text-3xl md:text-4xl font-black mb-4">{h.whyTitle}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">{h.whyDesc}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {h.features.map(({ title, desc }, i) => {
              const Icon = featureIcons[i];
              const { color, bg } = featureColors[i];
              return (
                <Card key={title} className="card-hover border-0 shadow-md">
                  <CardContent className="p-7">
                    <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center mb-5`}>
                      <Icon className={`w-6 h-6 ${color}`} />
                    </div>
                    <h3 className="font-bold text-lg mb-2">{title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-accent/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">{h.howBadge}</Badge>
            <h2 className="text-3xl md:text-4xl font-black mb-4">{h.howTitle}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">{h.howDesc}</p>
          </div>
          <div className="relative">
            <div className="hidden md:block absolute top-10 start-[12.5%] end-[12.5%] h-0.5 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {h.steps.map(({ step, title, desc }) => (
                <div key={step} className="text-center relative">
                  <div className="w-16 h-16 rounded-2xl gradient-primary mx-auto flex items-center justify-center text-white text-2xl font-black mb-5 shadow-lg shadow-primary/25 relative z-10">
                    {step}
                  </div>
                  <h3 className="font-bold text-lg mb-2">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">{h.reviewsBadge}</Badge>
            <h2 className="text-3xl md:text-4xl font-black mb-4">{h.reviewsTitle}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {h.testimonials.map(({ name, role, text, avatar }) => (
              <Card key={name} className="card-hover border-0 shadow-md">
                <CardContent className="p-7">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-5">"{text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-bold">
                      {avatar}
                    </div>
                    <div>
                      <div className="font-bold text-sm">{name}</div>
                      <div className="text-muted-foreground text-xs">{role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 gradient-primary">
        <div className="container mx-auto px-4 text-center text-white">
          <PackageCheck className="w-16 h-16 mx-auto mb-6 opacity-90 animate-float" />
          <h2 className="text-3xl md:text-4xl font-black mb-4">{h.ctaTitle}</h2>
          <p className="text-white/85 text-lg mb-10 max-w-xl mx-auto">{h.ctaDesc}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" variant="secondary" className="h-13 px-8 text-base font-bold rounded-full bg-white/15 hover:bg-white/25 border-white/30 border">
              <Link href="/login?tab=register">{h.ctaRestaurant}</Link>
            </Button>
            <Button asChild size="lg" className="h-13 px-8 text-base font-bold rounded-full bg-white/15 hover:bg-white/25 border-white/30 border">
              <Link href="/login?tab=register">{h.ctaCharity}</Link>
            </Button>
            <Button asChild size="lg" className="h-13 px-8 text-base font-bold rounded-full bg-white/15 hover:bg-white/25 border-white/30 border">
              <Link href="/login?tab=register">{h.ctaDeliveryDriver}</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
