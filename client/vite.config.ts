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
    sourcemap: true,

    rollupOptions: {
      output: {
        manualChunks(id) {
          // Only split dependencies from node_modules
          if (!id.includes("node_modules")) {
            return;
          }

          // React ecosystem
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("react-router-dom")
          ) {
            return "vendor-react";
          }

          // Material UI + Emotion
          if (
            id.includes("@mui") ||
            id.includes("@emotion")
          ) {
            return "vendor-mui";
          }

          // Redux
          if (
            id.includes("@reduxjs/toolkit") ||
            id.includes("react-redux")
          ) {
            return "vendor-redux";
          }

          // Everything else
          return "vendor";
        },
      },
    },

    chunkSizeWarningLimit: 800,
  },
});