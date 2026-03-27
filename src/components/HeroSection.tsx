import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Zap, TrendingUp } from "lucide-react";
import nexaLogo from "@/assets/nexa-logo-new.png";

const chartPoints = [6, 14, 9, 20, 16, 28, 22, 36, 30, 42];
const maxVal = Math.max(...chartPoints);
const minVal = Math.min(...chartPoints);
const normalize = (v: number) =>
  100 - ((v - minVal) / (maxVal - minVal)) * 80 - 10;

const polyline = chartPoints
  .map((v, i) => `${(i / (chartPoints.length - 1)) * 100},${normalize(v)}`)
  .join(" ");

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-24 pb-16 px-4 overflow-hidden">

      {/* Dot grid background */}
      <div className="absolute inset-0 dot-grid opacity-100 pointer-events-none" />

      {/* Gradient fade at edges */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(147,51,234,0.05) 0%, transparent 70%)",
        }}
      />

      <div className="container mx-auto relative z-10">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16 lg:items-center">

          {/* LEFT — content */}
          <div className="lg:col-span-7 text-center lg:text-left flex flex-col items-center lg:items-start">


            {/* Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-light tracking-tight leading-[1.05] mb-6 uppercase text-foreground"
            >
              A IA EXECUTA
              <br />
              <span className="text-gradient-nexa font-bold">ENQUANTO VOCÊ</span>
              <br />
              <span className="text-gradient-nexa font-bold">LIDERA.</span>
            </motion.h1>

            {/* Subtext */}
            <motion.p
              initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-lg md:text-xl text-muted-foreground mb-10 font-body font-light max-w-xl"
            >
              Automação inteligente para empresas que pensam grande.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 items-center lg:items-start"
            >
              <a href="#diagnostico">
                <Button variant="glow" size="lg" className="text-sm px-8 tracking-widest text-white cursor-pointer uppercase">
                  ESCALAR MEU ATENDIMENTO
                  <ArrowRight className="ml-2" size={16} />
                </Button>
              </a>
              <a href="#solucoes">
                <Button
                  variant="outline"
                  size="lg"
                  className="text-sm px-8 tracking-wide cursor-pointer border-black/10 hover:border-primary/30 hover:bg-primary/[0.03] text-foreground"
                >
                  Ver soluções
                </Button>
              </a>
            </motion.div>

          </div>

          {/* RIGHT — premium metric card */}
          <div className="hidden lg:flex lg:col-span-5 justify-center items-center mt-12 lg:mt-0">
            <motion.div
              initial={{ opacity: 0, x: 40, filter: "blur(12px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.9, delay: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="relative"
            >
              {/* Purple halo glow — visible on white */}
              <div
                className="absolute inset-0 rounded-[36px] pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse at center, rgba(147,51,234,0.18) 0%, transparent 70%)",
                  filter: "blur(30px)",
                  transform: "scale(1.2)",
                }}
              />

              {/* Card */}
              <div
                className="relative w-[330px] rounded-[28px] overflow-hidden"
                style={{
                  background: "#ffffff",
                  border: "1px solid rgba(0,0,0,0.07)",
                  boxShadow: `
                    0 2px 4px rgba(0,0,0,0.04),
                    0 8px 32px rgba(0,0,0,0.07),
                    0 24px 80px rgba(147,51,234,0.12),
                    0 0 0 1px rgba(147,51,234,0.06)
                  `,
                }}
              >
                {/* Gradient top edge accent */}
                <div
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ background: "linear-gradient(90deg, #6B21A8, #9333EA, #A855F7, #7C3AED)" }}
                />

                <div className="p-6 pt-7">
                  {/* Live indicator */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/50" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                      </span>
                      <span className="text-[11px] font-semibold text-foreground/60 tracking-wide uppercase">Live</span>
                    </div>
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                      style={{
                        background: "rgba(147,51,234,0.06)",
                        border: "1px solid rgba(147,51,234,0.15)",
                      }}
                    >
                      <Zap size={10} className="text-primary" />
                      <span className="text-[10px] font-semibold text-primary tracking-wide">AI Powered</span>
                    </div>
                  </div>

                  {/* Main metric */}
                  <div className="mb-2">
                    <p className="text-xs text-muted-foreground/60 tracking-[0.15em] uppercase mb-1">Conversão</p>
                    <div className="flex items-end gap-2">
                      <span
                        className="font-display text-6xl font-bold leading-none"
                        style={{
                          background: "linear-gradient(135deg, #7C3AED, #9333EA, #A855F7)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                        }}
                      >
                        +35%
                      </span>
                      <span className="text-xs text-muted-foreground/50 mb-2 pb-1">vs. anterior</span>
                    </div>
                  </div>

                  {/* Mini chart */}
                  <div className="relative h-[72px] mb-5 -mx-1">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                      <defs>
                        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(147,51,234,0.2)" />
                          <stop offset="100%" stopColor="rgba(147,51,234,0)" />
                        </linearGradient>
                      </defs>
                      <polygon points={`0,100 ${polyline} 100,100`} fill="url(#chartFill)" />
                      <polyline
                        points={polyline}
                        fill="none"
                        stroke="rgba(147,51,234,0.7)"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {(() => {
                        const lastIdx = chartPoints.length - 1;
                        const lx = (lastIdx / (chartPoints.length - 1)) * 100;
                        const ly = normalize(chartPoints[lastIdx]);
                        return <circle cx={lx} cy={ly} r="2.5" fill="#9333ea" />;
                      })()}
                    </svg>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-2 mb-5">
                    <div className="flex-1 h-px bg-black/[0.06]" />
                    <span className="text-[10px] text-muted-foreground/40 tracking-widest uppercase">Resultados</span>
                    <div className="flex-1 h-px bg-black/[0.06]" />
                  </div>

                  {/* Bottom stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className="p-3 rounded-2xl"
                      style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.05)" }}
                    >
                      <p className="text-[11px] text-muted-foreground/60 mb-1">Disponível</p>
                      <p className="font-display text-xl font-bold text-foreground">24/7</p>
                    </div>
                    <div
                      className="p-3 rounded-2xl"
                      style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.05)" }}
                    >
                      <p className="text-[11px] text-muted-foreground/60 mb-1">Custos</p>
                      <p className="font-display text-xl font-bold text-foreground">−60%</p>
                    </div>
                  </div>

                  {/* Trending indicator */}
                  <div
                    className="mt-3 flex items-center gap-2 p-3 rounded-xl"
                    style={{ background: "rgba(147,51,234,0.04)", border: "1px solid rgba(147,51,234,0.1)" }}
                  >
                    <TrendingUp size={14} className="text-primary" />
                    <span className="text-xs text-primary font-medium">Crescimento 2× em 6 meses</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent pointer-events-none" />
    </section>
  );
};

export default HeroSection;
