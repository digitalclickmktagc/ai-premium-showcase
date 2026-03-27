import { motion } from "framer-motion";

const QuoteSection = () => {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="container mx-auto px-4 lg:px-8 relative z-10 py-28 lg:py-40">
        <motion.div
          initial={{ opacity: 0, y: 30, filter: "blur(12px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 1.0 }}
          className="text-center max-w-5xl mx-auto"
        >
          {/* Decorative large quote */}
          <div
            className="font-display font-black leading-none select-none pointer-events-none mb-[-30px] md:mb-[-50px]"
            style={{
              fontSize: "clamp(80px, 14vw, 160px)",
              background: "linear-gradient(135deg, rgba(147,51,234,0.25), rgba(168,85,247,0.1))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            "
          </div>

          <p className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light leading-tight tracking-tight text-foreground">
            Tecnologia que devolve{" "}
            <span className="text-gradient-nexa">
              o seu tempo.
            </span>
          </p>

          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            whileInView={{ opacity: 1, scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="w-16 h-px mx-auto my-8"
            style={{ background: "linear-gradient(90deg, transparent, rgba(147,51,234,0.6), transparent)" }}
          />

          <motion.footer
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-sm tracking-[0.3em] font-medium text-muted-foreground"
          >
            — NEXA AI
          </motion.footer>
        </motion.div>
      </div>
    </section>
  );
};

export default QuoteSection;
