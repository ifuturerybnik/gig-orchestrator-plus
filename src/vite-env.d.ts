/// <reference types="vite-plugin-pwa/client" />

declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
