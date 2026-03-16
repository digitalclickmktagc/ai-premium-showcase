import { motion } from "framer-motion";
import { Quote } from "lucide-react";

const testimonials = [
  {
    quote: "A Nexa AI transformou completamente nosso processo de vendas. Automatizamos 80% das tarefas manuais e dobramos o faturamento em 6 meses.",
    name: "Carlos Mendes",
    role: "CEO, TechScale",
  },
  {
    quote: "O CRM personalizado e os agentes de IA revolucionaram nosso atendimento. Hoje respondemos em segundos, não em horas.",
    name: "Ana Oliveira",
    role: "Diretora Comercial, InnovaGroup",
  },
  {
    quote: "Precisávamos escalar sem perder qualidade. A Nexa AI entregou exatamente isso com uma solução sob medida para nosso segmento.",
    name: "Rafael Torres",
    role: "Fundador, Vertix Digital",
  },
];

const TestimonialsSection = () => {
  return (
    <section id="depoimentos" className="py-24 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium tracking-[0.3em] uppercase text-gradient-nexa mb-4">
            Depoimentos
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Quem <span className="text-gradient-nexa">confia.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="glass-card rounded-2xl p-8"
            >
              <Quote size={28} className="text-primary/40 mb-4" />
              <p className="text-muted-foreground font-body leading-relaxed mb-6">
                "{t.quote}"
              </p>
              <div>
                <p className="font-display font-bold text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
