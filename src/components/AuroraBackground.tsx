const AuroraBackground = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Dot grid */}
      <div className="absolute inset-0 dot-grid opacity-100" />

      {/* Aurora blobs */}
      <div
        className="absolute rounded-full mix-blend-screen"
        style={{
          width: 600,
          height: 600,
          top: "-5%",
          left: "-10%",
          background: "rgba(107,33,168,0.18)",
          filter: "blur(120px)",
          animation: "float-blob 20s ease-in-out infinite",
        }}
      />
      <div
        className="absolute rounded-full mix-blend-screen"
        style={{
          width: 800,
          height: 500,
          top: "5%",
          right: "-15%",
          background: "rgba(147,51,234,0.12)",
          filter: "blur(120px)",
          animation: "float-blob-reverse 28s ease-in-out infinite",
        }}
      />
      <div
        className="absolute rounded-full mix-blend-screen"
        style={{
          width: 500,
          height: 700,
          bottom: "0%",
          left: "30%",
          background: "rgba(168,85,247,0.08)",
          filter: "blur(120px)",
          animation: "float-blob-slow 35s ease-in-out infinite",
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 vignette" />

      {/* Noise texture */}
      <div className="absolute inset-0 noise" />
    </div>
  );
};

export default AuroraBackground;
