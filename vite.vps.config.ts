import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// VPS build config: disable Cloudflare plugin to output a standalone Node.js-compatible worker.
export default defineConfig({
  cloudflare: false,
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      devOptions: { enabled: false },
      filename: "sw.js",
      manifest: false,
      workbox: {
        navigateFallbackDenylist: [/^\/~/],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  tanstackStart: {
    server: { entry: "server" },
  },
});
