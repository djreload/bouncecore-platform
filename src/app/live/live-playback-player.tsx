"use client";
/* eslint-disable @next/next/no-img-element */

import Hls from "hls.js";
import type { ErrorData } from "hls.js";
import { Radio, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type LivePlaybackPlayerProps = {
  title: string;
  status: string;
  playbackUrl: string | null;
  offlineImageUrl: string | null;
};

type LivePlaybackState = {
  title: string;
  status: string;
  playbackUrl: string | null;
  offlineImageUrl: string | null;
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

export function LivePlaybackPlayer({
  title,
  status,
  playbackUrl,
  offlineImageUrl
}: LivePlaybackPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [liveState, setLiveState] = useState<LivePlaybackState>({
    title,
    status,
    playbackUrl,
    offlineImageUrl
  });
  const canAttemptPlayback = Boolean(liveState.playbackUrl) && liveState.status !== "offline";

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

  useEffect(() => {
    const video = videoRef.current;
    let cancelled = false;
    const currentPlaybackUrl = liveState.playbackUrl;

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

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (cancelled) {
          return;
        }

        void video.play().catch(() => undefined);
      });

      hls.on(Hls.Events.ERROR, (_event, data: ErrorData) => {
        if (cancelled) {
          return;
        }

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
      video.src = currentPlaybackUrl;
      void video.play().catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }

    video.src = currentPlaybackUrl;
    void video.play().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [canAttemptPlayback, liveState.playbackUrl]);

  return (
    <section className="bc-scanlines relative aspect-video overflow-hidden border-y border-bc-line bg-black shadow-2xl shadow-bc-electric/10 lg:rounded-t-md lg:border-x">
      {canAttemptPlayback ? (
        <video
          autoPlay
          ref={videoRef}
          className="absolute inset-0 h-full w-full bg-black object-contain"
          controls
          muted
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
    </section>
  );
}
