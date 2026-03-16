import { Instagram, MessageCircle, Mail, Phone, MapPin } from "lucide-react";
import nexaLogo from "@/assets/nexa-logo-new.png";

const Footer = () => {
  return (
    <footer id="contato" className="pt-16 pb-8 bg-card">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex flex-col items-center text-center mb-12 space-y-10">
          <div>
            <a href="#" className="flex items-center gap-2.5 justify-center mb-4">
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md">
                <img src={nexaLogo} alt="Nexa AI" className="w-full h-full object-cover" />
              </div>
              <span className="font-display text-xl font-extrabold tracking-tight text-foreground">
                Nexa <span className="text-gradient-nexa">AI</span>
              </span>
            </a>
          </div>

          <div>
            <h4 className="font-display font-bold text-sm tracking-widest uppercase mb-4 text-foreground">Contato</h4>
            <ul className="space-y-3 text-sm text-muted-foreground font-body">
              <li className="flex items-center justify-center gap-2">
                <Mail size={14} className="text-primary" /> contato@nexaai.com.br
              </li>
              <li className="flex items-center justify-center gap-2">
                <Phone size={14} className="text-primary" /> (61) 99936-1312
              </li>
              <li className="flex items-center justify-center gap-2">
                <MapPin size={14} className="text-primary" /> Brasília, Brasil
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-sm tracking-widest uppercase mb-4 text-foreground">Redes Sociais</h4>
            <div className="flex justify-center gap-3">
              {[
                { Icon: Linkedin, href: "#" },
                { Icon: Instagram, href: "#" },
                { Icon: MessageCircle, href: "https://wa.me/+5516998935289" },
              ].map(({ Icon, href }, i) => (
                <a
                  key={i}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-lg border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border/20 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © 2026 Nexa AI. Todos os direitos reservados.
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
