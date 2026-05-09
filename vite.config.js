import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Ensure Leaflet assets are handled correctly
  optimizeDeps: {
    include: ["leaflet"],
  },
  // Allow .env.local to be read
  envPrefix: "VITE_",
  // Proxy API requests to avoid CORS issues in browser
  server: {
    proxy: {
      // ORS API proxy — fixes CORS for all OpenRouteService calls
      "/ors-api": {
        target: "https://api.openrouteservice.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ors-api/, ""),
        secure: true,
        headers: {
          "Accept": "application/json, application/geo+json, */*",
        },
      },
      // Groq API proxy — fixes CORS for AI agent calls
      "/groq-api": {
        target: "https://api.groq.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/groq-api/, ""),
        secure: true,
      },
    },
  },
});
