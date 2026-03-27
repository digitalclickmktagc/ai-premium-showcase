import { motion } from "framer-motion";

const QuoteSection = () => {
  return (
    <section className="relative overflow-hidden" style={{ background: "#06000F" }}>
      {/* Noise texture */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{ opacity: 0.4 }}
      />

      {/* Purple gradient orbs */}
      <div
        className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(147,51,234,0.25) 0%, transparent 65%)",
          filter: "blur(80px)",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(109,40,217,0.2) 0%, transparent 65%)",
          filter: "blur(80px)",
          transform: "translate(50%, 50%)",
        }}
      />

      {/* Subtle grid on dark */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

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

          <p className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light leading-tight tracking-tight text-white">
            Tecnologia que devolve{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #C084FC, #A855F7, #9333EA)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
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
            className="text-sm tracking-[0.3em] font-medium"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            — NEXA AI
          </motion.footer>
        </motion.div>
      </div>
    </section>
  );
};

export default QuoteSection;
