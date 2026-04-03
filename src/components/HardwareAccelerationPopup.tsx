import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Monitor, X, Zap } from "lucide-react";

const STORAGE_KEY = "hw-accel-popup-dismissed";

const HardwareAccelerationPopup = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (isMobile) return;

    if (!localStorage.getItem(STORAGE_KEY)) {
      const timer = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, "1");
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative w-full max-w-md pointer-events-auto rounded-2xl overflow-hidden"
              style={{
                background:
                  "linear-gradient(145deg, hsl(271 81% 56% / 0.12), hsl(0 0% 7%) 40%, hsl(0 0% 7%))",
                border: "1px solid hsl(271 81% 56% / 0.25)",
                boxShadow:
                  "0 0 80px hsl(271 81% 56% / 0.15), 0 25px 50px -12px rgba(0,0,0,0.5)",
              }}
            >
              {/* Glow accent top */}
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-[2px]"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, hsl(271 81% 56%), transparent)",
                }}
              />

              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors"
              >
                <X size={18} />
              </button>

              <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center">
                {/* Icon */}
                <motion.div
                  initial={{ rotate: -10 }}
                  animate={{ rotate: [0, -5, 5, 0] }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="mb-5 relative"
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{
                      background:
                        "linear-gradient(135deg, hsl(271 81% 56% / 0.25), hsl(271 81% 56% / 0.08))",
                      border: "1px solid hsl(271 81% 56% / 0.3)",
                    }}
                  >
                    <Monitor className="w-8 h-8 text-primary" />
                  </div>
                  <div className="absolute -top-1 -right-1">
                    <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  </div>
                </motion.div>

                {/* Title */}
                <h2 className="text-xl font-bold text-foreground font-heading mb-2">
                  Para a melhor experiência
                </h2>

                {/* Description */}
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mb-6">
                  Nosso site utiliza efeitos visuais avançados para proporcionar
                  uma experiência única. Se notar alguma lentidão,{" "}
                  <span className="text-primary font-medium">
                    ative a Aceleração de Hardware
                  </span>{" "}
                  nas configurações do seu navegador para um desempenho fluido e
                  imersivo.
                </p>

                {/* How-to hint */}
                <div
                  className="w-full rounded-xl px-4 py-3 mb-6 text-xs text-muted-foreground leading-relaxed"
                  style={{
                    background: "hsl(0 0% 100% / 0.04)",
                    border: "1px solid hsl(0 0% 100% / 0.06)",
                  }}
                >
                  <span className="text-foreground/80 font-medium">
                    Como ativar:
                  </span>{" "}
                  Configurações do navegador &rarr; Sistema &rarr;{" "}
                  <span className="text-primary/90">
                    Usar aceleração de hardware quando disponível
                  </span>
                </div>

                {/* CTA */}
                <button
                  onClick={handleClose}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-primary-foreground transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(271 81% 56%), hsl(271 81% 46%))",
                    boxShadow: "0 4px 20px hsl(271 81% 56% / 0.3)",
                  }}
                >
                  Entendi, continuar
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default HardwareAccelerationPopup;
