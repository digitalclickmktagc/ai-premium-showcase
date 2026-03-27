import { useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const FloatingParticles = () => {
  const isMobile = useIsMobile();
  const count = isMobile ? 3 : 7;

  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const size = isMobile ? Math.random() * 200 + 100 : Math.random() * 400 + 200;
      const duration = Math.random() * 35 + 25;
      const delay = Math.random() * 5;
      return {
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size,
        duration,
        delay,
        opacity: Math.random() * 0.035 + 0.01,
        blur: isMobile ? Math.min(size * 0.35, 60) : size * 0.45,
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
            background: `radial-gradient(circle, hsl(271 81% 56% / ${p.opacity}) 0%, hsl(271 81% 70% / ${p.opacity * 0.25}) 40%, transparent 70%)`,
            filter: `blur(${p.blur}px)`,
            willChange: "transform",
            animation: `float-${p.id} ${p.duration}s ${p.delay}s ease-in-out infinite alternate`,
          }}
        />
      ))}
      <style>{particles.map((p) => {
        const dx1 = (Math.random() - 0.5) * (isMobile ? 80 : 220);
        const dy1 = (Math.random() - 0.5) * (isMobile ? 80 : 220);
        const dx2 = (Math.random() - 0.5) * (isMobile ? 50 : 130);
        const dy2 = (Math.random() - 0.5) * (isMobile ? 50 : 130);
        return `@keyframes float-${p.id} { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(${dx1}px,${dy1}px) scale(1.05); } 100% { transform: translate(${dx2}px,${dy2}px) scale(0.95); } }`;
      }).join("\n")}</style>
    </div>
  );
};

export default FloatingParticles;
