"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Crown, Star, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePerformancePreferences } from "@/components/performance/use-performance-preferences";
import type { LiveStarSupportData } from "@/lib/stars/star-send-service";
import { defaultStarAlertSettings, type StarAlertSettings } from "@/lib/stars/star-alert-settings";

type StarSupportPanelProps = {
  initialData: LiveStarSupportData;
};

type LiveStarSendAlert = LiveStarSupportData["recentSends"][number];
type StarAlertAnimation = "floating-stars" | "confetti" | "fireworks";
type StarSupportOverlayProps = {
  initialData?: LiveStarSupportData;
};

const floatingStarParticles = Array.from({ length: 34 }, (_, index) => ({
  delay: (index % 8) * 110,
  drift: ((index * 37) % 180) - 90,
  left: 6 + ((index * 23) % 88),
  scale: 0.55 + ((index * 7) % 9) / 10
}));
const confettiParticles = Array.from({ length: 64 }, (_, index) => ({
  delay: (index % 12) * 80,
  drift: ((index * 41) % 240) - 120,
  duration: 2400 + ((index * 53) % 1200),
  hue: (index * 47) % 360,
  left: (index * 19) % 100,
  rotate: 180 + ((index * 29) % 540)
}));
const fireworkBursts = [
  { left: "16%", top: "18%", delay: 0 },
  { left: "78%", top: "22%", delay: 220 },
  { left: "28%", top: "66%", delay: 420 },
  { left: "68%", top: "70%", delay: 620 },
  { left: "50%", top: "16%", delay: 840 }
];

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(
    new Date(value)
  );
}

function alertCssVars(vars: Record<string, string | number>) {
  return vars as CSSProperties;
}

function hashText(value: string) {
  return value.split("").reduce((hash, character) => hash + character.charCodeAt(0), 0);
}

function animationForSend(send: LiveStarSendAlert, settings: StarAlertSettings): StarAlertAnimation {
  if (settings.effectMode === "floating_stars") {
    return "floating-stars";
  }

  if (settings.effectMode === "confetti") {
    return "confetti";
  }

  if (settings.effectMode === "fireworks") {
    return "fireworks";
  }

  if (send.amount >= settings.fireworksMinimumStars) {
    return "fireworks";
  }

  if (send.amount >= settings.confettiMinimumStars) {
    return "confetti";
  }

  return hashText(send.id) % 3 === 0 ? "confetti" : "floating-stars";
}

function FloatingStarsEffect() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {floatingStarParticles.map((particle, index) => (
        <span
          aria-hidden="true"
          className="bc-star-alert-floating-star"
          key={index}
          style={alertCssVars({
            "--bc-alert-delay": `${particle.delay}ms`,
            "--bc-alert-drift": `${particle.drift}px`,
            "--bc-alert-left": `${particle.left}%`,
            "--bc-alert-scale": particle.scale
          })}
        />
      ))}
    </div>
  );
}

function ConfettiEffect() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {confettiParticles.map((particle, index) => (
        <span
          aria-hidden="true"
          className="bc-star-alert-confetti"
          key={index}
          style={alertCssVars({
            "--bc-alert-delay": `${particle.delay}ms`,
            "--bc-alert-drift": `${particle.drift}px`,
            "--bc-alert-duration": `${particle.duration}ms`,
            "--bc-alert-hue": particle.hue,
            "--bc-alert-left": `${particle.left}%`,
            "--bc-alert-rotate": `${particle.rotate}deg`
          })}
        />
      ))}
    </div>
  );
}

function FireworksEffect() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {fireworkBursts.map((burst, index) => (
        <span
          aria-hidden="true"
          className="bc-star-alert-firework"
          key={index}
          style={alertCssVars({
            "--bc-alert-delay": `${burst.delay}ms`,
            "--bc-alert-left": burst.left,
            "--bc-alert-top": burst.top
          })}
        />
      ))}
    </div>
  );
}

function alertsEnabledForCurrentPath(settings: StarAlertSettings) {
  if (!settings.enabled) {
    return false;
  }

  if (settings.scope === "public_site") {
    return true;
  }

  return (
    window.location.pathname === "/live" ||
    window.location.pathname.startsWith("/live/") ||
    window.location.pathname === "/overlay/stars" ||
    window.location.pathname.startsWith("/overlay/stars/")
  );
}

export function StarSupportOverlay({ initialData }: StarSupportOverlayProps) {
  const { effective: performancePreferences } = usePerformancePreferences();
  const [activeSend, setActiveSend] = useState<LiveStarSendAlert | null>(null);
  const [alertSettings, setAlertSettings] = useState(initialData?.alertSettings ?? defaultStarAlertSettings);
  const activeSendRef = useRef<LiveStarSendAlert | null>(null);
  const alertTimerRef = useRef<number | null>(null);
  const alertQueueRef = useRef<LiveStarSendAlert[]>([]);
  const playNextAlertRef = useRef<() => void>(() => undefined);
  const seenSendIds = useRef(new Set(initialData?.recentSends.map((send) => send.id) ?? []));
  const initializedRef = useRef(Boolean(initialData));
  const settingsRef = useRef(alertSettings);
  const activeAnimation = useMemo(() => (activeSend ? animationForSend(activeSend, alertSettings) : null), [activeSend, alertSettings]);
  const alertPollMs = performancePreferences.realtimeUpdatesEnabled
    ? alertSettings.pollMs
    : Math.max(15_000, alertSettings.pollMs * 3);

  const playNextAlert = useCallback(() => {
    if (activeSendRef.current) {
      return;
    }

    const nextSend = alertQueueRef.current.shift();

    if (!nextSend) {
      return;
    }

    activeSendRef.current = nextSend;
    setActiveSend(nextSend);

    if (alertTimerRef.current) {
      window.clearTimeout(alertTimerRef.current);
    }

    alertTimerRef.current = window.setTimeout(() => {
      activeSendRef.current = null;
      setActiveSend(null);
      alertTimerRef.current = null;
      playNextAlertRef.current();
    }, settingsRef.current.durationMs);
  }, []);

  const enqueueNewSends = useCallback((sends: LiveStarSendAlert[]) => {
    const unseenSends = sends.filter((send) => {
      if (seenSendIds.current.has(send.id)) {
        return false;
      }

      seenSendIds.current.add(send.id);
      return true;
    });

    if (!unseenSends.length) {
      return;
    }

    alertQueueRef.current.push(...unseenSends);
    playNextAlert();
  }, [playNextAlert]);

  useEffect(() => {
    playNextAlertRef.current = playNextAlert;
  }, [playNextAlert]);

  useEffect(() => {
    settingsRef.current = alertSettings;
  }, [alertSettings]);

  useEffect(() => {
    let active = true;

    function clearAlertState() {
      alertQueueRef.current = [];
      activeSendRef.current = null;

      if (alertTimerRef.current) {
        window.clearTimeout(alertTimerRef.current);
        alertTimerRef.current = null;
      }

      setActiveSend(null);
    }

    async function refresh() {
      if (document.visibilityState === "hidden") {
        return;
      }

      try {
        const response = await fetch("/api/live/stars", {
          cache: "no-store"
        });
        const payload = (await response.json()) as LiveStarSupportData;

        if (active && response.ok) {
          setAlertSettings(payload.alertSettings);

          if (!initializedRef.current) {
            payload.recentSends.forEach((send) => seenSendIds.current.add(send.id));
            initializedRef.current = true;
            return;
          }

          if (!alertsEnabledForCurrentPath(payload.alertSettings)) {
            payload.recentSends.forEach((send) => seenSendIds.current.add(send.id));
            clearAlertState();
            return;
          }

          enqueueNewSends(payload.recentSends);
        }
      } catch {
        // Keep the last known star state if polling fails.
      }
    }

    void refresh();
    const interval = window.setInterval(refresh, alertPollMs);

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        clearAlertState();
        return;
      }

      void refresh();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [alertPollMs, enqueueNewSends]);

  useEffect(() => {
    return () => {
      if (alertTimerRef.current) {
        window.clearTimeout(alertTimerRef.current);
      }
    };
  }, []);

  if (!activeSend || !activeAnimation) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-live="polite">
      {performancePreferences.particlesEnabled ? <FloatingStarsEffect /> : null}
      {performancePreferences.particlesEnabled && (activeAnimation === "confetti" || activeAnimation === "fireworks") ? <ConfettiEffect /> : null}
      {performancePreferences.particlesEnabled && activeAnimation === "fireworks" ? <FireworksEffect /> : null}
      <div className="absolute inset-0 grid place-items-center px-4">
        <div className="bc-star-alert-card w-full max-w-xl rounded-md border border-bc-acid/50 bg-bc-ink/92 p-5 text-center shadow-2xl shadow-bc-acid/20 backdrop-blur sm:p-7">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Star className="h-7 w-7 fill-bc-acid text-bc-acid" aria-hidden="true" />
            <Badge tone="acid">Star alert</Badge>
            <span className="text-xs text-bc-muted">{formatTime(activeSend.createdAt)}</span>
          </div>
          <p className="mt-4 text-3xl font-black text-white sm:text-5xl">
            {activeSend.amount.toLocaleString("en-GB")} stars
          </p>
          <p className="mt-3 text-xl font-black text-bc-acid">{activeSend.displayName}</p>
          {activeSend.note ? <p className="mx-auto mt-3 max-w-md whitespace-pre-wrap break-words text-sm text-bc-muted">{activeSend.note}</p> : null}
        </div>
      </div>
    </div>
  );
}

function StarLeaderboardCard({
  description,
  emptyMessage,
  rows,
  title,
  variant
}: {
  description: string;
  emptyMessage: string;
  rows: LiveStarSupportData["leaderboard"];
  title: string;
  variant: "weekly" | "all-time";
}) {
  const Icon = variant === "weekly" ? Trophy : Crown;

  return (
    <div className="rounded-md border border-bc-line bg-bc-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <Badge tone={variant === "weekly" ? "acid" : "pink"}>{variant === "weekly" ? "This week" : "All time"}</Badge>
        <Icon className={variant === "weekly" ? "h-5 w-5 text-bc-acid" : "h-5 w-5 text-bc-pink"} aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-xl font-black">{title}</h2>
      <p className="mt-2 text-sm text-bc-muted">{description}</p>
      <div className="mt-4 space-y-2">
        {rows.map((row, index) => (
          <div className="flex items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink p-3" key={row.userId}>
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-bc-line bg-bc-panel text-sm font-black">
                {index + 1}
              </span>
              <span className="truncate font-semibold">{row.displayName}</span>
            </div>
            <Badge tone={variant === "weekly" ? "acid" : "pink"}>{row.stars.toLocaleString("en-GB")}</Badge>
          </div>
        ))}
        {!rows.length ? <p className="text-sm text-bc-muted">{emptyMessage}</p> : null}
      </div>
    </div>
  );
}

export function LiveStarLeaderboards({ initialData }: StarSupportPanelProps) {
  const { effective: performancePreferences } = usePerformancePreferences();
  const [data, setData] = useState(initialData);

  useEffect(() => {
    let active = true;

    async function refresh() {
      if (document.visibilityState === "hidden") {
        return;
      }

      try {
        const response = await fetch("/api/live/stars", {
          cache: "no-store"
        });
        const payload = (await response.json()) as LiveStarSupportData;

        if (active && response.ok) {
          setData(payload);
        }
      } catch {
        // Keep the last known leaderboard if polling fails.
      }
    }

    const interval = window.setInterval(refresh, performancePreferences.realtimeUpdatesEnabled ? 5000 : 15_000);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [performancePreferences.realtimeUpdatesEnabled]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <StarLeaderboardCard
        description={`${data.totalStarsSent.toLocaleString("en-GB")} stars sent across ${data.sendCount} live chat sends this week.`}
        emptyMessage="No stars have been sent this week yet."
        rows={data.leaderboard}
        title="Weekly stars leaderboard"
        variant="weekly"
      />
      <StarLeaderboardCard
        description="Top viewers across every recorded live chat star send."
        emptyMessage="The all-time ranking starts with the first live chat star send."
        rows={data.allTimeLeaderboard}
        title="All Time stars leaderboard"
        variant="all-time"
      />
    </div>
  );
}
