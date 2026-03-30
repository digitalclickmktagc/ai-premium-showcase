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
      borderColor: 'rgba(147, 51, 234, 0.35)',
      background: 'rgba(255,255,255,0.06)',
      boxShadow: '0 0 0 1px rgba(147,51,234,0.12), 0 20px 60px rgba(0,0,0,0.50), 0 0 20px rgba(147,51,234,0.25)',
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

      <div className="container mx-auto relative z-10">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:items-center">

          {/* LEFT — content */}
          <div className="lg:col-span-5 text-center lg:text-left flex flex-col items-center lg:items-start">


            <motion.h1
              initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="font-display font-extrabold tracking-tight leading-[1.05] mb-6 uppercase text-foreground"
              style={{ fontSize: "clamp(2.2rem, 5vw, 4.5rem)", letterSpacing: "-0.03em" }}
            >
              A IA EXECUTA<br />
              <span
                className="text-gradient-nexa"
                style={{ filter: "drop-shadow(0 0 30px rgba(147,51,234,0.5))" }}
              >
                ENQUANTO VOCÊ LIDERA.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mb-10 font-body font-normal whitespace-nowrap"
              style={{
                color: "rgba(240,240,240,0.50)",
                fontSize: "clamp(0.8rem, 1.3vw, 1rem)",
                lineHeight: 1.5,
              }}
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
                <Button
                  variant="glow"
                  size="lg"
                  className="text-white text-[0.9rem] px-8 tracking-[0.06em] font-bold uppercase"
                  style={{ padding: "0.9rem 2rem", borderRadius: "0.75rem" }}
                >
                  ESCALAR MEU ATENDIMENTO
                  <ArrowRight className="ml-2" size={16} />
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

              {/* 3D Wall */}
              <div className="tech-wall-container h-full w-full">
                <div className="tech-wall-grid h-full w-full flex gap-6 px-6">
                  <WallColumn cards={col1Cards} direction="up" hoveredCard={hoveredCard} />
                  <WallColumn cards={col2Cards} direction="down" className="pt-16" hoveredCard={hoveredCard} />
                  <WallColumn cards={col3Cards} direction="up" className="pt-28" hoveredCard={hoveredCard} />
                </div>
              </div>
            </motion.div>

          </div>

        </div>
      </div>

    </section>
  );
};

export default HeroSection;
