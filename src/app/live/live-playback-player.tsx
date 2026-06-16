"use client";
/* eslint-disable @next/next/no-img-element */

import Hls from "hls.js";
import type { ErrorData, Level } from "hls.js";
import { AlertTriangle, Play, Radio, SignalHigh, SlidersHorizontal, Wifi, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { StreamProfileSummary } from "@/lib/stream/stream-profile-service";

type LivePlaybackPlayerProps = {
  title: string;
  status: string;
  playbackUrl: string | null;
  offlineImageUrl: string | null;
  viewerCount: number;
  healthStatus: string;
  streamProfile: StreamProfileSummary | null;
};

type PlaybackEngine = "none" | "hls-js" | "native-hls" | "browser";

type PlaybackLevel = {
  bitrateKbps: number;
  height: number | null;
  index: number;
  label: string;
  width: number | null;
};

type LivePlaybackState = {
  title: string;
  status: string;
  playbackUrl: string | null;
  offlineImageUrl: string | null;
  viewerCount: number;
  healthStatus: string;
  streamProfile: StreamProfileSummary | null;
};

type LiveStatusPayload = {
  status?: unknown;
  playbackUrl?: unknown;
  offlineImageUrl?: unknown;
  viewerCount?: unknown;
  health?: {
    status?: unknown;
  };
  channel?: {
    title?: unknown;
    streamProfile?: StreamProfileSummary | null;
  } | null;
};

function statusTone(status: string) {
  if (status === "live") {
    return "acid" as const;
  }

  if (status === "starting" || status === "degraded") {
    return "amber" as const;
  }

  return "muted" as const;
}

function hostLabel(playbackUrl: string | null) {
  if (!playbackUrl) {
    return "No source";
  }

  try {
    return new URL(playbackUrl).host;
  } catch {
    return "Configured source";
  }
}

function isLikelyHls(playbackUrl: string | null) {
  if (!playbackUrl) {
    return false;
  }

  try {
    return new URL(playbackUrl, window.location.href).pathname.toLowerCase().endsWith(".m3u8");
  } catch {
    return playbackUrl.toLowerCase().includes(".m3u8");
  }
}

function levelLabel(level: Level, index: number): PlaybackLevel {
  const bitrateKbps = Math.round((level.bitrate || 0) / 1000);
  const height = level.height || null;
  const width = level.width || null;
  const label = level.name || (height ? `${height}p` : bitrateKbps ? `${bitrateKbps} Kbps` : `Profile ${index + 1}`);

  return {
    bitrateKbps,
    height,
    index,
    label: bitrateKbps ? `${label} / ${bitrateKbps} Kbps` : label,
    width
  };
}

function formatBandwidth(value: number | null) {
  if (!value || !Number.isFinite(value)) {
    return "Measuring";
  }

  return `${Math.max(1, Math.round(value / 1000)).toLocaleString("en-GB")} Kbps`;
}

function configuredProfileLabel(profile: StreamProfileSummary | null) {
  if (!profile) {
    return "Profile waiting";
  }

  return `${profile.label} ${profile.videoHeight}p${profile.fps}`;
}

export function LivePlaybackPlayer({
  title,
  status,
  playbackUrl,
  offlineImageUrl,
  viewerCount,
  healthStatus,
  streamProfile
}: LivePlaybackPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playerState, setPlayerState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [playbackEngine, setPlaybackEngine] = useState<PlaybackEngine>("none");
  const [levels, setLevels] = useState<PlaybackLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [selectedLevel, setSelectedLevel] = useState<number>(-1);
  const [bandwidthEstimate, setBandwidthEstimate] = useState<number | null>(null);
  const [liveState, setLiveState] = useState<LivePlaybackState>({
    title,
    status,
    playbackUrl,
    offlineImageUrl,
    viewerCount,
    healthStatus,
    streamProfile
  });
  const canAttemptPlayback = Boolean(liveState.playbackUrl) && liveState.status !== "offline";
  const sourceLabel = useMemo(() => hostLabel(liveState.playbackUrl), [liveState.playbackUrl]);
  const activeLevel = currentLevel >= 0 ? levels.find((level) => level.index === currentLevel) : null;
  const adaptiveEnabled = playbackEngine === "hls-js" || playbackEngine === "native-hls";

  useEffect(() => {
    let cancelled = false;

    async function refreshStatus() {
      try {
        const response = await fetch("/internal/stream/status", {
          cache: "no-store"
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as LiveStatusPayload;

        if (cancelled) {
          return;
        }

        setLiveState((current) => ({
          title: typeof payload.channel?.title === "string" ? payload.channel.title : current.title,
          status: typeof payload.status === "string" ? payload.status : current.status,
          playbackUrl: typeof payload.playbackUrl === "string" ? payload.playbackUrl : payload.playbackUrl === null ? null : current.playbackUrl,
          offlineImageUrl:
            typeof payload.offlineImageUrl === "string"
              ? payload.offlineImageUrl
              : payload.offlineImageUrl === null
                ? null
                : current.offlineImageUrl,
          viewerCount: typeof payload.viewerCount === "number" ? payload.viewerCount : current.viewerCount,
          healthStatus: typeof payload.health?.status === "string" ? payload.health.status : current.healthStatus,
          streamProfile: payload.channel?.streamProfile ?? current.streamProfile
        }));
      } catch {
        // Keep the last known state if the transient status poll fails.
      }
    }

    void refreshStatus();
    const interval = window.setInterval(refreshStatus, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    let cancelled = false;
    const currentPlaybackUrl = liveState.playbackUrl;

    function applyState(update: () => void) {
      window.queueMicrotask(() => {
        if (!cancelled) {
          update();
        }
      });
    }

    applyState(() => {
      setPlayerState(canAttemptPlayback ? "loading" : "idle");
      setPlaybackEngine("none");
      setLevels([]);
      setCurrentLevel(-1);
      setSelectedLevel(-1);
      setBandwidthEstimate(null);
    });

    if (!video) {
      return () => {
        cancelled = true;
      };
    }

    hlsRef.current?.destroy();
    hlsRef.current = null;
    video.removeAttribute("src");
    video.load();

    if (!canAttemptPlayback || !currentPlaybackUrl) {
      return () => {
        cancelled = true;
      };
    }

    const hlsPlayback = isLikelyHls(currentPlaybackUrl);

    if (hlsPlayback && Hls.isSupported()) {
      const hls = new Hls({
        abrEwmaDefaultEstimate: 3_000_000,
        capLevelToPlayerSize: true,
        enableWorker: true,
        startLevel: -1
      });
      hlsRef.current = hls;
      applyState(() => setPlaybackEngine("hls-js"));

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (cancelled) {
          return;
        }

        const nextLevels = hls.levels.map(levelLabel);
        setLevels(nextLevels);
        setBandwidthEstimate(hls.bandwidthEstimate);
        setPlayerState("ready");
        void video.play().catch(() => undefined);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        if (cancelled) {
          return;
        }

        setCurrentLevel(data.level);
        setBandwidthEstimate(hls.bandwidthEstimate);
      });

      hls.on(Hls.Events.ERROR, (_event, data: ErrorData) => {
        if (cancelled) {
          return;
        }

        setBandwidthEstimate(hls.bandwidthEstimate);

        if (!data.fatal) {
          return;
        }

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }

        setPlayerState("error");
        hls.destroy();
      });

      hls.attachMedia(video);
      hls.loadSource(currentPlaybackUrl);

      return () => {
        cancelled = true;
        hls.destroy();
      };
    }

    if (hlsPlayback && video.canPlayType("application/vnd.apple.mpegurl")) {
      applyState(() => setPlaybackEngine("native-hls"));
      video.src = currentPlaybackUrl;
      void video.play().catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }

    applyState(() => setPlaybackEngine("browser"));
    video.src = currentPlaybackUrl;
    void video.play().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [canAttemptPlayback, liveState.playbackUrl]);

  function updateSelectedLevel(value: string) {
    const nextLevel = Number.parseInt(value, 10);

    setSelectedLevel(nextLevel);

    if (hlsRef.current) {
      hlsRef.current.currentLevel = nextLevel;
      setBandwidthEstimate(hlsRef.current.bandwidthEstimate);
    }
  }

  return (
    <section className="bc-scanlines relative aspect-video overflow-hidden rounded-md border border-bc-line bg-black shadow-2xl shadow-bc-electric/10">
      {canAttemptPlayback ? (
        <video
          autoPlay
          ref={videoRef}
          className="absolute inset-0 h-full w-full bg-black object-contain"
          controls
          muted
          onCanPlay={() => setPlayerState("ready")}
          onError={() => setPlayerState("error")}
          onLoadStart={() => setPlayerState("loading")}
          onPlaying={() => setPlayerState("ready")}
          playsInline
          preload="metadata"
        />
      ) : (
        <div className="absolute inset-0">
          {liveState.offlineImageUrl ? (
            <img alt="" className="absolute inset-0 h-full w-full object-cover" src={liveState.offlineImageUrl} />
          ) : null}
        </div>
      )}

      {!canAttemptPlayback ? (
        <div
          className={`absolute inset-0 grid place-items-center px-6 text-center ${
            liveState.offlineImageUrl
              ? "bg-black/45"
              : "bg-[radial-gradient(circle_at_center,rgba(0,213,255,0.16),transparent_42%),linear-gradient(135deg,rgba(255,43,214,0.10),transparent_45%),#070914]"
          }`}
        >
          <div className="max-w-xl">
            {liveState.playbackUrl ? (
              <WifiOff className="mx-auto h-14 w-14 text-bc-muted" aria-hidden="true" />
            ) : (
              <Radio className="mx-auto h-14 w-14 text-bc-electric" aria-hidden="true" />
            )}
            <h2 className="mt-4 text-2xl font-black">{liveState.title}</h2>
            <p className="mt-2 text-sm text-white/80">
              {liveState.playbackUrl
                ? "The stream is offline. Playback will appear here when the channel is live."
                : "Playback is waiting for a public stream URL in the stream dashboard."}
            </p>
          </div>
        </div>
      ) : null}

      <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
        <Badge tone={statusTone(liveState.status)}>{liveState.status.toUpperCase()}</Badge>
        <Badge tone="muted">{sourceLabel}</Badge>
        <Badge tone={adaptiveEnabled ? "acid" : "muted"}>{adaptiveEnabled ? "AUTO ABR" : "SINGLE SOURCE"}</Badge>
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 bg-black/68 px-4 py-3 backdrop-blur">
        <div>
          <p className="text-xs font-semibold uppercase text-bc-muted">Now playing</p>
          <h2 className="mt-1 text-lg font-black">{liveState.title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-bc-muted">
          <span className="inline-flex items-center gap-1 rounded border border-bc-line bg-white/5 px-2 py-1">
            <SignalHigh className="h-3.5 w-3.5 text-bc-acid" aria-hidden="true" />
            {liveState.viewerCount} viewers
          </span>
          <span className="inline-flex items-center gap-1 rounded border border-bc-line bg-white/5 px-2 py-1">
            <Radio className="h-3.5 w-3.5 text-bc-electric" aria-hidden="true" />
            {liveState.healthStatus.toUpperCase()}
          </span>
          <span className="inline-flex items-center gap-1 rounded border border-bc-line bg-white/5 px-2 py-1">
            <Wifi className="h-3.5 w-3.5 text-bc-electric" aria-hidden="true" />
            {formatBandwidth(bandwidthEstimate)}
          </span>
          <span className="inline-flex items-center gap-1 rounded border border-bc-line bg-white/5 px-2 py-1">
            <SlidersHorizontal className="h-3.5 w-3.5 text-bc-pink" aria-hidden="true" />
            {activeLevel?.label ?? configuredProfileLabel(liveState.streamProfile)}
          </span>
          {playbackEngine === "hls-js" && levels.length > 1 ? (
            <select
              aria-label="Playback quality"
              className="h-8 rounded border border-bc-line bg-black/70 px-2 text-xs font-semibold text-white"
              onChange={(event) => updateSelectedLevel(event.target.value)}
              value={selectedLevel}
            >
              <option value={-1}>Auto</option>
              {levels.map((level) => (
                <option key={level.index} value={level.index}>
                  {level.label}
                </option>
              ))}
            </select>
          ) : null}
          {playerState === "loading" ? (
            <span className="inline-flex items-center gap-1 rounded border border-bc-line bg-white/5 px-2 py-1">
              <Play className="h-3.5 w-3.5 text-bc-amber" aria-hidden="true" />
              Loading
            </span>
          ) : null}
          {playerState === "error" ? (
            <span className="inline-flex items-center gap-1 rounded border border-bc-amber/40 bg-bc-amber/10 px-2 py-1 text-bc-amber">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Source unavailable
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
