import { useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const FloatingParticles = () => {
  const isMobile = useIsMobile();
  const count = isMobile ? 5 : 14;

  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const size = isMobile ? Math.random() * 150 + 80 : Math.random() * 300 + 100;
      const duration = Math.random() * 25 + 18;
      const delay = Math.random() * 5;
      return {
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size,
        duration,
        delay,
        opacity: Math.random() * 0.08 + 0.03,
        blur: isMobile ? Math.min(size * 0.25, 40) : size * 0.35,
      };
    });
  }, [count, isMobile]);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            background: `radial-gradient(circle, hsl(271 81% 56% / ${p.opacity}) 0%, transparent 70%)`,
            filter: `blur(${p.blur}px)`,
            willChange: "transform",
            animation: `float-${p.id} ${p.duration}s ${p.delay}s ease-in-out infinite alternate`,
          }}
        />
      ))}
      <style>{particles.map((p) => {
        const dx1 = (Math.random() - 0.5) * (isMobile ? 100 : 300);
        const dy1 = (Math.random() - 0.5) * (isMobile ? 100 : 300);
        const dx2 = (Math.random() - 0.5) * (isMobile ? 60 : 200);
        const dy2 = (Math.random() - 0.5) * (isMobile ? 60 : 200);
        return `@keyframes float-${p.id} { 0% { transform: translate(0,0); } 50% { transform: translate(${dx1}px,${dy1}px); } 100% { transform: translate(${dx2}px,${dy2}px); } }`;
      }).join("\n")}</style>
    </div>
  );
};

export default FloatingParticles;
