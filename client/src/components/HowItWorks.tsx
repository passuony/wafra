import { ArrowLeft, MapPin, Package, Truck, HeartHandshake } from "lucide-react";

const steps = [
  {
    title: "سجل الفائض",
    description: "يقوم المطعم بتسجيل نوع وكمية الطعام الفائض الصالح للاستهلاك عبر المنصة.",
    icon: <Package className="w-8 h-8" />,
    color: "bg-blue-100 text-blue-600",
    borderColor: "border-blue-200"
  },
  {
    title: "تحديد الموقع",
    description: "يقوم النظام بإرسال إشعار للجمعيات الخيرية الأقرب جغرافياً للمطعم.",
    icon: <MapPin className="w-8 h-8" />,
    color: "bg-amber-100 text-amber-600",
    borderColor: "border-amber-200"
  },
  {
    title: "الاستلام والتوصيل",
    description: "تؤكد الجمعية الاستلام وترسل مندوباً لأخذ الطعام في سيارات مجهزة.",
    icon: <Truck className="w-8 h-8" />,
    color: "bg-emerald-100 text-emerald-600",
    borderColor: "border-emerald-200"
  },
  {
    title: "إطعام محتاج",
    description: "يتم توزيع الوجبات على الأسر المتعففة والمحتاجين في نفس اليوم.",
    icon: <HeartHandshake className="w-8 h-8" />,
    color: "bg-rose-100 text-rose-600",
    borderColor: "border-rose-200"
  }
];

export default function HowItWorks() {
  return (
    <section className="py-24 bg-accent/30 relative">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">كيف تعمل <span className="text-primary">وفرة</span>؟</h2>
          <p className="text-lg text-muted-foreground">
            دورة متكاملة تضمن وصول الطعام الطازج من المطاعم إلى المستحقين بأسرع وقت وأعلى معايير الجودة.
          </p>
        </div>

        <div className="relative">
          {/* Connector Line for Desktop */}
          <div className="hidden lg:block absolute top-1/2 right-0 left-0 h-0.5 bg-border -translate-y-1/2 z-0"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
            {steps.map((step, index) => (
              <div key={index} className="flex flex-col items-center text-center group">
                <div className={`w-24 h-24 rounded-full bg-background border-4 ${step.borderColor} flex items-center justify-center mb-6 shadow-lg shadow-black/5 relative transition-transform group-hover:-translate-y-2 group-hover:shadow-xl duration-300`}>
                  <div className={`w-16 h-16 rounded-full ${step.color} flex items-center justify-center`}>
                    {step.icon}
                  </div>
                  
                  {/* Step Number Badge */}
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                </div>
                
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
                
                {index < steps.length - 1 && (
                  <div className="lg:hidden mt-6 text-border">
                    <ArrowLeft className="w-8 h-8 -rotate-90 md:rotate-0" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
