import { motion } from "framer-motion";
import { Cpu, Zap, Palette } from "lucide-react";
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

const TechWallSection = () => {
  return (
    <section className="relative py-24 lg:py-0 overflow-hidden">
      {/* Ambient purple glow */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/[0.06] blur-[120px] rounded-full pointer-events-none z-0" />

      <div className="container mx-auto relative z-10 flex flex-col md:flex-row min-h-[700px] lg:min-h-[800px]">
        {/* LEFT — Content */}
        <div className="w-full md:w-[42%] px-4 py-16 md:py-28 flex flex-col justify-center relative z-20">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/15 bg-primary/[0.04] self-start mb-6"
          >
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            <span className="text-[10px] font-display font-semibold text-primary uppercase tracking-[0.15em]">Infraestrutura</span>
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0)" }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-display font-light tracking-tight leading-[0.95] mb-8 text-foreground"
          >
            Nosso<br />
            <span className="text-gradient-nexa font-bold">Substrato.</span>
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-8 max-w-sm"
          >
            <p className="text-muted-foreground text-lg font-display font-light leading-relaxed">
              Não construímos apenas automações — arquitetamos ecossistemas digitais de alta performance. Um stack curado com as melhores tecnologias garante escalabilidade desde o dia um.
            </p>

            {/* Features */}
            <div className="flex flex-col gap-4">
              {[
                { icon: <Cpu size={18} />, title: "Arquitetura Modular", sub: "React / N8N / Make" },
                { icon: <img src={supabaseIcon} alt="Supabase" className="w-[18px] h-[18px]" />, title: "Dados em Tempo Real", sub: "Supabase / Postgres" },
                { icon: <img src={chatgptIcon} alt="OpenAI" className="w-[18px] h-[18px]" />, title: "IA Integrada", sub: "OpenAI / LangChain" },
              ].map((f) => (
                <div key={f.title} className="group flex items-center gap-4 cursor-default">
                  <div className="w-10 h-10 rounded-xl border border-white/[0.08] bg-primary/[0.06] flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/[0.1] group-hover:border-primary/20 transition-all duration-200">
                    {f.icon}
                  </div>
                  <div>
                    <div className="text-sm font-display font-semibold text-foreground">{f.title}</div>
                    <div className="text-[10px] font-display text-muted-foreground uppercase tracking-wider">{f.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="pt-4">
              <a
                href="#diagnostico"
                className="inline-flex items-center px-6 py-2.5 rounded-full border border-white/10 text-sm font-display font-medium text-foreground hover:border-primary/30 hover:bg-primary/[0.06] transition-all duration-200"
              >
                Explorar Stack Completo
              </a>
            </div>
          </motion.div>
        </div>

        {/* RIGHT — 3D animated wall */}
        <div className="absolute right-[-10%] md:right-[-5%] top-[-10%] bottom-[-10%] w-[120%] md:w-[65%] tech-wall-container overflow-hidden">
          <div className="tech-wall-grid h-full w-full flex gap-5 px-8">
            <WallColumn cards={col1Cards} direction="up" />
            <WallColumn cards={col2Cards} direction="down" className="pt-12" />
            <WallColumn cards={col3Cards} direction="up" className="pt-24 hidden lg:flex" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default TechWallSection;
