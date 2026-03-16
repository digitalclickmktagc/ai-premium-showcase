import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      <div className="container mx-auto px-4 lg:px-8 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto"
        >



          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-12 font-body font-light"
          >
            Automação inteligente para empresas que não aceitam limites.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button variant="glow" size="lg" className="text-base px-8 tracking-wide text-white">
              Mapear minha Escala
              <ArrowRight className="ml-2" size={18} />
            </Button>
          </motion.div>
        </motion.div>

        {/* Abstract visual element */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-20 mx-auto max-w-3xl"
        >
          <div className="glass-card rounded-2xl p-1">
            <div className="bg-muted/50 rounded-xl h-64 md:h-80 flex items-center justify-center">
              <div className="flex gap-4 items-end">
                {[40, 65, 50, 80, 60, 90, 75].map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.6, delay: 0.8 + i * 0.1 }}
                    className="w-6 md:w-8 rounded-t-md bg-gradient-to-t from-primary/40 to-primary"
                    style={{ maxHeight: `${h}%`, minHeight: 20, height: h * 2 }}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
