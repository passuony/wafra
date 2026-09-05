import Navbar from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useState } from "react";
import { ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${open ? "border-primary/30 shadow-sm" : "border-border"}`}>
      <button
        className="w-full flex items-center justify-between p-5 text-start font-semibold hover:bg-accent/50 transition-colors"
        onClick={() => setOpen(!open)}
        data-testid={`faq-item`}
      >
        <span className="text-sm md:text-base">{q}</span>
        {open ? <ChevronUp className="w-5 h-5 text-primary shrink-0 ms-3" /> : <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0 ms-3" />}
      </button>
      {open && (
        <div className="px-5 pb-5 text-muted-foreground text-sm leading-relaxed border-t animate-fade-in pt-4">
          {a}
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  const { t } = useLanguage();
  const f = t.faq;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <section className="py-16 bg-gradient-to-br from-primary/5 to-background">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-5 bg-primary/10 text-primary border-primary/20">{f.title}</Badge>
          <h1 className="text-4xl md:text-5xl font-black mb-4">
            <span className="text-gradient">{f.title}</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">{f.subtitle}</p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="space-y-10">
            {f.categories.map(({ cat, items }) => (
              <div key={cat}>
                <div className="flex items-center gap-3 mb-4">
                  <Badge variant="outline" className="text-primary border-primary/30 font-bold px-4 py-1">{cat}</Badge>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="space-y-3">
                  {items.map(item => <FAQItem key={item.q} {...item} />)}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center bg-accent/50 rounded-2xl p-10">
            <MessageCircle className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">{f.notFound}</h3>
            <p className="text-muted-foreground mb-6">{f.teamReady}</p>
            <Button asChild className="rounded-full px-8 font-bold">
              <Link href="/contact">{t.nav.contact}</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
