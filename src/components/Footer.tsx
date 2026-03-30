import { Instagram, Mail, Phone, MapPin } from "lucide-react";
import nexaLogo from "@/assets/nexa-logo-new.png";

const WhatsAppIcon = ({ size = 18 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const Footer = () => {
  return (
    <footer id="contato" className="pt-16 pb-8 relative overflow-hidden z-[2]">
      {/* Top divider */}
      <div className="absolute top-0 left-0 right-0 section-divider" />

      <div className="container mx-auto px-4 lg:px-8">
        {/* Main content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
          {/* Brand */}
          <div className="flex flex-col items-center md:items-start">
            <a href="#" className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md ring-1 ring-primary/15">
                <img src={nexaLogo} alt="Nexa AI" className="w-full h-full object-cover" />
              </div>
              <span className="font-display text-xl font-extrabold tracking-tight text-foreground">
                Nexa <span className="text-gradient-nexa">AI</span>
              </span>
            </a>
            <p className="text-sm font-body text-center md:text-left leading-relaxed max-w-xs" style={{ color: "rgba(240,240,240,0.55)" }}>
              Automação inteligente para empresas que pensam grande.
            </p>
          </div>

          {/* Contact */}
          <div className="text-center">
            <h4 className="font-display font-bold text-sm tracking-widest uppercase mb-5 text-foreground">Contato</h4>
            <ul className="space-y-3 text-sm font-body" style={{ color: "rgba(240,240,240,0.55)" }}>
              <li className="flex items-center justify-center gap-2.5 hover:text-foreground transition-colors">
                <Mail size={14} style={{ color: "#A855F7" }} /> contato@nexaai.com.br
              </li>
              <li className="flex items-center justify-center gap-2.5 hover:text-foreground transition-colors">
                <Phone size={14} style={{ color: "#A855F7" }} /> (16) 99893-5289
              </li>
              <li className="flex items-center justify-center gap-2.5 hover:text-foreground transition-colors">
                <MapPin size={14} style={{ color: "#A855F7" }} /> Brasília, Brasil
              </li>
            </ul>
          </div>

          {/* Social */}
          <div className="flex flex-col items-center md:items-end">
            <h4 className="font-display font-bold text-sm tracking-widest uppercase mb-5 text-foreground">Redes Sociais</h4>
            <div className="flex gap-3">
              {[
                { Icon: Instagram, href: "https://www.instagram.com/nexastartup", label: "Instagram" },
                { Icon: WhatsAppIcon, href: "https://wa.me/+5516998935289", label: "WhatsApp" },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300"
                  style={{
                    border: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.03)",
                    color: "rgba(240,240,240,0.55)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(147,51,234,0.35)";
                    (e.currentTarget as HTMLElement).style.background = "rgba(147,51,234,0.08)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(147,51,234,0.15)";
                    (e.currentTarget as HTMLElement).style.color = "#A855F7";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    (e.currentTarget as HTMLElement).style.color = "rgba(240,240,240,0.55)";
                  }}
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-xs" style={{ color: "rgba(240,240,240,0.40)" }}>
            © 2026 Nexa AI. Todos os direitos reservados.
          </p>
          <div className="flex gap-6 text-xs" style={{ color: "rgba(240,240,240,0.40)" }}>
            <a href="#" className="hover:text-foreground transition-colors">Privacidade</a>
            <a href="#" className="hover:text-foreground transition-colors">Termos</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
