const brands = [
  "ESCALABILIDADE", "AUTOMAÇÃO", "CRM", "WEBSITES",
  "TRÁFEGO PAGO", "AGENTES IA", "INTEGRAÇÃO", "ANALYTICS",
];

const SocialProof = () => {
  return (
    <section className="py-16 border-y border-border/50 overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap">
        {[...brands, ...brands].map((brand, i) => (
          <span
            key={i}
            className="mx-8 text-sm font-display font-bold tracking-widest text-muted-foreground/50 hover:text-foreground transition-colors flex items-center gap-4"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            {brand}
          </span>
        ))}
      </div>
    </section>
  );
};

export default SocialProof;
