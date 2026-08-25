import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Absolute base so SPA deep links (e.g. the client share link /c/:token and
  // /app/*) resolve their assets when opened directly. Assumes deploy at the
  // domain root (Hostinger public_html). For a sub-directory deploy, set this
  // to the sub-path (e.g. "/app-folder/").
  base: "/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));