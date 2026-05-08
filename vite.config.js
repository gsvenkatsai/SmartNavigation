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
});
