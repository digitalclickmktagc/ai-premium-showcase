import { useState } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

const faturamentoOptions = [
  "Até R$ 50k",
  "R$ 50k - R$ 100k",
  "R$ 100k - R$ 500k",
  "Mais de R$ 500k",
];

const LeadFormSection = () => {
  const [form, setForm] = useState({
    nome: "",
    email: "",
    whatsapp: "",
    empresa: "",
    segmento: "",
    faturamento: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = encodeURIComponent(
      `Olá! Gostaria de um diagnóstico gratuito.\n\nNome: ${form.nome}\nE-mail: ${form.email}\nWhatsApp: ${form.whatsapp}\nEmpresa: ${form.empresa}\nSegmento: ${form.segmento}\nFaturamento: ${form.faturamento}`
    );
    window.open(`https://wa.me/+5516998935289?text=${message}`, "_blank");
  };

  const inputClasses =
    "w-full px-4 py-3 rounded-xl bg-muted/40 border border-border text-foreground font-body text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all";

  return (
    <section id="diagnostico" className="py-24 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Pronto para <span className="text-gradient-nexa">escalar?</span>
          </h2>
          <p className="mt-4 text-muted-foreground font-body text-base max-w-lg mx-auto">
            Preencha os dados abaixo e receba um diagnóstico da nossa IA.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-2xl mx-auto"
        >
          <div className="glass-card rounded-2xl p-8 sm:p-10">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 font-body">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    name="nome"
                    placeholder="Seu nome"
                    value={form.nome}
                    onChange={handleChange}
                    required
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 font-body">
                    E-mail corporativo
                  </label>
                  <input
                    type="email"
                    name="email"
                    placeholder="seu@email.com"
                    value={form.email}
                    onChange={handleChange}
                    required
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 font-body">
                    WhatsApp
                  </label>
                  <input
                    type="tel"
                    name="whatsapp"
                    placeholder="(00) 00000-0000"
                    value={form.whatsapp}
                    onChange={handleChange}
                    required
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 font-body">
                    Nome da Empresa
                  </label>
                  <input
                    type="text"
                    name="empresa"
                    placeholder="Ex: Atech Solutions"
                    value={form.empresa}
                    onChange={handleChange}
                    required
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 font-body">
                    Segmento
                  </label>
                  <input
                    type="text"
                    name="segmento"
                    placeholder="Ex: Tecnologia, Varejo..."
                    value={form.segmento}
                    onChange={handleChange}
                    required
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 font-body">
                    Faturamento mensal
                  </label>
                  <select
                    name="faturamento"
                    value={form.faturamento}
                    onChange={handleChange}
                    required
                    className={inputClasses}
                  >
                    <option value="" disabled>
                      Selecione...
                    </option>
                    {faturamentoOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Button
                type="submit"
                variant="glow"
                size="lg"
                className="w-full text-primary-foreground text-sm tracking-widest uppercase font-extrabold py-4 h-auto"
              >
                Solicitar Diagnóstico Gratuito
                <Send size={16} />
              </Button>
            </form>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default LeadFormSection;
