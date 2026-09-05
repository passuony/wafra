import React from "react";
import Navbar from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useLanguage } from "@/components/LanguageProvider";
import { HeartHandshake, Leaf, Users, Target, Eye, Award, ArrowLeft, ArrowRight } from "lucide-react";

const valueIconMap: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  sustainability: { icon: Leaf, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30" },
  collaboration: { icon: HeartHandshake, color: "text-primary", bg: "bg-primary/10" },
  transparency: { icon: Target, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
  quality: { icon: Award, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
};

export default function About() {
  const { t, dir } = useLanguage();
  const a = t.about;
  const ArrowIcon = dir === "rtl" ? ArrowLeft : ArrowRight;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="py-20 bg-gradient-to-br from-primary/5 to-background relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="container mx-auto px-4 text-center relative">
          <Badge className="mb-5 bg-primary/10 text-primary border-primary/20">{a.title}</Badge>
          <h1 className="text-4xl md:text-5xl font-black mb-6">
            <span className="text-gradient">{a.title}</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            {a.subtitle}
          </p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="border-0 shadow-lg overflow-hidden">
              <div className="h-2 gradient-primary" />
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-black">{a.missionTitle}</h2>
                </div>
                <p className="text-muted-foreground leading-relaxed">{a.missionDesc}</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-amber-400 to-orange-500" />
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <Eye className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-black">{a.visionTitle}</h2>
                </div>
                <p className="text-muted-foreground leading-relaxed">{a.visionDesc}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-accent/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black mb-3">{a.valuesTitle}</h2>
            <p className="text-muted-foreground">{a.valuesPrinciple}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {a.values.map(({ key, title, desc }) => {
              const meta = valueIconMap[key] ?? { icon: Award, color: "text-primary", bg: "bg-primary/10" };
              const Icon = meta.icon;
              return (
                <Card key={key} className="card-hover border-0 shadow-md text-center">
                  <CardContent className="p-7">
                    <div className={`w-14 h-14 rounded-2xl ${meta.bg} flex items-center justify-center mx-auto mb-4`}>
                      <Icon className={`w-7 h-7 ${meta.color}`} />
                    </div>
                    <h3 className="font-bold text-lg mb-2">{title}</h3>
                    <p className="text-muted-foreground text-sm">{desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl font-black mb-6 text-center">{a.storyTitle}</h2>
          <div className="space-y-4 text-center leading-relaxed">
            {a.story.map((paragraph, i) => (
              <p key={i} className="text-muted-foreground text-lg">{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-16 bg-accent/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black mb-3">{a.teamTitle}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-2 max-w-3xl mx-auto">
            {a.team.map(({ name, role, avatar, bg }) => (
              <div key={name} className="text-center">
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${bg} flex items-center justify-center text-white text-2xl font-black mx-auto mb-3 shadow-lg`}>
                  {avatar}
                </div>
                <div className="font-bold text-sm">{name}</div>
                <div className="text-muted-foreground text-xs mt-1">{role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 gradient-primary text-white text-center">
        <div className="container mx-auto px-4">
          <Users className="w-14 h-14 mx-auto mb-5 opacity-90" />
          <h2 className="text-3xl font-black mb-4">{t.home.ctaTitle}</h2>
          <p className="text-white/80 max-w-lg mx-auto mb-8">{t.home.ctaDesc}</p>
          <Button asChild size="lg" className="rounded-full bg-white text-primary hover:bg-white/95 px-8 font-bold">
            <Link href="/login">{t.nav.login} <ArrowIcon className="ms-2 w-4 h-4" /></Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
