import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// A demonstração publicada abre direto no app: quem recebe o link quer ver o
// sistema, não a página institucional. O marketing continua em #/.
if (import.meta.env.VITE_DEMO === "1" && !window.location.hash) {
  window.location.hash = "#/app/login";
}

createRoot(document.getElementById("root")!).render(<App />);

// Register the PWA service worker only in production and only for the calendar
// app routes, so the marketing landing page is never intercepted.
if (import.meta.env.PROD && import.meta.env.VITE_DEMO !== "1" && "serviceWorker" in navigator) {
  const path = window.location.pathname;
  if (path.startsWith("/app") || path.startsWith("/c")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* PWA is a progressive enhancement — ignore registration errors */
      });
    });
  }
}
