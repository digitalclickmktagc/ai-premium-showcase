import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register the PWA service worker only in production and only for the calendar
// app routes, so the marketing landing page is never intercepted.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const path = window.location.pathname;
  if (path.startsWith("/app") || path.startsWith("/c")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* PWA is a progressive enhancement — ignore registration errors */
      });
    });
  }
}
