import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    quote: "A Nexa AI transformou completamente nosso processo de vendas. Automatizamos 80% das tarefas manuais e dobramos o faturamento em 6 meses.",
    name: "Carlos Mendes",
    stars: 5,
  },
  {
    quote: "O painel personalizado e o agente de IA revolucionaram nosso atendimento. Hoje respondemos em segundos, não em horas.",
    name: "Ana Oliveira",
    stars: 4.5,
  },
  {
    quote: "Precisávamos escalar sem perder qualidade. A Nexa AI entregou exatamente isso com uma solução sob medida para nosso segmento.",
    name: "Rafael Torres",
    stars: 4,
  },
];

const Stars = ({ count = 5 }: { count?: number }) => {
  const full = Math.floor(count);
  const hasHalf = count % 1 !== 0;
  return (
    <div className="flex gap-1">
      {Array.from({ length: full }).map((_, j) => (
        <Star key={j} size={13} className="fill-primary/70 text-primary/70" />
      ))}
      {hasHalf && (
        <div className="relative" style={{ width: 13, height: 13 }}>
          <Star size={13} className="text-primary/30 absolute inset-0" />
          <div className="overflow-hidden absolute inset-0" style={{ width: "50%" }}>
            <Star size={13} className="fill-primary/70 text-primary/70" />
          </div>
        </div>
      )}
    </div>
  );
};

const Avatar = ({ name }: { name: string }) => (
  <div
    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
    style={{
      background: "linear-gradient(135deg, rgba(147,51,234,0.2), rgba(109,40,217,0.1))",
      border: "1px solid rgba(147,51,234,0.25)",
    }}
  >
    <span className="text-xs font-display font-bold text-primary">
      {name.split(" ").map((n) => n[0]).join("")}
    </span>
  </div>
);

const TestimonialsSection = () => {
  const [featured, ...rest] = testimonials;

  return (
    <section id="depoimentos" className="py-24 lg:py-32 relative overflow-hidden">
      {/* Ghost section number */}
      <div
        className="absolute -top-8 right-0 font-display font-black select-none pointer-events-none leading-none"
        style={{
          fontSize: "clamp(120px, 20vw, 240px)",
          color: "transparent",
          WebkitTextStroke: "1px rgba(255,255,255,0.04)",
        }}
      >
        03.
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <p className="text-sm font-medium tracking-[0.3em] uppercase text-gradient-nexa mb-4">
            Depoimentos
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-foreground">
            Quem <span className="text-gradient-nexa">confia.</span>
          </h2>
        </motion.div>

        {/* Featured testimonial */}
        <motion.div
          initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-5 lg:grid lg:grid-cols-12 lg:gap-5"
        >
          {/* Left — large blockquote */}
          <div
            className="lg:col-span-7 rounded-[24px] p-8 sm:p-10 relative overflow-hidden"
            style={{
              background: "rgba(23, 23, 23, 0.6)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 4px 30px rgba(0,0,0,0.30), inset 0 0 20px rgba(255,255,255,0.02)",
            }}
          >
            {/* Gradient corner accent */}
            <div
              className="absolute top-0 left-0 w-48 h-48 rounded-full pointer-events-none"
              style={{
                background: "radial-gradient(circle, rgba(147,51,234,0.12) 0%, transparent 70%)",
                filter: "blur(40px)",
              }}
            />

            {/* Top accent line */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[24px]"
              style={{
                background: "linear-gradient(90deg, #6B21A8, #9333EA, #A855F7, transparent)",
              }}
            />

            <Quote size={40} style={{ color: "rgba(147,51,234,0.25)" }} className="mb-6 mt-2" />
            <Stars count={featured.stars} />
            <blockquote className="font-display text-xl sm:text-2xl font-light leading-relaxed text-foreground/90 mt-5 mb-8">
              "{featured.quote}"
            </blockquote>
            <div
              className="flex items-center gap-3 pt-6"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              <Avatar name={featured.name} />
              <div>
                <p className="font-display font-bold text-sm text-foreground">{featured.name}</p>
              </div>
            </div>
          </div>

          {/* Right — metric panel */}
          <motion.div
            initial={{ opacity: 0, x: 20, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="hidden lg:flex lg:col-span-5 flex-col gap-4 justify-center"
          >
            {/* Top metric card */}
            <div
              className="rounded-[20px] p-6 relative overflow-hidden"
              style={{
                background: "rgba(23, 23, 23, 0.6)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 4px 30px rgba(0,0,0,0.30), inset 0 0 20px rgba(255,255,255,0.02)",
              }}
            >
              <p className="text-xs tracking-[0.15em] uppercase mb-2"
                style={{ color: "rgba(255,255,255,0.35)" }}>
                Tarefas Automatizadas
              </p>
              <p
                className="font-display text-5xl font-bold"
                style={{
                  background: "linear-gradient(135deg, #7C3AED, #9333EA)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                80%
              </p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                das operações manuais
              </p>
            </div>

            {/* Bottom metric card */}
            <div
              className="rounded-[20px] p-6 relative overflow-hidden"
              style={{
                background: "rgba(15, 15, 25, 0.8)",
                border: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              }}
            >
              <p className="text-xs tracking-[0.15em] uppercase mb-2"
                style={{ color: "rgba(255,255,255,0.35)" }}>
                Crescimento em Faturamento
              </p>
              <p
                className="font-display text-5xl font-bold"
                style={{
                  background: "linear-gradient(135deg, #7C3AED, #9333EA)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                2×
              </p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                em apenas 6 meses
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Remaining testimonials */}
        <div className="grid gap-4 md:grid-cols-2">
          {rest.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="rounded-[20px] p-7 flex flex-col justify-between"
              style={{
                background: "rgba(15, 15, 25, 0.8)",
                border: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.2), 0 4px 20px rgba(0,0,0,0.15)",
                transition: "all 0.3s ease",
              }}
            >
              <div>
                <Stars count={t.stars} />
                <p className="text-muted-foreground font-body leading-relaxed my-5 text-sm">
                  "{t.quote}"
                </p>
              </div>
              <div
                className="flex items-center gap-3 pt-4"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <Avatar name={t.name} />
                <div>
                   <p className="font-display font-bold text-sm text-foreground">{t.name}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default TestimonialsSection;