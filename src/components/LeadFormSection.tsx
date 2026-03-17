import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const WEBHOOK_URL = "https://infrasynaiadvanced-n8n.cloudfy.live/webhook/49662b45-e787-451f-af90-248998c29c4d";
const faturamentoOptions = ["Até R$ 50k", "R$ 50k - R$ 100k", "R$ 100k - R$ 500k", "Mais de R$ 500k"];

const LeadFormSection = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    whatsapp: "",
    empresa: "",
    segmento: "",
    faturamento: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "whatsapp") {
      const digits = value.replace(/\D/g, "").slice(0, 13);
      let masked = "";
      if (digits.length > 0) masked += "+" + digits.slice(0, 2);
      if (digits.length > 2) masked += " (" + digits.slice(2, 4);
      if (digits.length > 4) masked += ") " + digits.slice(4, 9);
      if (digits.length > 9) masked += "-" + digits.slice(9, 13);
      setForm({ ...form, whatsapp: masked });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = { ...form, whatsapp: form.whatsapp.replace(/\D/g, "") };
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Erro ao enviar");
      toast({
        title: "Formulário Preenchido!",
        description: "Nossa equipe entrará em contato.",
      });
      setForm({ nome: "", email: "", whatsapp: "", empresa: "", segmento: "", faturamento: "" });
    } catch {
      toast({
        title: "Erro ao enviar",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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
            <span className="hidden sm:inline">Preencha os dados abaixo e escale o seu atendimento.</span>
            <span className="sm:hidden">Preencha os dados abaixo<br />e escale o seu atendimento.</span>
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
                  <label className="block text-xs font-medium text-foreground mb-1.5 font-body">Nome completo</label>
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
                  <label className="block text-xs font-medium text-foreground mb-1.5 font-body">WhatsApp</label>
                  <input
                    type="tel"
                    name="whatsapp"
                    placeholder="+55 (00) 00000-0000"
                    value={form.whatsapp}
                    onChange={handleChange}
                    required
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 font-body">Nome da Empresa</label>
                  <input
                    type="text"
                    name="empresa"
                    placeholder="Ex: Nexa AI"
                    value={form.empresa}
                    onChange={handleChange}
                    required
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5 font-body">Segmento</label>
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
                disabled={isSubmitting}
                className="w-full text-primary-foreground text-[10px] sm:text-sm tracking-widest uppercase font-extrabold py-4 h-auto"
              >
                {isSubmitting ? (
                  <>
                    Enviando...
                    <Loader2 size={16} className="animate-spin" />
                  </>
                ) : (
                  <>
                    Escalar Meu Atendimento.
                    <Send size={16} />
                  </>
                )}
              </Button>
            </form>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default LeadFormSection;
