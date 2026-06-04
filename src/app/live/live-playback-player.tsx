"use client";

import { AlertTriangle, Play, Radio, SignalHigh, WifiOff } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";

type LivePlaybackPlayerProps = {
  title: string;
  status: string;
  playbackUrl: string | null;
  viewerCount: number;
  healthStatus: string;
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

export function LivePlaybackPlayer({ title, status, playbackUrl, viewerCount, healthStatus }: LivePlaybackPlayerProps) {
  const [playerState, setPlayerState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const canAttemptPlayback = Boolean(playbackUrl) && status !== "offline";
  const sourceLabel = useMemo(() => hostLabel(playbackUrl), [playbackUrl]);

  return (
    <section className="bc-scanlines relative aspect-video overflow-hidden rounded-md border border-bc-line bg-black shadow-2xl shadow-bc-electric/10">
      {canAttemptPlayback ? (
        <video
          autoPlay
          className="absolute inset-0 h-full w-full bg-black object-contain"
          controls
          muted
          onCanPlay={() => setPlayerState("ready")}
          onError={() => setPlayerState("error")}
          onLoadStart={() => setPlayerState("loading")}
          onPlaying={() => setPlayerState("ready")}
          playsInline
          preload="metadata"
          src={playbackUrl ?? undefined}
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
