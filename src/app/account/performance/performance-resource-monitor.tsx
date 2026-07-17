"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Battery,
  Cpu,
  Gauge,
  HardDrive,
  Network,
  Radio,
  RotateCcw,
  Sparkles,
  Video,
  Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  defaultPerformancePreferences,
  liveQualityOptions,
  recommendedMobileProtectionPreferences,
  type PerformancePreferences
} from "@/lib/account/performance-preferences-core";
import {
  applyPerformancePreferences,
  performancePreferencesSnapshot
} from "@/lib/performance/performance-preferences-client";

type PerformanceResourceMonitorProps = {
  initialPreferences: PerformancePreferences;
};

type BatteryManagerLike = EventTarget & {
  charging: boolean;
  level: number;
};

type NavigatorWithResourceHints = Navigator & {
  connection?: {
    downlink?: number;
    effectiveType?: string;
    saveData?: boolean;
  };
  deviceMemory?: number;
  getBattery?: () => Promise<BatteryManagerLike>;
};

type PerformanceWithMemory = Performance & {
  memory?: {
    jsHeapSizeLimit: number;
    usedJSHeapSize: number;
  };
};

type ResourceMetrics = {
  activeAnimations: number;
  batteryCharging: boolean | null;
  batteryLevel: number | null;
  connection: string;
  deviceMemoryGb: number | null;
  domNodes: number;
  fps: number | null;
  hardwareConcurrency: number | null;
  jsHeapLimitBytes: number | null;
  jsHeapUsedBytes: number | null;
  longTasks: number;
  playingMedia: number;
  transferredBytes: number;
};

const initialMetrics: ResourceMetrics = {
  activeAnimations: 0,
  batteryCharging: null,
  batteryLevel: null,
  connection: "Unknown",
  deviceMemoryGb: null,
  domNodes: 0,
  fps: null,
  hardwareConcurrency: null,
  jsHeapLimitBytes: null,
  jsHeapUsedBytes: null,
  longTasks: 0,
  playingMedia: 0,
  transferredBytes: 0
};

function formatBytes(value: number | null) {
  if (value === null) {
    return "Unavailable";
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024).toLocaleString("en-GB")} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function sampleFrameRate() {
  return new Promise<number>((resolve) => {
    const startedAt = performance.now();
    let frames = 0;

    function tick(timestamp: number) {
      frames += 1;
      const elapsed = timestamp - startedAt;

      if (elapsed >= 420) {
        resolve(Math.round((frames * 1000) / elapsed));
        return;
      }

      window.requestAnimationFrame(tick);
    }

    window.requestAnimationFrame(tick);
  });
}

function ToggleRow({
  checked,
  description,
  disabled = false,
  label,
  onChange
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="grid cursor-pointer gap-3 border-b border-bc-line py-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center">
      <span>
        <span className="block font-semibold text-white">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-bc-muted">{description}</span>
      </span>
      <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
        <input
          checked={checked}
          className="peer sr-only"
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span className="absolute inset-0 rounded-full border border-bc-line bg-bc-ink transition peer-checked:border-bc-acid/60 peer-checked:bg-bc-acid/25 peer-focus-visible:ring-2 peer-focus-visible:ring-bc-electric peer-disabled:opacity-50" />
        <span className="absolute left-1 h-5 w-5 rounded-full bg-bc-muted transition-transform peer-checked:translate-x-5 peer-checked:bg-bc-acid" />
      </span>
    </label>
  );
}

export function PerformanceResourceMonitor({ initialPreferences }: PerformanceResourceMonitorProps) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimerRef = useRef<number | null>(null);
  const requestGenerationRef = useRef(0);
  const snapshot = useMemo(() => performancePreferencesSnapshot(preferences), [preferences]);

  const savePreferences = useCallback((next: PerformancePreferences) => {
    requestGenerationRef.current += 1;
    const generation = requestGenerationRef.current;

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    setSaveState("saving");
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void fetch("/api/account/performance", {
        body: JSON.stringify(next),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Preferences could not be saved.");
          }

          if (generation === requestGenerationRef.current) {
            setSaveState("saved");
          }
        })
        .catch(() => {
          if (generation === requestGenerationRef.current) {
            setSaveState("error");
          }
        });
    }, 450);
  }, []);

  const updatePreferences = useCallback(
    (next: PerformancePreferences) => {
      setPreferences(next);
      applyPerformancePreferences(next);
      savePreferences(next);
    },
    [savePreferences]
  );

  const updateBoolean = useCallback(
    (key: keyof PerformancePreferences, checked: boolean) => {
      updatePreferences({
        ...preferences,
        [key]: checked
      });
    },
    [preferences, updatePreferences]
  );

  useEffect(() => {
    applyPerformancePreferences(initialPreferences);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [initialPreferences]);

  useEffect(() => {
    let active = true;
    let battery: BatteryManagerLike | null = null;
    let longTaskCount = 0;
    const navigatorHints = navigator as NavigatorWithResourceHints;
    const performanceMemory = performance as PerformanceWithMemory;

    const updateBattery = () => {
      if (!active || !battery) {
        return;
      }

      setMetrics((current) => ({
        ...current,
        batteryCharging: battery?.charging ?? null,
        batteryLevel: battery ? Math.round(battery.level * 100) : null
      }));
    };

    if (navigatorHints.getBattery) {
      void navigatorHints
        .getBattery()
        .then((manager) => {
          if (!active) {
            return;
          }

          battery = manager;
          updateBattery();
          battery.addEventListener("chargingchange", updateBattery);
          battery.addEventListener("levelchange", updateBattery);
        })
        .catch(() => {
          // Battery details are optional and commonly unavailable in privacy-focused browsers.
        });
    }

    const longTaskObserver =
      typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("longtask")
        ? new PerformanceObserver((list) => {
            longTaskCount += list.getEntries().length;
          })
        : null;

    longTaskObserver?.observe({ entryTypes: ["longtask"] });

    async function collect() {
      if (!active || document.visibilityState === "hidden") {
        return;
      }

      const fps = await sampleFrameRate();

      if (!active) {
        return;
      }

      const connection = navigatorHints.connection;
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const transferredBytes = resources.reduce((total, resource) => total + Math.max(0, resource.transferSize || 0), 0);
      const media = Array.from(document.querySelectorAll<HTMLMediaElement>("audio, video"));

      setMetrics((current) => ({
        ...current,
        activeAnimations: document.getAnimations().filter((animation) => animation.playState === "running").length,
        connection: [connection?.effectiveType?.toUpperCase(), connection?.downlink ? `${connection.downlink} Mbps` : null, connection?.saveData ? "Data saver" : null]
          .filter(Boolean)
          .join(" / ") || "Unknown",
        deviceMemoryGb: navigatorHints.deviceMemory ?? null,
        domNodes: document.getElementsByTagName("*").length,
        fps,
        hardwareConcurrency: navigator.hardwareConcurrency || null,
        jsHeapLimitBytes: performanceMemory.memory?.jsHeapSizeLimit ?? null,
        jsHeapUsedBytes: performanceMemory.memory?.usedJSHeapSize ?? null,
        longTasks: longTaskCount,
        playingMedia: media.filter((element) => !element.paused && element.readyState > 1).length,
        transferredBytes
      }));
      longTaskCount = 0;
    }

    void collect();
    const interval = window.setInterval(collect, 4000);

    return () => {
      active = false;
      window.clearInterval(interval);
      longTaskObserver?.disconnect();
      battery?.removeEventListener("chargingchange", updateBattery);
      battery?.removeEventListener("levelchange", updateBattery);
    };
  }, []);

  const loadLabel =
    metrics.longTasks >= 4 || (metrics.fps !== null && metrics.fps < 35)
      ? "High"
      : metrics.longTasks >= 1 || (metrics.fps !== null && metrics.fps < 50)
        ? "Moderate"
        : "Light";

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-bc-electric" aria-hidden="true" />
              <h3 className="text-xl font-black">Current resource load</h3>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-bc-muted">
              Browser-reported readings from this page. Android and browsers do not expose phone temperature or total system CPU use.
            </p>
          </div>
          <Badge tone={loadLabel === "High" ? "pink" : loadLabel === "Moderate" ? "amber" : "acid"}>{loadLabel} load</Badge>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <Battery className="h-5 w-5 text-bc-acid" aria-hidden="true" />
            <p className="mt-3 text-2xl font-black">{metrics.batteryLevel === null ? "Unavailable" : `${metrics.batteryLevel}%`}</p>
            <p className="mt-1 text-xs text-bc-muted">{metrics.batteryCharging === null ? "Battery API not exposed" : metrics.batteryCharging ? "Charging" : "On battery"}</p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <Activity className="h-5 w-5 text-bc-electric" aria-hidden="true" />
            <p className="mt-3 text-2xl font-black">{metrics.fps === null ? "Measuring" : `${metrics.fps} FPS`}</p>
            <p className="mt-1 text-xs text-bc-muted">{metrics.longTasks} long tasks in the last sample</p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <HardDrive className="h-5 w-5 text-bc-pink" aria-hidden="true" />
            <p className="mt-3 text-2xl font-black">{formatBytes(metrics.jsHeapUsedBytes)}</p>
            <p className="mt-1 text-xs text-bc-muted">JS heap / {formatBytes(metrics.jsHeapLimitBytes)} limit</p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <Network className="h-5 w-5 text-bc-amber" aria-hidden="true" />
            <p className="mt-3 text-lg font-black">{metrics.connection}</p>
            <p className="mt-1 text-xs text-bc-muted">{formatBytes(metrics.transferredBytes)} transferred this page</p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <Video className="h-5 w-5 text-bc-electric" aria-hidden="true" />
            <p className="mt-3 text-2xl font-black">{metrics.playingMedia}</p>
            <p className="mt-1 text-xs text-bc-muted">Active audio/video elements</p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <Sparkles className="h-5 w-5 text-bc-pink" aria-hidden="true" />
            <p className="mt-3 text-2xl font-black">{metrics.activeAnimations}</p>
            <p className="mt-1 text-xs text-bc-muted">Running CSS/Web animations</p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <Cpu className="h-5 w-5 text-bc-acid" aria-hidden="true" />
            <p className="mt-3 text-2xl font-black">{metrics.hardwareConcurrency ?? "Unknown"}</p>
            <p className="mt-1 text-xs text-bc-muted">Logical cores / {metrics.deviceMemoryGb ?? "?"} GB device memory</p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <Radio className="h-5 w-5 text-bc-amber" aria-hidden="true" />
            <p className="mt-3 text-2xl font-black">{metrics.domNodes.toLocaleString("en-GB")}</p>
            <p className="mt-1 text-xs text-bc-muted">DOM elements on this page</p>
          </article>
        </div>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-bc-acid" aria-hidden="true" />
              <h3 className="text-xl font-black">Battery and heat controls</h3>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-bc-muted">
              New accounts start at maximum performance with every reduction off. Changes apply immediately across the site and Android app, then save to your account.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={snapshot.effective.batterySaverActive ? "acid" : "cyan"}>
              {snapshot.effective.batterySaverActive ? "Saver active" : "Maximum performance"}
            </Badge>
            <Badge tone={saveState === "error" ? "pink" : saveState === "saving" ? "amber" : "muted"}>
              {saveState === "saving" ? "Saving" : saveState === "error" ? "Save failed" : saveState === "saved" ? "Saved" : "Ready"}
            </Badge>
          </div>
        </div>

        <fieldset className="mt-5 border-y border-bc-line">
          <legend className="px-2 text-sm font-black uppercase text-bc-electric">Quick protection</legend>
          <p className="pb-2 text-xs leading-5 text-bc-muted">Turn either switch on to apply a group of reductions. Battery Saver is the strongest option.</p>
          <ToggleRow
            checked={preferences.batterySaverEnabled}
            description="Use when the phone is hot or losing charge quickly. Caps video at 480p and temporarily applies every reduction below, including stopping background playback."
            label="Battery Saver - maximum reduction"
            onChange={(checked) => updateBoolean("batterySaverEnabled", checked)}
          />
          <ToggleRow
            checked={preferences.automaticMobileSaverEnabled}
            description="Optional for phones. Automatically applies visual, media, ad, and refresh reductions on Android or lower-resource devices while keeping background audio available. It is off by default."
            label="Automatic mobile protection - recommended"
            onChange={(checked) => updateBoolean("automaticMobileSaverEnabled", checked)}
          />
        </fieldset>

        <div className="mt-7 grid gap-8 lg:grid-cols-2">
          <fieldset className="min-w-0 border-t border-bc-line pt-3">
            <legend className="pr-3 text-sm font-black uppercase text-bc-pink">Visuals and chat media</legend>
            <p className="mt-1 text-xs leading-5 text-bc-muted">Turn a switch on to remove that visual workload. Off means the feature remains available.</p>
            <ToggleRow
              checked={!snapshot.effective.animationsEnabled}
              description="Stops animated chat text, interface accents, wheel lights, and decorative movement. Normal text and controls remain visible."
              disabled={snapshot.effective.batterySaverActive}
              label="Pause interface and chat animations"
              onChange={(checked) => updateBoolean("animationsEnabled", !checked)}
            />
            <ToggleRow
              checked={!snapshot.effective.particlesEnabled}
              description="Removes chat particles, star confetti, fireworks, and floating-star effects while keeping alerts readable."
              disabled={snapshot.effective.batterySaverActive}
              label="Hide particle effects"
              onChange={(checked) => updateBoolean("particlesEnabled", !checked)}
            />
            <ToggleRow
              checked={!snapshot.effective.animatedMediaEnabled}
              description="Stops GIF, animated sticker, and animated emoji images from loading. Leave this off when you want to see GIFs in chat."
              disabled={snapshot.effective.batterySaverActive}
              label="Hide animated GIFs, stickers, and emoji"
              onChange={(checked) => updateBoolean("animatedMediaEnabled", !checked)}
            />
            <ToggleRow
              checked={!snapshot.effective.hapticsEnabled}
              description="Stops incoming throw and impact vibration in the Android app. This can save power during busy chats."
              disabled={snapshot.effective.batterySaverActive}
              label="Disable mobile vibration"
              onChange={(checked) => updateBoolean("hapticsEnabled", !checked)}
            />
          </fieldset>

          <fieldset className="min-w-0 border-t border-bc-line pt-3">
            <legend className="pr-3 text-sm font-black uppercase text-bc-acid">Livestream playback</legend>
            <p className="mt-1 text-xs leading-5 text-bc-muted">Use these when video decoding or continuous playback is heating the device.</p>
            <ToggleRow
              checked={!snapshot.effective.secondaryVideoEnabled}
              description="Shows only the main DJ instead of decoding the second DJ picture-in-picture feed. Audio behavior is unchanged."
              disabled={snapshot.effective.batterySaverActive}
              label="Hide and stop the second-DJ video"
              onChange={(checked) => updateBoolean("secondaryVideoEnabled", !checked)}
            />
            <ToggleRow
              checked={!snapshot.effective.backgroundPlaybackEnabled}
              description="Stops the livestream after leaving the live page or putting the app in the background. Turn this on for the largest playback saving."
              disabled={preferences.batterySaverEnabled}
              label="Stop background livestream playback"
              onChange={(checked) => updateBoolean("backgroundPlaybackEnabled", !checked)}
            />

            <div className="grid gap-2 border-b border-bc-line py-4">
              <label className="text-sm font-semibold text-white" htmlFor="performance-live-quality">Maximum livestream quality</label>
              <select
                className="bc-focus-ring min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={snapshot.effective.batterySaverActive}
                id="performance-live-quality"
                onChange={(event) => updatePreferences({ ...preferences, maxLiveQuality: event.target.value as PerformancePreferences["maxLiveQuality"] })}
                value={preferences.maxLiveQuality}
              >
                {liveQualityOptions.map((quality) => (
                  <option key={quality} value={quality}>
                    {quality === "auto" ? "Automatic quality" : `Maximum ${quality}`}
                  </option>
                ))}
              </select>
              <p className="text-xs leading-5 text-bc-muted">Use 480p for coolest playback, 720p for balanced quality, or Automatic for the best connection-based quality. Active protection always caps at 480p.</p>
            </div>
          </fieldset>
        </div>

        <fieldset className="mt-7 border-t border-bc-line pt-3">
          <legend className="pr-3 text-sm font-black uppercase text-bc-electric">Network and Android app</legend>
          <p className="mt-1 text-xs leading-5 text-bc-muted">These controls reduce background requests and optional native app work. Chat messages and essential live status updates continue.</p>
          <div className="grid gap-x-8 lg:grid-cols-2">
            <ToggleRow
              checked={!snapshot.effective.realtimeUpdatesEnabled}
              description="Slows fallback polling for presence, leaderboards, throws, and challenge updates. Realtime chat and essential live events stay connected."
              disabled={snapshot.effective.batterySaverActive}
              label="Reduce background refresh frequency"
              onChange={(checked) => updateBoolean("realtimeUpdatesEnabled", !checked)}
            />
            <ToggleRow
              checked={!snapshot.effective.nativeAdsEnabled}
              description="Stops Unity LevelPlay banner and app-open ad loading inside the Android app. Website advertising is unaffected."
              disabled={snapshot.effective.batterySaverActive}
              label="Disable native Android ads"
              onChange={(checked) => updateBoolean("nativeAdsEnabled", !checked)}
            />
          </div>
        </fieldset>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-bc-line pt-5">
          <Button
            onClick={() => updatePreferences(defaultPerformancePreferences)}
            type="button"
            variant="ghost"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Turn off all reductions
          </Button>
          <Button onClick={() => updatePreferences(recommendedMobileProtectionPreferences)} type="button" variant="ghost">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Restore recommended mobile protection
          </Button>
        </div>
      </section>
    </div>
  );
}
