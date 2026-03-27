import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Zap, Palette, TrendingUp } from "lucide-react";
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

const WallCard = ({ card, isHovered }: { card: TechCard; isHovered: boolean }) => (
  <div
    className="tech-wall-card rounded-2xl p-5 aspect-[4/3] flex flex-col justify-between"
    data-card-id={card.name}
    style={isHovered ? {
      borderColor: 'rgba(147, 51, 234, 0.4)',
      boxShadow: '0 0 20px rgba(147, 51, 234, 0.2), 0 0 40px rgba(147, 51, 234, 0.1), 0 8px 30px rgba(147, 51, 234, 0.15)',
      filter: 'drop-shadow(0 0 12px rgba(147, 51, 234, 0.25))',
    } : {}}
  >
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

const WallColumn = ({ cards, direction, className = "", hoveredCard }: { cards: TechCard[]; direction: "up" | "down"; className?: string; hoveredCard: string | null }) => {
  const doubled = [...cards, ...cards];
  return (
    <div className={`tech-wall-column ${direction === "up" ? "tech-wall-col-up" : "tech-wall-col-down"} flex flex-col gap-5 w-full ${className}`}>
      {doubled.map((card, i) => (
        <WallCard key={`${card.name}-${i}`} card={card} isHovered={hoveredCard === card.name} />
      ))}
    </div>
  );
};

const HeroSection = () => {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    const card = elements.find(el => el.hasAttribute('data-card-id'));
    setHoveredCard(card ? card.getAttribute('data-card-id') : null);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredCard(null);
  }, []);

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
          <div
            ref={containerRef}
            className="hidden lg:block lg:col-span-7 relative"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
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
                  <WallColumn cards={col1Cards} direction="up" hoveredCard={hoveredCard} />
                  <WallColumn cards={col2Cards} direction="down" className="pt-16" hoveredCard={hoveredCard} />
                  <WallColumn cards={col3Cards} direction="up" className="pt-28" hoveredCard={hoveredCard} />
                </div>
              </div>
            </motion.div>

            {/* Floating Conversion Card */}
            <motion.div
              initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="absolute bottom-8 left-4 z-20 w-[280px]"
            >
              <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-[0_8px_40px_rgba(147,51,234,0.1)] p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-display font-semibold text-foreground uppercase tracking-wider">Live</span>
                  </div>
                  <span className="text-[10px] font-display font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Zap size={10} />
                    AI Powered
                  </span>
                </div>

                {/* Main stat */}
                <div className="mb-3">
                  <p className="text-[10px] font-display text-muted-foreground uppercase tracking-widest mb-1">Conversão</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-display font-bold text-gradient-nexa">+35%</span>
                    <span className="text-xs text-muted-foreground font-body">vs. anterior</span>
                  </div>
                </div>

                {/* Mini chart */}
                <div className="mb-3">
                  <svg viewBox="0 0 200 50" className="w-full h-10">
                    <polyline
                      fill="none"
                      stroke="hsl(271 81% 56%)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points="0,40 20,38 40,35 60,30 80,32 100,25 120,20 140,22 160,15 180,10 200,8"
                    />
                    <polyline
                      fill="url(#chartGrad)"
                      strokeWidth="0"
                      points="0,50 0,40 20,38 40,35 60,30 80,32 100,25 120,20 140,22 160,15 180,10 200,8 200,50"
                    />
                    <defs>
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(271 81% 56%)" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="hsl(271 81% 56%)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>

                {/* Bottom stats */}
                <div className="flex gap-2 mb-3">
                  <div className="flex-1 bg-muted/50 rounded-lg px-3 py-2">
                    <p className="text-[9px] font-display text-muted-foreground uppercase tracking-wider">Disponível</p>
                    <p className="text-sm font-display font-bold text-foreground">24/7</p>
                  </div>
                  <div className="flex-1 bg-muted/50 rounded-lg px-3 py-2">
                    <p className="text-[9px] font-display text-muted-foreground uppercase tracking-wider">Custos</p>
                    <p className="text-sm font-display font-bold text-foreground">−60%</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center gap-1.5 text-primary">
                  <TrendingUp size={12} />
                  <span className="text-[10px] font-display font-medium">Crescimento 2× em 6 meses</span>
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
