import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Loader2, Shield, Sparkles } from "lucide-react";
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
      const digits = value.replace(/\D/g, "").slice(0, 11);
      let masked = "";
      if (digits.length > 0) masked += "(" + digits.slice(0, 2);
      if (digits.length > 2) masked += ") " + digits.slice(2, 7);
      if (digits.length > 7) masked += "-" + digits.slice(7, 11);
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
    "w-full px-4 py-3.5 rounded-xl bg-white/[0.06] border text-foreground font-body text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-200"
    + " border-white/[0.08]";

  return (
    <section
      id="diagnostico"
      className="py-24 lg:py-32 relative overflow-hidden"
    >
      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
            style={{
              background: "rgba(147,51,234,0.1)",
              border: "1px solid rgba(147,51,234,0.2)",
            }}
          >
            <Sparkles size={13} className="text-primary" />
            <span className="text-xs font-medium tracking-wide text-primary">
              Diagnóstico Gratuito
            </span>
          </div>

          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-foreground">
            Pronto para <span className="text-gradient-nexa font-bold">escalar?</span>
          </h2>
          <p className="mt-4 text-sm max-w-lg mx-auto font-body text-muted-foreground">
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
          <div
            className="glass-card rounded-3xl p-8 sm:p-10"
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[
                  { label: "Nome completo", name: "nome", type: "text", placeholder: "Seu nome" },
                  { label: "E-mail corporativo", name: "email", type: "email", placeholder: "seu@email.com" },
                  { label: "WhatsApp", name: "whatsapp", type: "tel", placeholder: "(00) 00000-0000" },
                  { label: "Nome da Empresa", name: "empresa", type: "text", placeholder: "Ex: Nexa AI" },
                  { label: "Segmento", name: "segmento", type: "text", placeholder: "Ex: Tecnologia, Varejo..." },
                ].map(({ label, name, type, placeholder }) => (
                  <div key={name}>
                    <label className="block text-xs font-semibold text-foreground/70 mb-2 font-body tracking-wide">
                      {label}
                    </label>
                    <input
                      type={type}
                      name={name}
                      placeholder={placeholder}
                      value={form[name as keyof typeof form]}
                      onChange={handleChange}
                      required
                      className={inputClasses}
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-foreground/70 mb-2 font-body tracking-wide">
                    Faturamento mensal
                  </label>
                  <select
                    name="faturamento"
                    value={form.faturamento}
                    onChange={handleChange}
                    required
                    className={inputClasses}
                  >
                    <option value="" disabled>Selecione...</option>
                    {faturamentoOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="glow"
                  size="lg"
                  disabled={isSubmitting}
                  className="w-full text-primary-foreground text-[10px] sm:text-sm tracking-widest uppercase font-extrabold py-4 h-auto cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      Enviando...
                      <Loader2 size={16} className="animate-spin" />
                    </>
                  ) : (
                    <>
                      Escalar Meu Atendimento
                      <Send size={16} />
                    </>
                  )}
                </Button>
              </div>

              <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/50 pt-1">
                <Shield size={12} />
                Seus dados estão seguros e protegidos.
              </p>
            </form>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default LeadFormSection;
