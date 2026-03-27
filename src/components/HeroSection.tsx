import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Zap, TrendingUp, Palette } from "lucide-react";
import supabaseIcon from "@/assets/supabase-icon.png";
import chatgptIcon from "@/assets/chatgpt-icon.png";
import whatsappIcon from "@/assets/whatsapp-icon.png";
import claudeIcon from "@/assets/claude-icon.png";
import postgresIcon from "@/assets/postgres-icon.png";
import evolutionIcon from "@/assets/evolution-icon.png";
import geminiIcon from "@/assets/gemini-icon.png";
import redisIcon from "@/assets/redis-icon.png";
import githubIcon from "@/assets/github-icon.png";
import n8nIcon from "@/assets/n8n-icon.png";
import notionIcon from "@/assets/notion-icon.png";

/* ── Chart data for metric card ── */
const chartPoints = [6, 14, 9, 20, 16, 28, 22, 36, 30, 42];
const maxVal = Math.max(...chartPoints);
const minVal = Math.min(...chartPoints);
const normalize = (v: number) =>
  100 - ((v - minVal) / (maxVal - minVal)) * 80 - 10;
const polyline = chartPoints
  .map((v, i) => `${(i / (chartPoints.length - 1)) * 100},${normalize(v)}`)
  .join(" ");

/* ── Tech card types ── */
interface TechCard {
  icon: React.ReactNode;
  name: string;
  category: string;
}

const col1: TechCard[] = [
  { icon: <img src={chatgptIcon} alt="OpenAI" className="w-7 h-7" />, name: "OpenAI", category: "Intelligence" },
  { icon: <img src={n8nIcon} alt="N8N" className="w-7 h-7" />, name: "N8N", category: "Automation" },
  { icon: <img src={whatsappIcon} alt="WhatsApp" className="w-9 h-9" />, name: "WhatsApp", category: "Messaging" },
  { icon: <img src={supabaseIcon} alt="Supabase" className="w-7 h-7" />, name: "Supabase", category: "Database" },
  { icon: <img src={geminiIcon} alt="Gemini" className="w-7 h-7" />, name: "Gemini", category: "AI Model" },
];

const col2: TechCard[] = [
  { icon: <img src={claudeIcon} alt="Claude" className="w-7 h-7" />, name: "Claude", category: "Code" },
  { icon: <Zap size={28} className="text-violet-500" />, name: "Make", category: "Integration" },
  { icon: <img src={postgresIcon} alt="Postgres" className="w-7 h-7" />, name: "Postgres", category: "Database" },
  { icon: <img src={redisIcon} alt="Redis" className="w-7 h-7" />, name: "Redis", category: "Cache" },
];

const col3: TechCard[] = [
  { icon: <img src={githubIcon} alt="GitHub" className="w-7 h-7" />, name: "GitHub", category: "VCS" },
  { icon: <Palette size={28} className="text-pink-500" />, name: "Figma", category: "Design" },
  { icon: <img src={notionIcon} alt="Notion" className="w-7 h-7" />, name: "Notion", category: "Wiki" },
  { icon: <img src={evolutionIcon} alt="Evolution" className="w-7 h-7" />, name: "Evolution", category: "API" },
];

/* ── Small wall card ── */
const MiniCard = ({ card }: { card: TechCard }) => (
  <div className="tech-wall-card rounded-2xl p-5 flex flex-col justify-between aspect-[4/3]">
    <div className="flex justify-between items-start">
      {card.icon}
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400/50" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
      </span>
    </div>
    <div>
      <div className="text-sm font-display font-semibold text-foreground">{card.name}</div>
      <div className="text-[10px] font-display text-muted-foreground uppercase tracking-wider">{card.category}</div>
    </div>
  </div>
);

const WallCol = ({ cards, dir, className = "" }: { cards: TechCard[]; dir: "up" | "down"; className?: string }) => (
  <div className={`tech-wall-column ${dir === "up" ? "tech-wall-col-up" : "tech-wall-col-down"} flex flex-col gap-5 w-full ${className}`}>
    {[...cards, ...cards].map((c, i) => (
      <MiniCard key={`${c.name}-${i}`} card={c} />
    ))}
  </div>
);

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-24 pb-16 px-4 overflow-hidden">
      {/* Dot grid */}
      <div className="absolute inset-0 dot-grid opacity-100 pointer-events-none" />

      {/* Ambient top glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(147,51,234,0.05) 0%, transparent 70%)" }}
      />

      <div className="container mx-auto relative z-10">
        <div className="lg:grid lg:grid-cols-12 lg:gap-10 lg:items-center">

          {/* LEFT — text */}
          <div className="lg:col-span-6 text-center lg:text-left flex flex-col items-center lg:items-start">
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

            <motion.p
              initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-lg md:text-xl text-muted-foreground mb-10 font-body font-light max-w-xl"
            >
              Automação inteligente para empresas que pensam grande.
            </motion.p>

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

          {/* RIGHT — layered: tech wall (bg) + metric card (fg) */}
          <div className="hidden lg:flex lg:col-span-6 justify-center items-center relative">
            <motion.div
              initial={{ opacity: 0, x: 50, filter: "blur(14px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              transition={{ duration: 1, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="relative w-full h-[580px]"
            >
              {/* Purple ambient glow behind everything */}
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
                style={{
                  background: "radial-gradient(circle, rgba(147,51,234,0.12) 0%, rgba(147,51,234,0.04) 40%, transparent 70%)",
                  filter: "blur(40px)",
                }}
              />

              {/* Tech wall — background layer */}
              <div className="absolute inset-0 overflow-hidden">
                {/* Edge fades */}
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#f8f6fb] to-transparent z-10 pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#f8f6fb] to-transparent z-10 pointer-events-none" />
                <div className="absolute top-0 bottom-0 right-0 w-24 bg-gradient-to-l from-[#f8f6fb] to-transparent z-10 pointer-events-none" />
                <div
                  className="absolute top-0 bottom-0 left-0 w-48 z-10 pointer-events-none"
                  style={{
                    background: "linear-gradient(to right, #f8f6fb 0%, rgba(248,246,251,0.95) 30%, rgba(248,246,251,0.6) 60%, transparent 100%)",
                  }}
                />

                <div className="tech-wall-container h-full w-full">
                  <div className="tech-wall-grid h-full w-full flex gap-4 px-4">
                    <WallCol cards={col1} dir="up" />
                    <WallCol cards={col2} dir="down" className="pt-14" />
                    <WallCol cards={col3} dir="up" className="pt-24" />
                  </div>
                </div>
              </div>

              {/* Metric card — floating foreground layer */}
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="absolute bottom-8 left-4 z-20"
              >
                <div
                  className="w-[300px] rounded-[24px] overflow-hidden"
                  style={{
                    background: "rgba(255,255,255,0.85)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                    border: "1px solid rgba(255,255,255,0.6)",
                    boxShadow: `
                      0 4px 24px rgba(0,0,0,0.06),
                      0 16px 56px rgba(147,51,234,0.1),
                      0 0 0 1px rgba(147,51,234,0.05)
                    `,
                  }}
                >
                  {/* Top accent line */}
                  <div
                    className="h-[2px]"
                    style={{ background: "linear-gradient(90deg, #6B21A8, #9333EA, #A855F7, #7C3AED)" }}
                  />

                  <div className="p-5">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/50" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                        </span>
                        <span className="text-[10px] font-semibold text-foreground/50 tracking-wide uppercase">Live</span>
                      </div>
                      <div
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(147,51,234,0.06)", border: "1px solid rgba(147,51,234,0.12)" }}
                      >
                        <Zap size={9} className="text-primary" />
                        <span className="text-[9px] font-semibold text-primary tracking-wide">AI Powered</span>
                      </div>
                    </div>

                    {/* Metric */}
                    <p className="text-[10px] text-muted-foreground/50 tracking-[0.15em] uppercase mb-0.5">Conversão</p>
                    <div className="flex items-end gap-1.5 mb-3">
                      <span
                        className="font-display text-5xl font-bold leading-none"
                        style={{
                          background: "linear-gradient(135deg, #7C3AED, #9333EA, #A855F7)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                        }}
                      >
                        +35%
                      </span>
                      <span className="text-[10px] text-muted-foreground/40 mb-1.5">vs. anterior</span>
                    </div>

                    {/* Mini chart */}
                    <div className="relative h-[48px] mb-3 -mx-0.5">
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                        <defs>
                          <linearGradient id="heroChartFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(147,51,234,0.15)" />
                            <stop offset="100%" stopColor="rgba(147,51,234,0)" />
                          </linearGradient>
                        </defs>
                        <polygon points={`0,100 ${polyline} 100,100`} fill="url(#heroChartFill)" />
                        <polyline
                          points={polyline}
                          fill="none"
                          stroke="rgba(147,51,234,0.6)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {(() => {
                          const lx = 100;
                          const ly = normalize(chartPoints[chartPoints.length - 1]);
                          return <circle cx={lx} cy={ly} r="2.5" fill="#9333ea" />;
                        })()}
                      </svg>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="p-2.5 rounded-xl" style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.04)" }}>
                        <p className="text-[9px] text-muted-foreground/50 mb-0.5">Disponível</p>
                        <p className="font-display text-lg font-bold text-foreground">24/7</p>
                      </div>
                      <div className="p-2.5 rounded-xl" style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.04)" }}>
                        <p className="text-[9px] text-muted-foreground/50 mb-0.5">Custos</p>
                        <p className="font-display text-lg font-bold text-foreground">−60%</p>
                      </div>
                    </div>

                    {/* Trending */}
                    <div
                      className="flex items-center gap-1.5 p-2 rounded-lg"
                      style={{ background: "rgba(147,51,234,0.03)", border: "1px solid rgba(147,51,234,0.08)" }}
                    >
                      <TrendingUp size={12} className="text-primary" />
                      <span className="text-[10px] text-primary font-medium">Crescimento 2× em 6 meses</span>
                    </div>
                  </div>
                </div>
              </motion.div>
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
