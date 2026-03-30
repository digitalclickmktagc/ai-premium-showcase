import { motion } from "framer-motion";
import { Zap, Clock, Crosshair } from "lucide-react";
import { useCardGlow } from "@/hooks/use-card-glow";

const benefits = [
  {
    icon: Zap,
    title: "Escalabilidade",
    desc: "Cresce com você.\nSem gargalos,\nsem teto.",
    highlight: "Sem limites de crescimento",
    color: "#9333ea",
  },
  {
    icon: Clock,
    title: "Tempo Devolvido",
    desc: "Operacional no automático.\nEquipe no estratégico.",
    highlight: "Foco total em resultados",
    color: "#7c3aed",
  },
  {
    icon: Crosshair,
    title: "Precisão Cirúrgica",
    desc: "Dados reais.\nDecisões certeiras.\nZero achismo.",
    highlight: "Inteligência acionável",
    color: "#a855f7",
  },
];

const BenefitsSection = () => {
  const { handleMouseMove } = useCardGlow();

  return (
    <section id="diferenciais" className="py-24 lg:py-32 relative overflow-hidden">
      {/* Ghost section number */}
      <div
        className="absolute -top-8 left-0 font-display font-black select-none pointer-events-none leading-none"
        style={{
          fontSize: "clamp(120px, 20vw, 240px)",
          color: "transparent",
          WebkitTextStroke: "1px rgba(255,255,255,0.03)",
        }}
      >
        02.
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p className="text-[0.7rem] font-semibold tracking-[0.20em] uppercase mb-4" style={{ color: "#A855F7" }}>
            Por que a Nexa AI?
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-foreground">
            Complexidade{" "}
            <span className="text-gradient-nexa font-bold">simplificada.</span>
          </h2>
          <p className="text-muted-foreground font-body font-light mt-4 sm:whitespace-nowrap" style={{ color: "rgba(240,240,240,0.55)" }}>
            Transformamos gargalos operacionais em motores de lucro através da IA.
          </p>
        </motion.div>

        {/* Benefit cards */}
        <div className="grid md:grid-cols-3 gap-5 lg:gap-6 mb-20">
          {benefits.map((b, i) => {
            const Icon = b.icon;
            return (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="group relative rounded-2xl p-8 overflow-hidden premium-card"
                onMouseMove={handleMouseMove}
              >
                {/* Watermark number */}
                <span
                  className="absolute -bottom-4 -right-2 font-display font-black select-none pointer-events-none leading-none"
                  style={{ fontSize: "6rem", color: "rgba(255,255,255,0.03)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                {/* Top row: icon + highlight tag */}
                <div className="flex items-start justify-between mb-6 relative z-[1]">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300"
                    style={{
                      background: "rgba(147,51,234,0.12)",
                      border: "1px solid rgba(147,51,234,0.2)",
                    }}
                  >
                    <Icon size={22} className="text-primary" />
                  </div>
                  <span
                    className="text-[10px] font-semibold tracking-wide rounded-full px-2.5 py-1"
                    style={{
                      color: "#a855f7",
                      border: "1px solid rgba(147,51,234,0.2)",
                      background: "rgba(147,51,234,0.08)",
                    }}
                  >
                    {b.highlight}
                  </span>
                </div>

                <h3 className="font-display text-xl font-bold mb-3 text-foreground relative z-[1]">{b.title}</h3>
                <p className="font-body leading-relaxed whitespace-pre-line text-sm relative z-[1]" style={{ color: "rgba(240,240,240,0.55)" }}>
                  {b.desc}
                </p>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default BenefitsSection;
