"use client";

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
  const canAttemptPlayback = Boolean(playbackUrl) && status !== "offline";
  const sourceLabel = useMemo(() => hostLabel(playbackUrl), [playbackUrl]);
  const activeLevel = currentLevel >= 0 ? levels.find((level) => level.index === currentLevel) : null;
  const adaptiveEnabled = playbackEngine === "hls-js" || playbackEngine === "native-hls";

  useEffect(() => {
    const video = videoRef.current;
    let cancelled = false;

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

    if (!canAttemptPlayback || !playbackUrl) {
      return () => {
        cancelled = true;
      };
    }

    const hlsPlayback = isLikelyHls(playbackUrl);

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
      hls.loadSource(playbackUrl);

      return () => {
        cancelled = true;
        hls.destroy();
      };
    }

    if (hlsPlayback && video.canPlayType("application/vnd.apple.mpegurl")) {
      applyState(() => setPlaybackEngine("native-hls"));
      video.src = playbackUrl;
      void video.play().catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }

    applyState(() => setPlaybackEngine("browser"));
    video.src = playbackUrl;
    void video.play().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [canAttemptPlayback, playbackUrl]);

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
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_center,rgba(0,213,255,0.16),transparent_42%),linear-gradient(135deg,rgba(255,43,214,0.10),transparent_45%),#070914] px-6 text-center">
          <div className="max-w-xl">
            {playbackUrl ? (
              <WifiOff className="mx-auto h-14 w-14 text-bc-muted" aria-hidden="true" />
            ) : (
              <Radio className="mx-auto h-14 w-14 text-bc-electric" aria-hidden="true" />
            )}
            <h2 className="mt-4 text-2xl font-black">{title}</h2>
            <p className="mt-2 text-sm text-bc-muted">
              {playbackUrl
                ? "The stream is offline. Playback will appear here when the channel is live."
                : "Playback is waiting for a public stream URL in the stream dashboard."}
            </p>
          </div>
        </div>
      )}

      <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
        <Badge tone={statusTone(status)}>{status.toUpperCase()}</Badge>
        <Badge tone="muted">{sourceLabel}</Badge>
        <Badge tone={adaptiveEnabled ? "acid" : "muted"}>{adaptiveEnabled ? "AUTO ABR" : "SINGLE SOURCE"}</Badge>
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 bg-black/68 px-4 py-3 backdrop-blur">
        <div>
          <p className="text-xs font-semibold uppercase text-bc-muted">Now playing</p>
          <h2 className="mt-1 text-lg font-black">{title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-bc-muted">
          <span className="inline-flex items-center gap-1 rounded border border-bc-line bg-white/5 px-2 py-1">
            <SignalHigh className="h-3.5 w-3.5 text-bc-acid" aria-hidden="true" />
            {viewerCount} viewers
          </span>
          <span className="inline-flex items-center gap-1 rounded border border-bc-line bg-white/5 px-2 py-1">
            <Radio className="h-3.5 w-3.5 text-bc-electric" aria-hidden="true" />
            {healthStatus.toUpperCase()}
          </span>
          <span className="inline-flex items-center gap-1 rounded border border-bc-line bg-white/5 px-2 py-1">
            <Wifi className="h-3.5 w-3.5 text-bc-electric" aria-hidden="true" />
            {formatBandwidth(bandwidthEstimate)}
          </span>
          <span className="inline-flex items-center gap-1 rounded border border-bc-line bg-white/5 px-2 py-1">
            <SlidersHorizontal className="h-3.5 w-3.5 text-bc-pink" aria-hidden="true" />
            {activeLevel?.label ?? configuredProfileLabel(streamProfile)}
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
