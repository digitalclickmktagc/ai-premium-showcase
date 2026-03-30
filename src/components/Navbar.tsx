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
    const onScroll = () => setScrolled(window.scrollY > 50);
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
          className="flex items-center justify-between h-14 px-4 rounded-2xl"
          style={{
            background: scrolled ? "rgba(0, 0, 0, 0.75)" : "transparent",
            backdropFilter: scrolled ? "blur(30px) saturate(1.8)" : "none",
            WebkitBackdropFilter: scrolled ? "blur(30px) saturate(1.8)" : "none",
            borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
            boxShadow: scrolled
              ? "0 1px 0 rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.4)"
              : "none",
            transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
          }}
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
                      : "text-[rgba(240,240,240,0.70)] hover:text-white"
                  }`}
                  style={{ letterSpacing: "0.02em" }}
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
                      className={`absolute -bottom-0.5 left-0 h-[1.5px] rounded-full transition-all duration-300 ${
                        isActive ? "w-full" : "w-0 group-hover:w-full"
                      }`}
                      style={{ background: "#9333EA" }}
                    />
                  </span>
                </a>
              );
            })}
          </div>

          {/* CTA */}
          <div className="hidden md:block flex-shrink-0">
            <a href="#diagnostico" onClick={() => setActiveLink("#diagnostico")}>
              <Button
                variant="glow"
                size="sm"
                className="text-white text-[0.8rem] tracking-[0.08em] font-semibold rounded-full px-5"
                style={{
                  boxShadow: "var(--glow-sm), inset 0 1px 0 rgba(255,255,255,0.15)",
                }}
              >
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
            className="md:hidden mx-4 mt-2 rounded-2xl overflow-hidden"
            style={{
              background: "rgba(0,0,0,0.90)",
              backdropFilter: "blur(30px)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
            }}
          >
            <ul className="flex flex-col gap-1 p-3">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-[rgba(240,240,240,0.70)] hover:text-white hover:bg-white/[0.04] rounded-xl transition-all duration-200"
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
                  <Button variant="glow" size="sm" className="w-full text-white">
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
