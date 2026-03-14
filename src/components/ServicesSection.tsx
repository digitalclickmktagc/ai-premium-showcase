import { motion } from "framer-motion";
import { Settings, Bot, Users, Globe, TrendingUp, Target } from "lucide-react";

const services = [
  {
    num: "01",
    icon: Settings,
    title: "Automação de Processos",
    desc: "Elimine tarefas repetitivas e ganhe até 40 horas semanais. Fluxos inteligentes 24/7.",
    badge: "Reduza custos em até 60%",
  },
  {
    num: "02",
    icon: Bot,
    title: "Agentes de IA",
    desc: "Assistentes virtuais que atendem, qualificam e vendem por você. Disponíveis 24 horas.",
    badge: "Atendimento 24/7",
  },
  {
    num: "03",
    icon: Users,
    title: "CRM Personalizado",
    desc: "Sistema sob medida para seu negócio. Gestão completa de leads, vendas e relacionamento.",
    badge: "Aumente conversões em 35%",
  },
  {
    num: "04",
    icon: Globe,
    title: "Criação de Sites",
    desc: "Websites otimizados para resultados. Design premium, velocidade e experiência.",
    badge: "Até 5x mais leads",
  },
  {
    num: "05",
    icon: Target,
    title: "Tráfego Pago Estratégico",
    desc: "Campanhas Google, Meta e LinkedIn com ROI garantido. Dados e otimização constante.",
    badge: "ROAS médio de 4.2x",
  },
  {
    num: "06",
    icon: TrendingUp,
    title: "Escala de Faturamento",
    desc: "Estratégia completa de crescimento. Processos, pessoas e tecnologia alinhados.",
    badge: "Crescimento sustentável",
  },
];

const ServicesSection = () => {
  return (
    <section id="solucoes" className="py-24 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <p className="text-sm font-medium tracking-widest uppercase text-gradient-nexa mb-4">
            Serviços
          </p>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight">
              Soluções que{" "}
              <span className="text-gradient-nexa">transformam</span>
              <br />
              resultados
            </h2>
            <p className="text-muted-foreground max-w-md font-body">
              Cada serviço é projetado para resolver dores específicas e gerar impacto direto no seu faturamento.
            </p>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="glass-card rounded-2xl p-6 lg:p-8 group"
            >
              <div className="flex items-start gap-4 mb-4">
                <span className="text-3xl font-display font-extrabold text-muted-foreground/20">
                  {s.num}
                </span>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <s.icon size={20} className="text-primary" />
                </div>
              </div>
              <h3 className="font-display text-lg font-bold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground mb-4 font-body">{s.desc}</p>
              <span className="inline-block text-xs font-medium px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {s.badge}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
