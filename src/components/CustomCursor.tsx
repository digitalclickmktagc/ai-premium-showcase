import { useEffect, useRef, useState } from "react";

const CustomCursor = () => {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0 });
  const ringPos = useRef({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isText, setIsText] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      pos.current = { x: e.clientX, y: e.clientY };
      if (!isVisible) setIsVisible(true);
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${e.clientX - 4}px, ${e.clientY - 4}px)`;
      }
    };

    const animate = () => {
      ringPos.current.x += (pos.current.x - ringPos.current.x) * 0.15;
      ringPos.current.y += (pos.current.y - ringPos.current.y) * 0.15;
      if (ringRef.current) {
        const size = isHovering ? 56 : 32;
        ringRef.current.style.transform = `translate(${ringPos.current.x - size / 2}px, ${ringPos.current.y - size / 2}px)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    const handleOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      const isInteractive = tag === "a" || tag === "button" || target.closest("a") || target.closest("button") || target.getAttribute("role") === "button";
      const isTextEl = tag === "h1" || tag === "h2" || tag === "h3" || tag === "p" || tag === "span" || tag === "blockquote";
      setIsHovering(!!isInteractive);
      setIsText(!!isTextEl && !isInteractive);
    };

    const handleLeave = () => {
      setIsVisible(false);
    };

    const handleEnter = () => {
      setIsVisible(true);
    };

    window.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseover", handleOver);
    document.addEventListener("mouseleave", handleLeave);
    document.addEventListener("mouseenter", handleEnter);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseover", handleOver);
      document.removeEventListener("mouseleave", handleLeave);
      document.removeEventListener("mouseenter", handleEnter);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isHovering, isVisible]);

  // Hide on touch devices
  if (typeof window !== "undefined" && "ontouchstart" in window) return null;

  return (
    <>
      {/* Dot */}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: isText ? "#9333EA" : "#ffffff",
          opacity: isVisible ? 1 : 0,
          transition: "opacity 0.2s, background 0.2s, width 0.2s, height 0.2s, border-radius 0.2s",
          ...(isText ? { width: 2, height: 24, borderRadius: 1 } : {}),
          willChange: "transform",
        }}
      />
      {/* Ring */}
      <div
        ref={ringRef}
        className="fixed top-0 left-0 pointer-events-none z-[9998]"
        style={{
          width: isHovering ? 56 : 32,
          height: isHovering ? 56 : 32,
          borderRadius: "50%",
          border: `2px solid ${isHovering ? "rgba(168,85,247,0.60)" : "rgba(147,51,234,0.40)"}`,
          opacity: isVisible && !isText ? 1 : 0,
          transition: "width 0.3s cubic-bezier(0.16,1,0.3,1), height 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.2s, border-color 0.2s",
          willChange: "transform",
        }}
      />
    </>
  );
};

export default CustomCursor;
