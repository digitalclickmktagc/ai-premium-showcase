import { motion } from "framer-motion";
import { Zap, Clock, Crosshair } from "lucide-react";

const benefits = [
  {
    icon: Zap,
    title: "Escalabilidade",
    desc: "Cresce com você. Sem gargalos, sem teto.",
  },
  {
    icon: Clock,
    title: "Tempo Devolvido",
    desc: "Operacional no automático. Equipe no estratégico.",
  },
  {
    icon: Crosshair,
    title: "Precisão Cirúrgica",
    desc: "Dados reais. Decisões certeiras. Zero achismo.",
  },
];

const BenefitsSection = () => {
  return (
    <section id="diferenciais" className="py-24 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium tracking-widest uppercase text-gradient-nexa mb-4">
            Por que a NEXA.IA?
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold">
            Transformamos <span className="text-gradient-nexa">complexidade</span>
            <br />
            em crescimento real.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.15 }}
              className="text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-6 border border-primary/20">
                <b.icon size={24} className="text-primary" />
              </div>
              <h3 className="font-display text-xl font-bold mb-3">{b.title}</h3>
              <p className="text-muted-foreground font-body leading-relaxed">{b.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-24 grid grid-cols-3 gap-8 text-center"
        >
          {[
            { value: "50+", label: "EMPRESAS ATENDIDAS" },
            { value: "1.5M+", label: "FATURAMENTO GERADO" },
            { value: "40%", label: "REDUÇÃO DE CUSTOS" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="font-display text-3xl md:text-5xl font-extrabold mb-2">{stat.value}</p>
              <p className="text-xs md:text-sm tracking-widest text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default BenefitsSection;
