import { motion } from "framer-motion";
import { Cpu, Database, Brain } from "lucide-react";

import chatgptIcon from "@/assets/tech/chatgpt.png";
import n8nIcon from "@/assets/tech/n8n.png";
import evolutionIcon from "@/assets/tech/evolution.png";
import supabaseIcon from "@/assets/tech/supabase.png";
import googleIcon from "@/assets/tech/google.png";
import geminiIcon from "@/assets/tech/gemini.png";
import postgresIcon from "@/assets/tech/postgres.png";
import redisIcon from "@/assets/tech/redis.png";
import githubIcon from "@/assets/tech/github.png";

interface TechCard {
  icon: string;
  name: string;
  category: string;
}

const col1Cards: TechCard[] = [
  { icon: chatgptIcon, name: "ChatGPT", category: "Intelligence" },
  { icon: n8nIcon, name: "N8N", category: "Automation" },
  { icon: evolutionIcon, name: "Evolution", category: "Messaging" },
  { icon: supabaseIcon, name: "Supabase", category: "Database" },
];

const col2Cards: TechCard[] = [
  { icon: googleIcon, name: "Google", category: "Cloud" },
  { icon: geminiIcon, name: "Gemini", category: "AI Model" },
  { icon: postgresIcon, name: "PostgreSQL", category: "Database" },
  { icon: redisIcon, name: "Redis", category: "Cache" },
];

const col3Cards: TechCard[] = [
  { icon: githubIcon, name: "GitHub", category: "VCS" },
  { icon: chatgptIcon, name: "OpenAI", category: "AI Framework" },
  { icon: n8nIcon, name: "N8N", category: "Workflows" },
  { icon: supabaseIcon, name: "Supabase", category: "Backend" },
];

const WallCard = ({ card }: { card: TechCard }) => (
  <div className="tech-wall-card rounded-2xl p-5 aspect-[4/3] flex flex-col justify-between">
    <div className="flex justify-between items-start">
      <img src={card.icon} alt={card.name} className="w-7 h-7 object-contain" />
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
    <section className="relative py-24 lg:py-0 overflow-hidden bg-background">
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/[0.06] blur-[120px] rounded-full pointer-events-none z-0" />

      <div className="container mx-auto relative z-10 flex flex-col md:flex-row min-h-[700px] lg:min-h-[800px]">
        {/* LEFT — Content */}
        <div className="w-full md:w-[42%] px-4 py-16 md:py-28 flex flex-col justify-center relative z-20">
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

            <div className="flex flex-col gap-4">
              {[
                { icon: <Cpu size={18} />, title: "Arquitetura Modular", sub: "React / N8N / Make" },
                { icon: <Database size={18} />, title: "Dados em Tempo Real", sub: "Supabase / Postgres" },
                { icon: <Brain size={18} />, title: "IA Integrada", sub: "OpenAI / LangChain" },
              ].map((f) => (
                <div key={f.title} className="group flex items-center gap-4 cursor-default">
                  <div className="w-10 h-10 rounded-xl border border-border bg-primary/[0.03] flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/[0.06] group-hover:border-primary/20 transition-all duration-200">
                    {f.icon}
                  </div>
                  <div>
                    <div className="text-sm font-display font-semibold text-foreground">{f.title}</div>
                    <div className="text-[10px] font-display text-muted-foreground uppercase tracking-wider">{f.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4">
              <a
                href="#diagnostico"
                className="inline-flex items-center px-6 py-2.5 rounded-full border border-border text-sm font-display font-medium text-foreground hover:border-primary/30 hover:bg-primary/[0.03] transition-all duration-200"
              >
                Explorar Stack Completo
              </a>
            </div>
          </motion.div>
        </div>

        {/* RIGHT — 3D animated wall */}
        <div className="absolute right-[-10%] md:right-[-5%] top-[-10%] bottom-[-10%] w-[120%] md:w-[65%] tech-wall-container overflow-hidden pointer-events-none">
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
