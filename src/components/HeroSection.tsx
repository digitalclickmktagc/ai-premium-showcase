import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Zap, Palette } from "lucide-react";
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
