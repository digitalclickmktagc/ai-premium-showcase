import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import nexaLogo from "@/assets/nexa-logo-new.png";

const navLinks = [
  { label: "Soluções", href: "#solucoes" },
  { label: "Diferenciais", href: "#diferenciais" },
  { label: "Depoimentos", href: "#depoimentos" },
  { label: "Formulário", href: "#diagnostico" },
  { label: "Contato", href: "#contato" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeLink, setActiveLink] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="container mx-auto px-4 lg:px-8 pt-4">
        <div
          className={`flex items-center justify-between h-14 px-4 rounded-2xl transition-all duration-500 ${
            scrolled
              ? "bg-background/85 border border-border backdrop-blur-xl shadow-[0_2px_30px_rgba(0,0,0,0.3)]"
              : "bg-transparent border border-transparent"
          }`}
        >
          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-md ring-1 ring-primary/20">
              <img src={nexaLogo} alt="Nexa AI" className="w-full h-full object-cover" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
              Nexa <span className="text-gradient-nexa">AI</span>
            </span>
          </a>

          {/* Pill nav — desktop */}
          <div className="hidden md:flex items-center bg-white/[0.04] border border-white/[0.06] rounded-full px-1.5 py-1.5 backdrop-blur-sm gap-0.5">
            {navLinks.map((link) => {
              const isActive = activeLink === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setActiveLink(link.href)}
                  className={`group relative flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-white/10 text-foreground shadow-[0_1px_6px_rgba(0,0,0,0.3)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-dot"
                      className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0"
                      initial={false}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative">
                    {link.label}
                    <span
                      className={`absolute -bottom-0.5 left-0 h-[1.5px] bg-primary rounded-full transition-all duration-300 ${
                        isActive ? "w-full" : "w-0 group-hover:w-full"
                      }`}
                    />
                  </span>
                </a>
              );
            })}
          </div>

          {/* CTA */}
          <div className="hidden md:block flex-shrink-0">
            <a href="#diagnostico" onClick={() => setActiveLink("#diagnostico")}>
              <Button variant="glow" size="sm" className="text-white cursor-pointer text-xs tracking-widest">
                ESCALAR
              </Button>
            </a>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-foreground p-1.5 rounded-xl hover:bg-primary/[0.06] transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="md:hidden mx-4 mt-2 rounded-2xl bg-background/95 border border-border backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.4)] overflow-hidden"
          >
            <ul className="flex flex-col gap-1 p-3">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-black/[0.03] rounded-xl transition-all duration-200"
                    onClick={() => {
                      setActiveLink(link.href);
                      setOpen(false);
                    }}
                  >
                    {activeLink === link.href && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    )}
                    {link.label}
                  </a>
                </li>
              ))}
              <li className="mt-2 px-1">
                <a href="#diagnostico" onClick={() => { setActiveLink("#diagnostico"); setOpen(false); }}>
                  <Button variant="glow" size="sm" className="w-full text-white cursor-pointer">
                    ESCALAR
                  </Button>
                </a>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
