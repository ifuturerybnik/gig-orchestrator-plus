import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// VPS build config: disable Cloudflare plugin to output a standalone Node.js-compatible worker.
export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    server: { entry: "server" },
  },
});
