import { motion } from "framer-motion";
import { Settings, Bot, Users, TrendingUp, ChevronRight, Activity } from "lucide-react";
import { useState } from "react";
import { useCardGlow } from "@/hooks/use-card-glow";

const services = [
  {
    num: "01",
    icon: TrendingUp,
    title: "Escala Exponencial",
    desc: "Crescimento sustentável. Processos, tecnologia e estratégia alinhados.",
    badge: "Crescimento real",
    metric: "∞",
    metricLabel: "Potencial",
    detail: "Infraestrutura de crescimento que se adapta ao seu ritmo. Escale sem dores de cabeça operacionais.",
  },
  {
    num: "02",
    icon: Settings,
    title: "Fluxos Autônomos",
    desc: "Processos que rodam sozinhos. Sem gargalos, sem intervenção.",
    badge: "−60% custos operacionais",
    metric: "−60%",
    metricLabel: "Custos",
    detail: "Automatize fluxos complexos de ponta a ponta. Tarefas manuais se tornam máquinas de eficiência que operam 24/7 sem supervisão.",
  },
  {
    num: "03",
    icon: Bot,
    title: "Agentes Inteligentes",
    desc: "IA que atende, qualifica e converte. 24/7, sem pausas.",
    badge: "Atendimento contínuo",
    metric: "24/7",
    metricLabel: "Disponível",
    detail: "Agentes de IA que entendem contexto, qualificam leads e fecham vendas enquanto sua equipe dorme.",
  },
  {
    num: "04",
    icon: Users,
    title: "Gestão Preditiva",
    desc: "Antecipe decisões. Dados em tempo real para ações certeiras.",
    badge: "+35% conversão",
    metric: "+35%",
    metricLabel: "Conversão",
    detail: "Dashboards inteligentes que transformam ruído em sinal. Tome decisões antes que os problemas apareçam.",
  },
];

const ServicesSection = () => {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = services[activeIdx];
  const ActiveIcon = active.icon;
  const { handleMouseMove } = useCardGlow();

  return (
    <section id="solucoes" className="py-16 lg:py-20">
      <div className="container mx-auto px-4 lg:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <p className="text-[0.7rem] font-semibold tracking-[0.20em] uppercase mb-4" style={{ color: "#A855F7" }}>
            Soluções
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-light leading-tight tracking-tight text-foreground">
            Resultados.{" "}
            <span className="text-gradient-nexa font-bold">Não promessas.</span>
          </h2>
        </motion.div>

        {/* App dashboard panel */}
        <motion.div
          initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="glass-card overflow-hidden rounded-[24px]"
          onMouseMove={handleMouseMove}
        >
          {/* Top bar (macOS style) */}
          <div
            className="flex flex-col gap-3 px-4 py-3 sm:px-5 sm:py-3.5"
            style={{
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                <div className="w-3 h-3 rounded-full bg-[#28C840]" />
              </div>
              <div className="ml-0 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] sm:ml-3 sm:text-xs"
                style={{ color: "rgba(240,240,240,0.35)" }}>
                <span>Nexa</span>
                <ChevronRight size={10} />
                <span>Soluções</span>
                <ChevronRight size={10} />
                <span style={{ color: "rgba(240,240,240,0.70)" }} className="font-medium break-words">{active.title}</span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-col md:flex-row">

            {/* Sidebar nav */}
            <div
              className="border-b p-3 md:w-56 md:border-b-0 md:border-r lg:w-64"
              style={{
                borderColor: "rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <p
                className="text-[10px] font-semibold tracking-[0.2em] uppercase px-3 pt-2 pb-3"
                style={{ color: "rgba(240,240,240,0.30)" }}
              >
                Módulos
              </p>
              {services.map((s, i) => {
                const Icon = s.icon;
                const isActive = i === activeIdx;
                return (
                  <button
                    key={s.num}
                    onClick={() => setActiveIdx(i)}
                    className={`group mb-1 flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200 ${
                      isActive ? "" : "hover:bg-white/[0.04] border border-transparent"
                    }`}
                    style={isActive ? {
                      background: "rgba(147,51,234,0.12)",
                      border: "1px solid rgba(147,51,234,0.25)",
                    } : {}}
                  >
                    <div
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors"
                      style={isActive ? {
                        background: "rgba(147,51,234,0.2)",
                      } : {
                        background: "rgba(255,255,255,0.05)",
                      }}
                    >
                      <Icon
                        size={14}
                        style={{ color: isActive ? "#9333ea" : "rgba(240,240,240,0.40)" }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-xs font-medium leading-tight transition-colors sm:truncate"
                        style={{ color: isActive ? "rgba(240,240,240,0.90)" : "rgba(240,240,240,0.50)" }}
                      >
                        {s.title}
                      </p>
                      <p className="text-[10px] leading-tight sm:truncate" style={{ color: "rgba(240,240,240,0.30)" }}>
                        {s.badge}
                      </p>
                    </div>
                    {isActive && <ChevronRight size={12} className="text-primary ml-auto flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Main content */}
            <div className="flex flex-1 items-center p-5 sm:p-6 lg:p-8">
              <motion.div
                key={activeIdx}
                initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="w-full"
              >
                {/* Content with metric on right */}
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
                  <div className="min-w-0 flex-1">
                    <div className="mb-4 flex items-center gap-4">
                      <div
                        className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl"
                        style={{
                          background: "rgba(147,51,234,0.12)",
                          border: "1px solid rgba(147,51,234,0.2)",
                        }}
                      >
                        <ActiveIcon size={26} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1">
                          <h3 className="font-display text-xl font-bold text-foreground sm:text-2xl">{active.title}</h3>
                        </div>
                        <p className="font-body text-sm text-muted-foreground sm:text-base">{active.desc}</p>
                      </div>
                    </div>
                    <p className="max-w-xl font-body text-sm leading-relaxed text-muted-foreground sm:text-base">
                      {active.detail}
                    </p>
                  </div>
                  <div
                    className="relative w-full flex-shrink-0 overflow-hidden rounded-2xl p-5 sm:w-auto sm:min-w-[220px] sm:p-6 lg:max-w-[260px]"
                    style={{
                      background: "rgba(107,33,168,0.08)",
                      border: "1px solid rgba(147,51,234,0.18)",
                    }}
                  >
                    <div
                      className="absolute top-0 right-0 w-20 h-20 rounded-full pointer-events-none"
                      style={{ background: "rgba(147,51,234,0.12)", filter: "blur(24px)" }}
                    />
                    <p className="text-[0.7rem] tracking-[0.15em] uppercase mb-2"
                      style={{ color: "rgba(240,240,240,0.40)" }}>
                      {active.metricLabel}
                    </p>
                    <p
                      className="font-display animate-pulse-glow text-5xl font-extrabold leading-none"
                      style={{
                        background: "var(--gradient-nexa)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                      }}
                    >
                      {active.metric}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ServicesSection;
