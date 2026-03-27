const brands = [
  "ESCALABILIDADE", "AUTOMAÇÃO", "CRM", "WEBSITES",
  "TRÁFEGO PAGO", "AGENTES IA", "INTEGRAÇÃO", "ANALYTICS",
  "SUPORTE 24/7", "FLUXOS", "DASHBOARDS", "CONVERSÃO",
];

const SocialProof = () => {
  return (
    <section className="py-10 overflow-hidden relative">
      <div className="section-divider mb-8" />
      <div className="relative">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none"
          style={{ background: "linear-gradient(90deg, white, transparent)" }} />
        <div className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none"
          style={{ background: "linear-gradient(270deg, white, transparent)" }} />

        <div className="flex animate-marquee whitespace-nowrap">
          {[...brands, ...brands].map((brand, i) => (
            <span
              key={i}
              className="mx-8 text-sm font-display font-bold tracking-[0.22em] flex items-center gap-3 select-none"
              style={{ color: "rgba(0,0,0,0.25)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #9333EA, #7C3AED)", opacity: 0.5 }}
              />
              {brand}
            </span>
          ))}
        </div>
      </div>
      <div className="section-divider mt-8" />
    </section>
  );
};

export default SocialProof;
