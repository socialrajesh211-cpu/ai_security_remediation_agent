import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  build: {
    // Sourcemaps make production errors debuggable without shipping unminified
    // code — safe to disable if you don't want them publicly reachable.
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split heavy, rarely-changing vendor code into its own chunk(s) so
        // browsers cache it across app deploys instead of re-downloading it
        // every time app code changes.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-router-dom") || /[\\/]react[\\/]/.test(id) || /[\\/]react-dom[\\/]/.test(id)) {
            return "vendor-react";
          }
          if (id.includes("@mui") || id.includes("@emotion")) {
            return "vendor-mui";
          }
          if (id.includes("@reduxjs/toolkit") || id.includes("react-redux")) {
            return "vendor-redux";
          }
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
});