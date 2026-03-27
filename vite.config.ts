import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
import { VitePWA } from "vite-plugin-pwa";
 
export default defineConfig(({ command, mode }) => {
  const isProductionBuild = command === "build" || mode === "production";
  const plugins = [
    react(),
    tailwindcss(),
    !isProductionBuild ? jsxLocPlugin() : null,
    !isProductionBuild ? vitePluginManusRuntime() : null,
    VitePWA({
      registerType: "autoUpdate",
      filename: "service-worker.js",
      cleanupOutdatedCaches: true,
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "robots.txt", "offline.html"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,json,woff2}", "manifest.json"],
        navigateFallback: "/index.html",
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "app-pages",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
          {
            urlPattern: ({ request, url }) =>
              ["script", "style", "image", "font"].includes(request.destination) &&
              !url.pathname.startsWith("/api") &&
              !url.pathname.startsWith("/auth") &&
              !url.pathname.startsWith("/admin"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "app-assets",
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
      manifest: false,
    }),
  ].filter(Boolean);

  return {
    plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    target: "es2020",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (
            id.includes("react") ||
            id.includes("scheduler") ||
            id.includes("wouter")
          ) {
            return "vendor-react";
          }

          if (id.includes("framer-motion")) {
            return "vendor-motion";
          }

          if (id.includes("@radix-ui")) {
            return "vendor-radix";
          }

          if (id.includes("jsqr") || id.includes("qrcode.react")) {
            return "vendor-qr";
          }

          if (id.includes("lucide-react") || id.includes("sonner")) {
            return "vendor-ui";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    host: true,
    proxy: {
      "/auth": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/admin": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/docs": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/docs.json": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
      ".ngrok-free.app",
      "21262ba387b7.ngrok-free.app",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  };
});
