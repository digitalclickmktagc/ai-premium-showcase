import { motion } from "framer-motion";

const QuoteSection = () => {
  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
      {/* Purple glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        <motion.blockquote
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto"
        >
          <p className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
            "Tecnologia que devolve{" "}
            <span className="text-gradient-nexa">o seu tempo.</span>"
          </p>
          <footer className="mt-8 text-muted-foreground text-sm tracking-[0.2em]">
            — Nexa AI
          </footer>
        </motion.blockquote>
      </div>
    </section>
  );
};

export default QuoteSection;
