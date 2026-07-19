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
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-mui": ["@mui/material", "@mui/icons-material", "@emotion/react", "@emotion/styled"],
          "vendor-redux": ["@reduxjs/toolkit", "react-redux"],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
});
