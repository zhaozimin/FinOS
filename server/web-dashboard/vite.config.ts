import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const FINANCE_NODE_TARGET = "http://127.0.0.1:31889";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules/echarts")) return "echarts";
          if (
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react-router") ||
            id.includes("node_modules/react/")
          ) {
            return "vendor";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    host: "127.0.0.1",
    proxy: {
      "/v1": {
        target: FINANCE_NODE_TARGET,
        changeOrigin: false,
      },
    },
  },
});
