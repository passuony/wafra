import { Button } from "@/components/ui/button";
import { ArrowLeft, Utensils, Heart, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import heroImage from "@/assets/images/hero-community.jpg";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-background pt-16 md:pt-24 lg:pt-32 pb-16">
      <div className="container px-4 mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          <div className="flex flex-col gap-6 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-primary text-sm font-medium w-fit">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              معاً لإنقاذ 10,000 وجبة شهرياً
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-foreground">
              لا تدع الطعام الجيد <br/>
              <span className="text-primary">يذهب سُدى</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-[600px] leading-relaxed">
              منصة "وفرة" تربط المطاعم بالجمعيات الخيرية بخطوات بسيطة. تبرع بالفائض من طعامك الطازج وساهم في رسم ابتسامة على وجوه المحتاجين.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <Button asChild size="lg" className="w-full sm:w-auto text-lg px-8 py-6 h-auto gap-2 group shadow-lg shadow-primary/20">
                <Link href="/restaurants">
                  سجل كمطعم متبرع
                  <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 py-6 h-auto border-2 border-primary/20 hover:border-primary/50 text-foreground bg-background">
                <Link href="/charities">
                  سجل كجمعية خيرية
                </Link>
              </Button>
            </div>
            
            <div className="flex items-center gap-8 mt-8 pt-8 border-t border-border/50">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center text-primary">
                  <Utensils className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold text-xl">+50</p>
                  <p className="text-sm text-muted-foreground">مطعم مشارك</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                  <Heart className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold text-xl">+20</p>
                  <p className="text-sm text-muted-foreground">جمعية مستفيدة</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="relative lg:h-[600px] animate-in fade-in slide-in-from-left-8 duration-1000 delay-150">
            {/* Abstract background shapes */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 to-secondary/20 rounded-[3rem] blur-3xl opacity-50 z-0"></div>
            
            <div className="relative z-10 h-full w-full rounded-3xl overflow-hidden border-8 border-background shadow-2xl shadow-primary/10">
              <img 
                src={heroImage} 
                alt="متطوعون يوزعون الطعام" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1593113630400-ea4288922497?q=80&w=2070&auto=format&fit=crop';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              
              <div className="absolute bottom-6 right-6 left-6 bg-background/95 backdrop-blur p-4 rounded-2xl flex items-center gap-4 shadow-xl border border-white/20">
                <div className="bg-green-100 text-green-600 p-3 rounded-full">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-bold text-foreground">طعام آمن ومطابق للمواصفات</p>
                  <p className="text-sm text-muted-foreground">تتم مراجعة جودة الطعام قبل الاستلام</p>
                </div>
              </div>
            </div>
            
            {/* Floating badge */}
            <div className="absolute top-12 -right-6 bg-white p-4 rounded-2xl shadow-xl z-20 border border-border animate-bounce-slow" style={{ animationDuration: '3s' }}>
              <div className="flex gap-3 items-center">
                <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse"></div>
                <p className="font-bold text-sm">طلب استلام جديد!</p>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
}
