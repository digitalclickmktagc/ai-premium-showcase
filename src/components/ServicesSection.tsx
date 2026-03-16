import { motion } from "framer-motion";
import { Settings, Bot, Users, TrendingUp } from "lucide-react";

const services = [
  {
    num: "01",
    icon: Settings,
    title: "Fluxos Autônomos",
    desc: "Processos que rodam sozinhos. Sem gargalos, sem intervenção.",
    badge: "−60% custos operacionais",
  },
  {
    num: "02",
    icon: Bot,
    title: "Agentes Inteligentes",
    desc: "IA que atende, qualifica e converte. 24/7, sem pausas.",
    badge: "Atendimento contínuo",
  },
  {
    num: "03",
    icon: Users,
    title: "Gestão Preditiva",
    desc: "Antecipe decisões. Dados em tempo real para ações certeiras.",
    badge: "+35% conversão",
  },
  {
    num: "04",
    icon: TrendingUp,
    title: "Escala Exponencial",
    desc: "Crescimento sustentável. Processos, tecnologia e estratégia alinhados.",
    badge: "Crescimento real",
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
          <p className="text-sm font-medium tracking-[0.3em] uppercase text-gradient-nexa mb-4">
            Soluções
          </p>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
              Resultados.{" "}
              <span className="text-gradient-nexa">Não promessas.</span>
            </h2>
          </div>
        </motion.div>

        <div className="flex flex-col gap-4">
          {services.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="glass-card rounded-2xl p-6 lg:p-8 group flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex items-center gap-4 sm:min-w-[200px]">
                <span className="text-3xl font-display font-extrabold text-muted-foreground/20">
                  {s.num}
                </span>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <s.icon size={20} className="text-primary" />
                </div>
                <h3 className="font-display text-lg font-bold">{s.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground font-body flex-1">{s.desc}</p>
              <span className="inline-block text-xs font-medium px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 whitespace-nowrap self-start sm:self-center">
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
