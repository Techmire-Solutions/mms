import path from "node:path";
import { fileURLToPath } from "node:url";
import { constants } from "node:zlib";
import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite";
import { visualizer } from "rollup-plugin-visualizer";
import { compression } from "vite-plugin-compression2";
import { VitePWA } from "vite-plugin-pwa";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Backend origin the dev proxy forwards `/api`, `/health`, `/uploads` to.
// Override with MMS_BACKEND_PROXY when the backend runs on a non-default port.
const backendProxyTarget = process.env.MMS_BACKEND_PROXY ?? "http://127.0.0.1:3000";

// React Compiler is opt-in and experimental (`@vitejs/plugin-react` v6 `compiler`
// option, powered by oxc-transform-react). Default-off keeps production builds
// byte-identical; enable per-build with MMS_REACT_COMPILER=1.
const reactCompilerEnabled = process.env.MMS_REACT_COMPILER === "1";

// Shared banner for vendor-validation chunk — injected by both Rollup and Rolldown.
// Disables Zod v4 JIT compilation globally to avoid boot-time cost in the browser.
const chunkBanner = (chunk: { name: string }): string =>
  chunk.name === "vendor-validation"
    ? "globalThis.__zod_globalConfig = Object.assign(globalThis.__zod_globalConfig || {}, { jitless: true });"
    : "";

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: backendProxyTarget,
        changeOrigin: true,
        ws: true,
        timeout: 600_000,
        proxyTimeout: 600_000,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const host = req.headers.host;
            if (host) {
              proxyReq.setHeader("x-forwarded-host", host);
            }
          });
          proxy.on("proxyReqWs", (proxyReq, req) => {
            const host = req.headers.host;
            if (host) {
              proxyReq.setHeader("x-forwarded-host", host);
            }
          });
        },
      },
      "/health": {
        target: backendProxyTarget,
        changeOrigin: true,
      },
      "/uploads": {
        target: backendProxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "es2022",
    // 'hidden' maps are written to disk but not linked in the bundle —
    // safe to upload to Sentry without exposing them publicly.
    sourcemap: process.env.CI === "true" ? "hidden" : false,
    manifest: true,
    minify: "esbuild",
    cssMinify: true,
    // Skip Vite's built-in in-memory gzip sizing pass; vite-plugin-compression2
    // already produces the real on-disk artefacts.
    reportCompressedSize: false,
    chunkSizeWarningLimit: 500,
    esbuild: {
      // Remove preserved licence comment blocks from vendor bundles.
      // OSS licences don't require in-binary comment preservation for web bundles.
      legalComments: "none",
    },
    // Disabled: the Workbox SW intercepts every modulepreload fetch via the
    // CacheFirst /assets/ rule and returns a response from the SW's world.
    // The browser refuses to use that response for module preloading (cross-world
    // security boundary), producing a warning for every chunk. Since the SW's
    // CacheFirst strategy already serves all assets from cache after first install,
    // preload hints are redundant and only create noise.
    modulePreload: false,
    rollupOptions: {
      output: {
        banner: chunkBanner,
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("/scheduler/") ||
              id.includes("/react-router/") ||
              id.includes("/react-router-dom/")
            ) {
              return "vendor-react";
            }
            if (id.includes("/@tanstack/react-query/")) {
              return "vendor-query";
            }
            if (id.includes("/@tanstack/react-virtual/")) {
              return "vendor-virtual";
            }
            if (id.includes("/react-easy-crop/")) {
              return "vendor-crop";
            }
            // Recharts 3 dropped its internal Redux dependency.
            // @reduxjs/toolkit removed — add it back if the app adopts Redux directly.
            if (
              id.includes("/recharts/") ||
              id.includes("/victory-vendor/") ||
              id.includes("/d3-")
            ) {
              return "vendor-charts";
            }
            if (
              id.includes("/@radix-ui/") ||
              id.includes("/@floating-ui/") ||
              id.includes("/lucide-react/") ||
              id.includes("/aria-hidden/") ||
              id.includes("/react-remove-scroll/") ||
              id.includes("/clsx/") ||
              id.includes("/tailwind-merge/") ||
              id.includes("/class-variance-authority/")
            ) {
              return "vendor-ui";
            }
            if (id.includes("/framer-motion/")) {
              return "vendor-motion";
            }
            if (id.includes("/zod/") || id.includes("/@ts-rest/")) {
              return "vendor-validation";
            }
          }
          if (
            id.includes("packages/shared/dist/i18n/appTranslationsEn") ||
            id.includes("packages\\shared\\dist\\i18n\\appTranslationsEn")
          ) {
            return "mms-i18n-en";
          }
          if (
            id.includes("packages/shared/dist/i18n/appTranslationsAr") ||
            id.includes("packages\\shared\\dist\\i18n\\appTranslationsAr")
          ) {
            return "mms-i18n-ar";
          }
          if (
            id.includes("packages/shared/dist/i18n/appTranslationsUr") ||
            id.includes("packages\\shared\\dist\\i18n\\appTranslationsUr")
          ) {
            return "mms-i18n-ur";
          }
          if (
            id.includes("packages/shared/dist/i18n/appTranslationsFa") ||
            id.includes("packages\\shared\\dist\\i18n\\appTranslationsFa")
          ) {
            return "mms-i18n-fa";
          }
        },
      },
    },
    rolldownOptions: {
      output: {
        banner: chunkBanner,
        codeSplitting: {
          minSize: 20000,
          groups: [
            {
              name: "vendor-react",
              test: /node_modules[\\/](?:react|react-dom|scheduler|react-router|react-router-dom)[\\/]/,
              priority: 50,
            },
            {
              name: "vendor-query",
              test: /node_modules[\\/]@tanstack[\\/]react-query[\\/]/,
              priority: 45,
            },
            {
              name: "vendor-virtual",
              test: /node_modules[\\/]@tanstack[\\/]react-virtual[\\/]/,
              priority: 44,
            },
            {
              name: "vendor-crop",
              test: /node_modules[\\/]react-easy-crop[\\/]/,
              priority: 42,
            },
            {
              name: "vendor-ui",
              test: /node_modules[\\/](?:@radix-ui|@floating-ui|react-remove-scroll|aria-hidden|lucide-react|clsx|tailwind-merge|class-variance-authority)[\\/]/,
              priority: 40,
            },
            {
              name: "vendor-motion",
              test: /node_modules[\\/]framer-motion[\\/]/,
              priority: 35,
            },
            {
              // Recharts 3 dropped its internal Redux dependency.
              // @reduxjs/toolkit removed — add it back if the app adopts Redux directly.
              // d3-[^\\/]+ matches full package names (e.g. d3-scale) not just the prefix.
              name: "vendor-charts",
              test: /node_modules[\\/](?:recharts|victory-vendor|d3-[^\\/]+)[\\/]/,
              priority: 30,
            },
            {
              name: "vendor-validation",
              test: /node_modules[\\/](?:zod|@ts-rest)[\\/]/,
              priority: 20,
            },
            {
              name: "mms-i18n-en",
              test: /packages[\\/]shared[\\/]dist[\\/]i18n[\\/]appTranslationsEn/,
              priority: 5,
            },
            {
              name: "mms-i18n-ar",
              test: /packages[\\/]shared[\\/]dist[\\/]i18n[\\/]appTranslationsAr/,
              priority: 5,
            },
            {
              name: "mms-i18n-ur",
              test: /packages[\\/]shared[\\/]dist[\\/]i18n[\\/]appTranslationsUr/,
              priority: 5,
            },
            {
              name: "mms-i18n-fa",
              test: /packages[\\/]shared[\\/]dist[\\/]i18n[\\/]appTranslationsFa/,
              priority: 5,
            },
          ],
        },
      },
    },
  },
  plugins: [
    react({ compiler: reactCompilerEnabled }),
    compression({
      algorithm: "brotliCompress",
      threshold: 1024,
      deleteOriginalAssets: false,
      // html added: index.html is on the critical first-visit path and benefits from compression.
      include: /\.(html|js|mjs|cjs|css|svg|json|webmanifest)$/i,
      compressionOptions: {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11,
        },
      },
    }),
    compression({
      algorithm: "gzip",
      threshold: 1024,
      deleteOriginalAssets: false,
      include: /\.(html|js|mjs|cjs|css|svg|json|webmanifest)$/i,
      compressionOptions: {
        level: 9,
      },
    }),
    visualizer({
      filename: path.resolve(rootDir, "dist/stats.html"),
      title: "MMS Frontend Bundle Analysis",
      template: "treemap",
      projectRoot: rootDir,
      gzipSize: true,
      brotliSize: true,
      open: false,
    }) as PluginOption,
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        globIgnores: ["**/stats.html", "**/*.map"],
        cleanupOutdatedCaches: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//, /^\/health/],
        runtimeCaching: [
          {
            // Non-GET check is first so it short-circuits cheaply for mutations.
            // Order matters: this rule must remain before all caching rules.
            urlPattern: ({ url, request }) =>
              request.method !== "GET" ||
              url.pathname.startsWith("/api/") ||
              url.pathname.startsWith("/uploads/") ||
              url.pathname.startsWith("/health"),
            handler: "NetworkOnly",
          },
          // Google Fonts — pass through; browser caches them natively
          // and SW fetch would violate connect-src CSP
          {
            urlPattern: ({ url }) =>
              url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com",
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ url, request }) =>
              request.method === "GET" &&
              (url.pathname.startsWith("/assets/") ||
                /\.(?:js|css|woff2|woff|ttf|png|jpg|jpeg|svg|ico)$/i.test(url.pathname)),
            handler: "CacheFirst",
            options: {
              cacheName: "mms-static-assets",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ url, request }) =>
              request.method === "GET" &&
              (url.pathname === "/" ||
                url.pathname.endsWith(".html") ||
                url.pathname.endsWith(".webmanifest") ||
                url.pathname.endsWith("manifest.json")),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "mms-html-manifest",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 24 * 60 * 60, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
});
