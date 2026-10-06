import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");

  // Where /api-proxy points during `npm run dev`. In production the same path is
  // proxied by nginx (docker/nginx/default.conf) instead. Keeping both on one
  // same-origin path means the browser never makes a cross-origin API request.
  const proxyTarget =
    env.API_PROXY_TARGET || "https://devmanipal.getafixtechnologies.com";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      proxy: {
        "/api-proxy": {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (p) => p.replace(/^\/api-proxy/, "/api"),
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom"],
            charts: ["recharts"],
            maps: ["leaflet", "react-leaflet"],
          },
        },
      },
    },
  };
});
