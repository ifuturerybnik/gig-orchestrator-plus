import { useEffect } from "react";

/**
 * Guarded PWA service-worker registration.
 *
 * Rules (per Lovable PWA skill):
 * - Never register in dev or Lovable preview contexts.
 * - Unregister any existing /sw.js in refused contexts.
 * - Support ?sw=off kill switch.
 * - Register only in production on the real domain.
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const isDev = !import.meta.env.PROD;
    const isIframe = window.self !== window.top;
    const hostname = window.location.hostname;
    const isPreview =
      hostname.startsWith("id-preview--") ||
      hostname.startsWith("preview--") ||
      hostname === "lovableproject.com" ||
      hostname.endsWith(".lovableproject.com") ||
      hostname === "lovableproject-dev.com" ||
      hostname.endsWith(".lovableproject-dev.com") ||
      hostname === "beta.lovable.dev" ||
      hostname.endsWith(".beta.lovable.dev");
    const isKillSwitch = window.location.search.includes("sw=off");

    const shouldRefuse = isDev || isIframe || isPreview || isKillSwitch;

    const unregisterMatching = async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          if (reg.scope?.endsWith("/") || reg.scope?.endsWith(window.location.origin + "/")) {
            await reg.unregister();
          }
        }
      } catch {
        // ignore
      }
    };

    if (shouldRefuse) {
      unregisterMatching();
      return;
    }

    // Production registration
    let updateInterval: ReturnType<typeof setInterval> | null = null;

    const register = async () => {
      try {
        const { registerSW } = await import("virtual:pwa-register");
        const updateSW = registerSW({
          immediate: true,
          onNeedRefresh() {
            // Auto-reload when a new version is available
            updateSW(true);
          },
        });

        // Poll for updates every hour
        updateInterval = setInterval(() => {
          updateSW(false);
        }, 60 * 60 * 1000);
      } catch {
        // virtual:pwa-register only exists in production builds
      }
    };

    register();

    return () => {
      if (updateInterval) clearInterval(updateInterval);
    };
  }, []);

  return null;
}
