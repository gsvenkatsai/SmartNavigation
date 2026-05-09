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
  // Proxy ORS API requests to avoid CORS issues in browser
  server: {
    proxy: {
      "/ors-api": {
        target: "https://api.openrouteservice.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ors-api/, ""),
        secure: true,
      },
    },
  },
});
