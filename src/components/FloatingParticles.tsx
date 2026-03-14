import { motion } from "framer-motion";
import { useMemo } from "react";

const FloatingParticles = () => {
  const particles = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 300 + 100,
      duration: Math.random() * 25 + 18,
      delay: Math.random() * 5,
      opacity: Math.random() * 0.08 + 0.03,
    }));
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            background: `radial-gradient(circle, hsl(271 81% 56% / ${p.opacity}) 0%, transparent 70%)`,
            filter: `blur(${p.size * 0.35}px)`,
          }}
          animate={{
            x: [0, (Math.random() - 0.5) * 300, (Math.random() - 0.5) * 200, 0],
            y: [0, (Math.random() - 0.5) * 300, (Math.random() - 0.5) * 200, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            repeatType: "mirror",
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

export default FloatingParticles;
