"use client";
/* eslint-disable @next/next/no-img-element */

import Hls from "hls.js";
import type { ErrorData } from "hls.js";
import { Radio, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { StreamPlaybackSource } from "@/lib/stream/stream-provider";

type LivePlaybackPlayerProps = {
  activeIngests?: StreamPlaybackSource[];
  title: string;
  status: string;
  playbackUrl: string | null;
  offlineImageUrl: string | null;
};

type LivePlaybackState = {
  activeIngests: StreamPlaybackSource[];
  title: string;
  status: string;
  playbackUrl: string | null;
  offlineImageUrl: string | null;
};

type LiveStatusPayload = {
  activeIngests?: unknown;
  status?: unknown;
  playbackUrl?: unknown;
  offlineImageUrl?: unknown;
  viewerCount?: unknown;
  health?: {
    status?: unknown;
  };
  channel?: {
    title?: unknown;
    streamProfile?: unknown;
  } | null;
};

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

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeActiveIngests(value: unknown): StreamPlaybackSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const sources: Array<StreamPlaybackSource | null> = value.map((item, index) => {
    if (!item || typeof item !== "object") {
      return null;
    }

    const source = item as Record<string, unknown>;
    const id = stringOrNull(source.id);

    if (!id) {
      return null;
    }

    return {
      id,
      lastIngestAt: stringOrNull(source.lastIngestAt) ?? new Date().toISOString(),
      playbackUrl: stringOrNull(source.playbackUrl),
      presenterName: stringOrNull(source.presenterName),
      role: source.role === "secondary" ? "secondary" : "primary",
      startedAt: stringOrNull(source.startedAt) ?? new Date().toISOString(),
      status: source.status === "starting" || source.status === "degraded" || source.status === "offline" ? source.status : "live",
      streamKeyFingerprint: stringOrNull(source.streamKeyFingerprint),
      title: stringOrNull(source.title) ?? (index === 0 ? "Primary DJ" : "Connecting DJ")
    };
  });

  return sources.filter((source): source is StreamPlaybackSource => Boolean(source)).slice(0, 2);
}

function sourceLabel(source: StreamPlaybackSource | null, fallback: string) {
  return source?.presenterName ?? source?.title ?? fallback;
}

function HlsVideo({
  ariaLabel,
  className,
  controls,
  muted,
  playbackUrl
}: {
  ariaLabel: string;
  className?: string;
  controls?: boolean;
  muted: boolean;
  playbackUrl: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    let cancelled = false;

    if (!video) {
      return () => {
        cancelled = true;
      };
    }

    hlsRef.current?.destroy();
    hlsRef.current = null;
    video.removeAttribute("src");
    video.load();

    const hlsPlayback = isLikelyHls(playbackUrl);

    if (hlsPlayback && Hls.isSupported()) {
      const hls = new Hls({
        abrEwmaDefaultEstimate: 3_000_000,
        capLevelToPlayerSize: true,
        enableWorker: true,
        lowLatencyMode: true,
        startLevel: -1
      });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!cancelled) {
          void video.play().catch(() => undefined);
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data: ErrorData) => {
        if (cancelled || !data.fatal) {
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

        hls.destroy();
      });

      hls.attachMedia(video);
      hls.loadSource(playbackUrl);

      return () => {
        cancelled = true;
        hls.destroy();
      };
    }

    video.src = playbackUrl;
    void video.play().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [playbackUrl]);

  return (
    <video
      aria-label={ariaLabel}
      autoPlay
      className={className}
      controls={controls}
      muted={muted}
      playsInline
      preload="metadata"
      ref={videoRef}
    />
  );
}

export function LivePlaybackPlayer({ activeIngests = [], title, status, playbackUrl, offlineImageUrl }: LivePlaybackPlayerProps) {
  const [liveState, setLiveState] = useState<LivePlaybackState>({
    activeIngests,
    title,
    status,
    playbackUrl,
    offlineImageUrl
  });
  const primarySource = useMemo(
    () => liveState.activeIngests.find((source) => source.role === "primary" && source.playbackUrl) ?? liveState.activeIngests[0] ?? null,
    [liveState.activeIngests]
  );
  const secondarySource = useMemo(
    () =>
      liveState.activeIngests.find((source) => source.role === "secondary" && source.playbackUrl) ??
      liveState.activeIngests.find((source) => source.id !== primarySource?.id && source.playbackUrl) ??
      null,
    [liveState.activeIngests, primarySource?.id]
  );
  const primaryPlaybackUrl = primarySource?.playbackUrl ?? liveState.playbackUrl;
  const secondaryPlaybackUrl =
    secondarySource?.playbackUrl && secondarySource.playbackUrl !== primaryPlaybackUrl ? secondarySource.playbackUrl : null;
  const canAttemptPlayback = Boolean(primaryPlaybackUrl) && liveState.status !== "offline";
  const hasSecondaryPlayback = Boolean(canAttemptPlayback && secondaryPlaybackUrl && liveState.activeIngests.length > 1);

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
          activeIngests:
            typeof payload.status === "string" && payload.status === "offline"
              ? []
              : normalizeActiveIngests(payload.activeIngests).length
                ? normalizeActiveIngests(payload.activeIngests)
                : current.activeIngests,
          title: typeof payload.channel?.title === "string" ? payload.channel.title : current.title,
          status: typeof payload.status === "string" ? payload.status : current.status,
          playbackUrl: typeof payload.playbackUrl === "string" ? payload.playbackUrl : payload.playbackUrl === null ? null : current.playbackUrl,
          offlineImageUrl:
            typeof payload.offlineImageUrl === "string"
              ? payload.offlineImageUrl
              : payload.offlineImageUrl === null
                ? null
                : current.offlineImageUrl
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

  return (
    <section
      className={cn(
        "bc-scanlines relative aspect-video overflow-hidden border-y border-bc-line bg-black shadow-2xl shadow-bc-electric/10 lg:rounded-t-md lg:border-x",
        hasSecondaryPlayback ? "ring-1 ring-bc-pink/45" : null
      )}
    >
      {canAttemptPlayback && primaryPlaybackUrl ? (
        <HlsVideo
          ariaLabel={primarySource?.presenterName ? `${primarySource.presenterName} primary stream` : "Primary live stream"}
          className="absolute inset-0 h-full w-full bg-black object-contain"
          controls
          muted={false}
          playbackUrl={primaryPlaybackUrl}
        />
      ) : (
        <div className="absolute inset-0">
          {liveState.offlineImageUrl ? (
            <img alt="" className="absolute inset-0 h-full w-full object-cover" src={liveState.offlineImageUrl} />
          ) : null}
        </div>
      )}

      {hasSecondaryPlayback && primarySource ? (
        <div className="absolute left-3 top-3 z-20 rounded-md border border-bc-pink/70 bg-black/70 px-3 py-2 text-left shadow-lg shadow-black/40 backdrop-blur">
          <p className="text-[11px] font-black uppercase tracking-wide text-bc-pink">1st DJ stream</p>
          <p className="max-w-52 truncate text-sm font-black text-white">{sourceLabel(primarySource, "Main DJ")}</p>
        </div>
      ) : null}

      {hasSecondaryPlayback && secondaryPlaybackUrl ? (
        <div className="absolute bottom-4 right-4 z-30 w-[min(34rem,36%)] min-w-[18rem] overflow-hidden rounded-md border-4 border-[#22c55e] bg-black shadow-[0_18px_54px_rgba(0,0,0,0.72)] max-sm:bottom-3 max-sm:right-3 max-sm:w-[45%] max-sm:min-w-[10rem]">
          <div className="relative aspect-video bg-black">
            <HlsVideo
              ariaLabel={secondarySource?.presenterName ? `${secondarySource.presenterName} secondary stream` : "Secondary live stream"}
              className="absolute inset-0 h-full w-full bg-black object-contain"
              muted
              playbackUrl={secondaryPlaybackUrl}
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/85 via-black/35 to-transparent p-3 max-sm:p-2">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-wide text-[#22c55e] max-sm:text-[9px]">2nd DJ stream</p>
                <p className="truncate text-base font-black text-white max-sm:text-xs">{sourceLabel(secondarySource, "Next DJ")}</p>
              </div>
              <span className="shrink-0 rounded border border-[#22c55e]/60 bg-black/70 px-2 py-1 text-[10px] font-black uppercase text-[#22c55e] max-sm:px-1.5 max-sm:py-0.5 max-sm:text-[8px]">
                Muted
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {hasSecondaryPlayback ? (
        <div className="absolute right-3 top-3 z-20 rounded-md border border-bc-line bg-bc-ink/85 px-2 py-1 text-xs font-black text-white backdrop-blur">
          {liveState.activeIngests.length} DJs connected
        </div>
      ) : null}

      {!canAttemptPlayback ? (
        <div
          className={cn(
            "absolute inset-0 grid place-items-center px-6 text-center",
            liveState.offlineImageUrl
              ? "bg-black/45"
              : "bg-[radial-gradient(circle_at_center,rgba(0,213,255,0.16),transparent_42%),linear-gradient(135deg,rgba(255,43,214,0.10),transparent_45%),#070914]"
          )}
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
    </section>
  );
}
