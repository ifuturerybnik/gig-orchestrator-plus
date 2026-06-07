// Globalny licznik zdarzeń: aktualizuje badge ikony aplikacji (PWA Badging API)
// i odgrywa dyskretny dźwięk gdy pojawi się nowa wiadomość lub powiadomienie.
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getMyEventCount } from "@/lib/mail-counts.functions";

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function playNotifyBeep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.5);
    o.onended = () => ctx.close().catch(() => undefined);
  } catch {
    /* noop */
  }
}

export function AppEventsBadge() {
  const { user } = useAuth();
  const fetchCount = useServerFn(getMyEventCount);
  const previousRef = useRef<number | null>(null);

  const query = useQuery({
    queryKey: ["my-event-count"],
    queryFn: () => fetchCount(),
    enabled: !!user,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const total = query.data?.total ?? 0;
    const nav = navigator as BadgeNavigator;
    if (typeof nav.setAppBadge === "function") {
      if (total > 0) nav.setAppBadge(total).catch(() => undefined);
      else nav.clearAppBadge?.().catch(() => undefined);
    }
    const prev = previousRef.current;
    if (prev !== null && total > prev) {
      playNotifyBeep();
    }
    previousRef.current = total;
  }, [query.data?.total]);

  useEffect(() => {
    if (!user) {
      const nav = navigator as BadgeNavigator;
      nav.clearAppBadge?.().catch(() => undefined);
      previousRef.current = null;
    }
  }, [user]);

  return null;
}
