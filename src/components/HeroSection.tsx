import { useState } from "react";
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

interface TechCard {
  icon: React.ReactNode;
  name: string;
  category: string;
  color: string;
}

const col1Cards: TechCard[] = [
  { icon: <img src={chatgptIcon} alt="OpenAI" className="w-7 h-7" />, name: "OpenAI", category: "Intelligence", color: "text-primary" },
  { icon: <img src={n8nIcon} alt="N8N" className="w-7 h-7" />, name: "N8N", category: "Automation", color: "text-orange-500" },
  { icon: <img src={whatsappIcon} alt="WhatsApp" className="w-9 h-9" />, name: "WhatsApp", category: "Messaging", color: "text-green-500" },
  { icon: <img src={supabaseIcon} alt="Supabase" className="w-7 h-7" />, name: "Supabase", category: "Database", color: "text-emerald-500" },
  { icon: <img src={geminiIcon} alt="Google Gemini" className="w-7 h-7" />, name: "Gemini", category: "AI Model", color: "text-blue-500" },
];

const col2Cards: TechCard[] = [
  { icon: <img src={claudeIcon} alt="Claude" className="w-7 h-7" />, name: "Claude", category: "Code", color: "text-foreground" },
  { icon: <Zap size={28} />, name: "Make", category: "Integration", color: "text-violet-500" },
  { icon: <img src={postgresIcon} alt="Postgres" className="w-7 h-7" />, name: "Postgres", category: "Database", color: "text-blue-500" },
  { icon: <img src={redisIcon} alt="Redis" className="w-7 h-7" />, name: "Redis", category: "Cache", color: "text-red-500" },
];

const col3Cards: TechCard[] = [
  { icon: <img src={githubIcon} alt="GitHub" className="w-7 h-7" />, name: "GitHub", category: "VCS", color: "text-foreground" },
  { icon: <Palette size={28} />, name: "Figma", category: "Design", color: "text-pink-500" },
  { icon: <img src={notionIcon} alt="Notion" className="w-7 h-7" />, name: "Notion", category: "Wiki", color: "text-foreground" },
  { icon: <img src={evolutionIcon} alt="Evolution" className="w-7 h-7" />, name: "Evolution", category: "API", color: "text-emerald-500" },
];

const WallCard = ({ card }: { card: TechCard }) => (
  <div className="tech-wall-card rounded-2xl p-5 aspect-[4/3] flex flex-col justify-between">
    <div className="flex justify-between items-start">
      <div className={card.color}>{card.icon}</div>
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

const WallColumn = ({ cards, direction, className = "" }: { cards: TechCard[]; direction: "up" | "down"; className?: string }) => {
  const doubled = [...cards, ...cards];
  return (
    <div className={`tech-wall-column ${direction === "up" ? "tech-wall-col-up" : "tech-wall-col-down"} flex flex-col gap-5 w-full ${className}`}>
      {doubled.map((card, i) => (
        <WallCard key={`${card.name}-${i}`} card={card} />
      ))}
    </div>
  );
};

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
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:items-center">

          {/* LEFT — content */}
          <div className="lg:col-span-5 text-center lg:text-left flex flex-col items-center lg:items-start">
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

          {/* RIGHT — Tech Wall Cards */}
          <div className="hidden lg:block lg:col-span-7 relative">
            <motion.div
              initial={{ opacity: 0, x: 40, filter: "blur(12px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.9, delay: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="relative h-[650px] overflow-hidden"
            >
              {/* Fade edges */}
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />
              <div className="absolute top-0 bottom-0 right-0 w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
              <div className="absolute top-0 bottom-0 left-0 w-12 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />

              {/* 3D Wall */}
              <div className="tech-wall-container h-full w-full">
                <div className="tech-wall-grid h-full w-full flex gap-6 px-6">
                  <WallColumn cards={col1Cards} direction="up" />
                  <WallColumn cards={col2Cards} direction="down" className="pt-16" />
                  <WallColumn cards={col3Cards} direction="up" className="pt-28" />
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
