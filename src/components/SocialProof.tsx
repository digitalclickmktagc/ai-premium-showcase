const brands = [
  "ESCALABILIDADE", "AUTOMAÇÃO", "CRM", "WEBSITES",
  "TRÁFEGO PAGO", "AGENTES IA", "INTEGRAÇÃO", "ANALYTICS",
  "SUPORTE 24/7", "FLUXOS", "DASHBOARDS", "CONVERSÃO",
];

const SocialProof = () => {
  return (
    <section
      className="py-4 overflow-hidden relative"
      style={{
        background: "rgba(147,51,234,0.06)",
        borderTop: "1px solid rgba(147,51,234,0.12)",
        borderBottom: "1px solid rgba(147,51,234,0.12)",
      }}
    >
      <div
        className="relative"
        style={{
          maskImage: "linear-gradient(90deg, transparent, black 15%, black 85%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, black 15%, black 85%, transparent)",
        }}
      >
        <div className="flex animate-marquee whitespace-nowrap">
          {[...brands, ...brands].map((brand, i) => (
            <span
              key={i}
              className="mx-8 text-[0.7rem] font-display font-semibold tracking-[0.18em] flex items-center gap-3 select-none uppercase"
              style={{ color: "rgba(240,240,240,0.45)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: "#7C3AED" }}
              />
              {brand}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SocialProof;
