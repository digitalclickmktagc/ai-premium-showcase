import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import nexaLogo from "@/assets/nexa-logo-new.png";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      <div className="container mx-auto px-4 lg:px-8 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto flex flex-col items-center"
        >
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden shadow-lg mb-10">
            <img src={nexaLogo} alt="Nexa AI" className="w-full h-full object-cover" />
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-display font-black tracking-tight leading-[1.05] mb-8 uppercase">
            A IA EXECUTA
            <br />
            <span className="text-gradient-nexa">ENQUANTO VOCÊ LIDERA.</span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground mb-12 font-body font-light"
          >
            Automação inteligente para empresas que pensam grande.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Button variant="glow" size="lg" className="text-base px-8 tracking-wide text-white">
              ESCALAR MEU ATENDIMENTO
              <ArrowRight className="ml-2" size={18} />
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
