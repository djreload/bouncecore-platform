"use client";
/* eslint-disable @next/next/no-img-element */

import Hls from "hls.js";
import type { ErrorData } from "hls.js";
import { Radio, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { subscribeToLiveStatus } from "@/components/live/live-status-client";
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

function seekToLiveEdge(video: HTMLVideoElement) {
  const seekable = video.seekable;

  if (!seekable.length) {
    return;
  }

  const end = seekable.end(seekable.length - 1);
  const start = seekable.start(seekable.length - 1);

  if (Number.isFinite(end)) {
    video.currentTime = Math.max(start, end - 0.35);
  }
}

function sourceLabel(source: StreamPlaybackSource | null, fallback: string) {
  return source?.presenterName ?? source?.title ?? fallback;
}

function HlsVideo({
  ariaLabel,
  className,
  controls,
  muted,
  onPlaybackStarted,
  playbackUrl
}: {
  ariaLabel: string;
  className?: string;
  controls?: boolean;
  muted: boolean;
  onPlaybackStarted?: () => void;
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

    const activeVideo = video;

    hlsRef.current?.destroy();
    hlsRef.current = null;
    activeVideo.removeAttribute("src");
    activeVideo.load();

    function recoverLivePlayback() {
      hlsRef.current?.startLoad(-1);
      seekToLiveEdge(activeVideo);
      void activeVideo.play().catch(() => undefined);
    }

    activeVideo.addEventListener("ended", recoverLivePlayback);

    const hlsPlayback = isLikelyHls(playbackUrl);

    if (hlsPlayback && Hls.isSupported()) {
      const hls = new Hls({
        abrEwmaDefaultEstimate: 3_000_000,
        backBufferLength: 30,
        capLevelToPlayerSize: true,
        enableWorker: true,
        fragLoadingMaxRetry: 8,
        levelLoadingMaxRetry: 8,
        liveDurationInfinity: true,
        liveMaxLatencyDurationCount: 10,
        liveSyncDurationCount: 3,
        lowLatencyMode: true,
        manifestLoadingMaxRetry: 8,
        maxBufferLength: 30,
        maxLiveSyncPlaybackRate: 1.5,
        startLevel: -1
      });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!cancelled) {
          void activeVideo
            .play()
            .then(() => {
              onPlaybackStarted?.();
            })
            .catch(() => undefined);
        }
      });
      hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
        if (!data.details.live || cancelled || !activeVideo.paused) {
          return;
        }

        seekToLiveEdge(activeVideo);
        void activeVideo.play().catch(() => undefined);
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

      hls.attachMedia(activeVideo);
      hls.loadSource(playbackUrl);

      return () => {
        cancelled = true;
        activeVideo.removeEventListener("ended", recoverLivePlayback);
        hls.destroy();
      };
    }

    activeVideo.src = playbackUrl;
    void activeVideo
      .play()
      .then(() => {
        onPlaybackStarted?.();
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      activeVideo.removeEventListener("ended", recoverLivePlayback);
    };
  }, [onPlaybackStarted, playbackUrl]);

  return (
    <video
      aria-label={ariaLabel}
      autoPlay
      className={className}
      controls={controls}
      muted={muted}
      onPlay={onPlaybackStarted}
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
    return subscribeToLiveStatus((payload) => {
      setLiveState((current) => ({
        activeIngests: payload.status === "offline" ? [] : payload.activeIngests,
        title: payload.channel?.title ?? current.title,
        status: payload.status,
        playbackUrl: payload.playbackUrl,
        offlineImageUrl: payload.offlineImageUrl
      }));
    });
  }, []);

  return (
    <section
      className={cn(
        "bc-scanlines relative aspect-video overflow-hidden border-y border-bc-line bg-black shadow-2xl shadow-bc-electric/10 lg:rounded-t-md lg:border-x",
        hasSecondaryPlayback ? "ring-1 ring-bc-pink/45" : null
      )}
    >
      {canAttemptPlayback && primaryPlaybackUrl ? (
        <div
          aria-label={primarySource?.presenterName ? `${primarySource.presenterName} primary stream` : "Primary live stream"}
          className="absolute inset-0 bg-black"
          data-live-primary-video-slot="true"
          role="region"
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
