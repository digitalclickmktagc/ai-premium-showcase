import { motion } from "framer-motion";
import { Settings, Bot, Users, TrendingUp, ChevronRight, Activity } from "lucide-react";
import { useState } from "react";

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

  return (
    <section id="solucoes" className="py-24 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <p className="text-sm font-medium tracking-[0.3em] uppercase text-gradient-nexa mb-4">
            Soluções
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-light leading-tight tracking-tight text-foreground">
            Resultados.{" "}
            <span className="text-gradient-nexa">Não promessas.</span>
          </h2>
        </motion.div>

        {/* App dashboard panel */}
        <motion.div
          initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="rounded-[24px] overflow-hidden"
          style={{
            background: "#ffffff",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: `
              0 1px 2px rgba(0,0,0,0.03),
              0 4px 16px rgba(0,0,0,0.06),
              0 16px 64px rgba(0,0,0,0.05)
            `,
          }}
        >
          {/* Top bar (macOS style) */}
          <div
            className="flex items-center justify-between px-5 py-3.5"
            style={{
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              background: "rgba(0,0,0,0.015)",
            }}
          >
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                <div className="w-3 h-3 rounded-full bg-[#28C840]" />
              </div>
              <div className="flex items-center gap-1.5 ml-3 text-xs"
                style={{ color: "rgba(0,0,0,0.35)" }}>
                <span>Nexa</span>
                <ChevronRight size={10} />
                <span>Soluções</span>
                <ChevronRight size={10} />
                <span style={{ color: "rgba(0,0,0,0.6)" }} className="font-medium">{active.title}</span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-col md:flex-row">

            {/* Sidebar nav */}
            <div
              className="md:w-56 lg:w-64 border-b md:border-b-0 md:border-r p-3"
              style={{
                borderColor: "rgba(0,0,0,0.06)",
                background: "rgba(0,0,0,0.015)",
              }}
            >
              <p
                className="text-[10px] font-semibold tracking-[0.2em] uppercase px-3 pt-2 pb-3"
                style={{ color: "rgba(0,0,0,0.3)" }}
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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-left transition-all duration-200 group ${
                      isActive ? "" : "hover:bg-black/[0.03] border border-transparent"
                    }`}
                    style={isActive ? {
                      background: "rgba(147,51,234,0.07)",
                      border: "1px solid rgba(147,51,234,0.15)",
                    } : {}}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors`}
                      style={isActive ? {
                        background: "rgba(147,51,234,0.15)",
                      } : {
                        background: "rgba(0,0,0,0.05)",
                      }}
                    >
                      <Icon
                        size={14}
                        style={{ color: isActive ? "#9333ea" : "rgba(0,0,0,0.4)" }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-medium truncate transition-colors`}
                        style={{ color: isActive ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.5)" }}
                      >
                        {s.title}
                      </p>
                      <p className="text-[10px] truncate" style={{ color: "rgba(0,0,0,0.3)" }}>
                        {s.badge}
                      </p>
                    </div>
                    {isActive && <ChevronRight size={12} className="text-primary ml-auto flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Main content */}
            <div className="flex-1 p-6 lg:p-8 bg-white">
              <motion.div
                key={activeIdx}
                initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                {/* Service header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{
                        background: "rgba(147,51,234,0.07)",
                        border: "1px solid rgba(147,51,234,0.15)",
                      }}
                    >
                      <ActiveIcon size={22} className="text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-primary/40">{active.num}</span>
                        <h3 className="font-display text-xl font-bold text-foreground">{active.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground font-body">{active.desc}</p>
                    </div>
                  </div>
                  <span
                    className="hidden sm:inline-flex text-[11px] font-semibold px-3 py-1.5 rounded-full flex-shrink-0 ml-4"
                    style={{
                      background: "rgba(147,51,234,0.07)",
                      color: "#7c3aed",
                      border: "1px solid rgba(147,51,234,0.15)",
                    }}
                  >
                    {active.badge}
                  </span>
                </div>

                {/* Detail text */}
                <p className="text-sm text-muted-foreground font-body leading-relaxed mb-8 max-w-lg">
                  {active.detail}
                </p>

                {/* Metric cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Primary metric */}
                  <div
                    className="col-span-2 p-5 rounded-2xl relative overflow-hidden"
                    style={{
                      background: "rgba(147,51,234,0.04)",
                      border: "1px solid rgba(147,51,234,0.12)",
                    }}
                  >
                    <div
                      className="absolute top-0 right-0 w-20 h-20 rounded-full pointer-events-none"
                      style={{ background: "rgba(147,51,234,0.08)", filter: "blur(24px)" }}
                    />
                    <p className="text-[10px] tracking-[0.15em] uppercase mb-2"
                      style={{ color: "rgba(0,0,0,0.35)" }}>
                      {active.metricLabel}
                    </p>
                    <p
                      className="font-display text-4xl font-bold leading-none"
                      style={{
                        background: "linear-gradient(135deg, #7C3AED, #9333EA, #A855F7)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                      }}
                    >
                      {active.metric}
                    </p>
                  </div>

                  {/* Status */}
                  <div
                    className="p-4 rounded-2xl"
                    style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.06)" }}
                  >
                    <Activity size={14} className="text-primary/60 mb-3" />
                    <p className="text-[10px] mb-1" style={{ color: "rgba(0,0,0,0.35)" }}>Status</p>
                    <p className="text-sm font-semibold text-foreground">Ativo</p>
                  </div>

                  {/* Tipo */}
                  <div
                    className="p-4 rounded-2xl"
                    style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.06)" }}
                  >
                    <div className="w-3 h-3 rounded-full bg-primary/60 mb-3" />
                    <p className="text-[10px] mb-1" style={{ color: "rgba(0,0,0,0.35)" }}>Tipo</p>
                    <p className="text-sm font-semibold text-foreground">Custom</p>
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
