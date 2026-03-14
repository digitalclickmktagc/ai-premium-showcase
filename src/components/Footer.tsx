import { Linkedin, Instagram, MessageCircle, Mail, Phone, MapPin } from "lucide-react";

const Footer = () => {
  return (
    <footer id="contato" className="border-t border-border/50 pt-16 pb-8 bg-card">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid md:grid-cols-3 gap-12 mb-12">
          <div>
            <h3 className="font-display text-xl font-extrabold mb-4 text-foreground">
              NEXA<span className="text-gradient-nexa">.IA</span>
            </h3>
            <p className="text-sm text-muted-foreground font-body leading-relaxed mb-4">
              Automação inteligente para empresas que querem crescer sem dor de cabeça.
            </p>
            <p className="text-xs text-muted-foreground italic">"O futuro pensa em você."</p>
          </div>

          <div>
            <h4 className="font-display font-bold text-sm tracking-widest uppercase mb-4 text-foreground">Contato</h4>
            <ul className="space-y-3 text-sm text-muted-foreground font-body">
              <li className="flex items-center gap-2">
                <Mail size={14} className="text-primary" /> contato@nexaia.com.br
              </li>
              <li className="flex items-center gap-2">
                <Phone size={14} className="text-primary" /> (61) 99936-1312
              </li>
              <li className="flex items-center gap-2">
                <MapPin size={14} className="text-primary" /> Brasília, Brasil
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-sm tracking-widest uppercase mb-4 text-foreground">Redes Sociais</h4>
            <div className="flex gap-3">
              {[Linkedin, Instagram, MessageCircle].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-10 h-10 rounded-lg border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border/50 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © 2026 NEXA.IA. Todos os direitos reservados.
          </p>
          <div className="flex gap-6 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacidade</a>
            <a href="#" className="hover:text-foreground transition-colors">Termos</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
