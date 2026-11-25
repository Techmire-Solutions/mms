import path from "node:path";
import { fileURLToPath } from "node:url";
import { constants } from "node:zlib";
import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite";
import { visualizer } from "rollup-plugin-visualizer";
import { compression } from "vite-plugin-compression2";
import { manualVendorChunk, rolldownChunkGroups } from "./src/lib/vendorChunks";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Backend origin the dev proxy forwards `/api`, `/health`, `/uploads` to.
// Override with MMS_BACKEND_PROXY or MMS_BACKEND_PORT when the backend runs on a non-default port.
const backendProxyTarget =
  process.env.MMS_BACKEND_PROXY ??
  `http://127.0.0.1:${process.env.MMS_BACKEND_PORT ?? (process.env.PORT || "3000")}`;

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
      "@mms/ui": path.resolve(rootDir, "../../packages/ui/src"),
      react: path.resolve(rootDir, "./node_modules/react"),
      "react-dom": path.resolve(rootDir, "./node_modules/react-dom"),
      clsx: path.resolve(rootDir, "./node_modules/clsx"),
      "tailwind-merge": path.resolve(rootDir, "./node_modules/tailwind-merge"),
      "class-variance-authority": path.resolve(rootDir, "./node_modules/class-variance-authority"),
      "lucide-react": path.resolve(rootDir, "./node_modules/lucide-react"),
      "@radix-ui/react-slot": path.resolve(rootDir, "./node_modules/@radix-ui/react-slot"),
      "@radix-ui/react-alert-dialog": path.resolve(
        rootDir,
        "./node_modules/@radix-ui/react-alert-dialog",
      ),
      "@radix-ui/react-checkbox": path.resolve(rootDir, "./node_modules/@radix-ui/react-checkbox"),
      "@radix-ui/react-select": path.resolve(rootDir, "./node_modules/@radix-ui/react-select"),
      "@radix-ui/react-switch": path.resolve(rootDir, "./node_modules/@radix-ui/react-switch"),
      "@radix-ui/react-tooltip": path.resolve(rootDir, "./node_modules/@radix-ui/react-tooltip"),
      "@radix-ui/react-popover": path.resolve(rootDir, "./node_modules/@radix-ui/react-popover"),
      "@radix-ui/react-dropdown-menu": path.resolve(
        rootDir,
        "./node_modules/@radix-ui/react-dropdown-menu",
      ),
      "@radix-ui/react-avatar": path.resolve(rootDir, "./node_modules/@radix-ui/react-avatar"),
      "@radix-ui/react-slider": path.resolve(rootDir, "./node_modules/@radix-ui/react-slider"),
      "@radix-ui/react-label": path.resolve(rootDir, "./node_modules/@radix-ui/react-label"),
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
        // Derives the vendor chunks from the shared SSOT (see src/lib/vendorChunks.ts).
        manualChunks: manualVendorChunk,
      },
    },
    rolldownOptions: {
      output: {
        banner: chunkBanner,
        codeSplitting: {
          minSize: 20000,
          groups: rolldownChunkGroups(),
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
    ...(process.env.ANALYZE === "1"
      ? [
          visualizer({
            filename: path.resolve(rootDir, "dist/stats.html"),
            title: "MMS Frontend Bundle Analysis",
            template: "treemap",
            projectRoot: rootDir,
            gzipSize: true,
            brotliSize: true,
            open: false,
          }) as PluginOption,
        ]
      : []),
  ],
});
