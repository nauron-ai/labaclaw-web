import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const runtimeHttpTarget = "http://127.0.0.1:42617";
const runtimeWsTarget = "ws://127.0.0.1:42617";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
  },
  server: {
    proxy: {
      "/health": {
        target: runtimeHttpTarget,
        changeOrigin: true,
      },
      "/pair": {
        target: runtimeHttpTarget,
        changeOrigin: true,
      },
      "/api": {
        target: runtimeHttpTarget,
        changeOrigin: true,
      },
      "/ws": {
        target: runtimeWsTarget,
        ws: true,
      },
    },
  },
});
