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

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: "var(--radius-md)",
    color: "#f0f0f0",
    padding: "0.875rem 1rem",
    fontSize: "0.95rem",
    transition: "all 0.25s ease",
    outline: "none",
    width: "100%",
  };

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
              background: "rgba(147,51,234,0.12)",
              border: "1px solid rgba(147,51,234,0.30)",
            }}
          >
            <Sparkles size={13} style={{ color: "#A855F7" }} />
            <span className="text-xs font-medium tracking-wide" style={{ color: "#C084FC" }}>
              Diagnóstico Gratuito
            </span>
          </div>

          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-foreground">
            Pronto para <span className="text-gradient-nexa font-bold">escalar?</span>
          </h2>
          <p className="mt-4 text-sm max-w-lg mx-auto font-body" style={{ color: "rgba(240,240,240,0.55)" }}>
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
            className="p-8 sm:p-10"
            style={{
              background: "rgba(10,10,10,0.80)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "var(--radius-xl)",
              backdropFilter: "blur(40px)",
              boxShadow: `
                0 0 0 1px rgba(255,255,255,0.03),
                0 40px 100px rgba(0,0,0,0.60),
                inset 0 1px 0 rgba(255,255,255,0.05)
              `,
            }}
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
                    <label
                      className="block mb-1.5 font-body"
                      style={{
                        color: "rgba(240,240,240,0.55)",
                        fontSize: "0.8rem",
                        letterSpacing: "0.06em",
                        fontWeight: 500,
                      }}
                    >
                      {label}
                    </label>
                    <input
                      type={type}
                      name={name}
                      placeholder={placeholder}
                      value={form[name as keyof typeof form]}
                      onChange={handleChange}
                      required
                      style={inputStyle}
                      onFocus={(e) => {
                        e.currentTarget.style.background = "rgba(147,51,234,0.06)";
                        e.currentTarget.style.borderColor = "rgba(147,51,234,0.50)";
                        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(147,51,234,0.15), 0 0 20px rgba(147,51,234,0.10)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    />
                  </div>
                ))}
                <div>
                  <label
                    className="block mb-1.5 font-body"
                    style={{
                      color: "rgba(240,240,240,0.55)",
                      fontSize: "0.8rem",
                      letterSpacing: "0.06em",
                      fontWeight: 500,
                    }}
                  >
                    Faturamento mensal
                  </label>
                  <select
                    name="faturamento"
                    value={form.faturamento}
                    onChange={handleChange}
                    required
                    style={inputStyle}
                    onFocus={(e) => {
                      e.currentTarget.style.background = "rgba(147,51,234,0.06)";
                      e.currentTarget.style.borderColor = "rgba(147,51,234,0.50)";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(147,51,234,0.15), 0 0 20px rgba(147,51,234,0.10)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
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
                  className="w-full text-white text-[0.9rem] tracking-[0.08em] uppercase font-bold py-4 h-auto"
                  style={{
                    borderRadius: "var(--radius-md)",
                    padding: "1rem 2rem",
                  }}
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

              <p className="flex items-center justify-center gap-1.5 pt-1" style={{ color: "rgba(240,240,240,0.30)", fontSize: "0.75rem" }}>
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
