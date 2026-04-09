import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { useCardGlow } from "@/hooks/use-card-glow";

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
        <Star
          key={j}
          size={13}
          style={{
            fill: "#A855F7",
            color: "#A855F7",
            filter: "drop-shadow(0 0 6px rgba(168,85,247,0.6))",
          }}
        />
      ))}
      {hasHalf && (
        <div className="relative" style={{ width: 13, height: 13 }}>
          <Star size={13} style={{ color: "rgba(168,85,247,0.30)" }} className="absolute inset-0" />
          <div className="overflow-hidden absolute inset-0" style={{ width: "50%" }}>
            <Star size={13} style={{ fill: "#A855F7", color: "#A855F7", filter: "drop-shadow(0 0 6px rgba(168,85,247,0.6))" }} />
          </div>
        </div>
      )}
    </div>
  );
};

const Avatar = ({ name }: { name: string }) => (
  <div
    className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
    style={{
      background: "var(--gradient-nexa)",
      boxShadow: "var(--glow-sm)",
    }}
  >
    <span className="text-xs font-display font-bold text-white">
      {name.split(" ").map((n) => n[0]).join("")}
    </span>
  </div>
);

const TestimonialsSection = () => {
  const [featured, ...rest] = testimonials;
  const { handleMouseMove } = useCardGlow();

  return (
    <section id="depoimentos" className="py-24 lg:py-32 relative overflow-hidden">

      <div className="container mx-auto px-4 lg:px-8 relative z-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <p className="text-[0.7rem] font-semibold tracking-[0.20em] uppercase mb-4" style={{ color: "#A855F7" }}>
            Depoimentos
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-foreground">
            Quem <span className="text-gradient-nexa font-bold">confia.</span>
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
            className="lg:col-span-7 glass-card rounded-[24px] p-8 sm:p-10 relative overflow-hidden"
            onMouseMove={handleMouseMove}
            style={{
              padding: "2rem 2rem 1.75rem",
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

            <div
              className="relative z-[1] mb-6 mt-2"
              style={{
                color: "rgba(147,51,234,0.25)",
                fontSize: "5rem",
                fontFamily: "Georgia, serif",
                lineHeight: 0.5,
              }}
            >
              "
            </div>
            <div className="relative z-[1]">
              <Stars count={featured.stars} />
            </div>
            <blockquote
              className="font-body text-xl sm:text-2xl font-light leading-relaxed mt-5 mb-8 relative z-[1] italic"
              style={{ color: "rgba(240,240,240,0.80)" }}
            >
              "{featured.quote}"
            </blockquote>
            <div
              className="flex items-center gap-3 pt-6 relative z-[1]"
              style={{
                borderTop: "1px solid transparent",
                borderImage: "linear-gradient(90deg, rgba(147,51,234,0.3), rgba(147,51,234,0.05)) 1",
              }}
            >
              <Avatar name={featured.name} />
              <div>
                <p className="font-display font-semibold text-[0.9rem] text-foreground">{featured.name}</p>
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
              className="glass-card rounded-[20px] p-6 relative overflow-hidden"
              onMouseMove={handleMouseMove}
            >
              <p className="text-[0.7rem] tracking-[0.15em] uppercase mb-2"
                style={{ color: "rgba(240,240,240,0.40)" }}>
                Tarefas Automatizadas
              </p>
              <p
                className="font-display font-extrabold animate-pulse-glow"
                style={{
                  fontSize: "clamp(2.5rem, 5vw, 4rem)",
                  background: "var(--gradient-nexa)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                80%
              </p>
              <p className="text-[0.8rem] mt-1" style={{ color: "rgba(240,240,240,0.50)" }}>
                das operações manuais
              </p>
            </div>

            {/* Bottom metric card */}
            <div
              className="glass-card rounded-[20px] p-6 relative overflow-hidden"
              onMouseMove={handleMouseMove}
            >
              <p className="text-[0.7rem] tracking-[0.15em] uppercase mb-2"
                style={{ color: "rgba(240,240,240,0.40)" }}>
                Crescimento em Faturamento
              </p>
              <p
                className="font-display font-extrabold animate-pulse-glow"
                style={{
                  fontSize: "clamp(2.5rem, 5vw, 4rem)",
                  background: "var(--gradient-nexa)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                2×
              </p>
              <p className="text-[0.8rem] mt-1" style={{ color: "rgba(240,240,240,0.50)" }}>
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
              initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="glass-card rounded-[20px] p-7 flex flex-col justify-between"
              onMouseMove={handleMouseMove}
              style={{ padding: "2rem 2rem 1.75rem" }}
            >
              <div className="relative z-[1]">
                <Stars count={t.stars} />
                <p className="font-body leading-[1.75] my-5 text-[1rem] italic" style={{ color: "rgba(240,240,240,0.80)" }}>
                  "{t.quote}"
                </p>
              </div>
              <div
                className="flex items-center gap-3 pt-4 relative z-[1]"
                style={{
                  borderTop: "1px solid transparent",
                  borderImage: "linear-gradient(90deg, rgba(147,51,234,0.3), rgba(147,51,234,0.05)) 1",
                }}
              >
                <Avatar name={t.name} />
                <div>
                  <p className="font-display font-semibold text-[0.9rem] text-foreground">{t.name}</p>
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
