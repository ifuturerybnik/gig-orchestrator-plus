import { useEffect } from "react";

/**
 * Wymusza jasny motyw na stronach publicznych (landing, login, register, terms, privacy).
 * Po odmontowaniu komponentu przywraca motyw użytkownika z localStorage.
 */
export function useForceLightTheme() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    const hadDark = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => {
      const stored = typeof localStorage !== "undefined" ? localStorage.getItem("concertivo-theme") : null;
      const isDark =
        stored === "dark" ||
        ((stored === "auto" || !stored) &&
          typeof window !== "undefined" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      html.classList.toggle("dark", isDark || hadDark === isDark ? isDark : isDark);
    };
  }, []);
}
