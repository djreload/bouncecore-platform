"use client";

import Hls from "hls.js";
import type { ErrorData } from "hls.js";
import { Pause, Play, Radio, Volume2, WifiOff } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type LiveAudioState = {
  playbackUrl: string | null;
  status: string;
  title: string;
  viewerCount: number;
};

type LiveStatusPayload = {
  playbackUrl?: unknown;
  status?: unknown;
  viewerCount?: unknown;
  channel?: {
    title?: unknown;
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

function normalizePayload(payload: LiveStatusPayload, current: LiveAudioState): LiveAudioState {
  return {
    playbackUrl: typeof payload.playbackUrl === "string" ? payload.playbackUrl : payload.playbackUrl === null ? null : current.playbackUrl,
    status: typeof payload.status === "string" ? payload.status : current.status,
    title: typeof payload.channel?.title === "string" ? payload.channel.title : current.title,
    viewerCount: typeof payload.viewerCount === "number" && Number.isFinite(payload.viewerCount) ? payload.viewerCount : current.viewerCount
  };
}

export function PersistentLiveAudio() {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [liveState, setLiveState] = useState<LiveAudioState>({
    playbackUrl: null,
    status: "checking",
    title: "Bouncecore Live",
    viewerCount: 0
  });
  const [userEnabled, setUserEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const canPlay = Boolean(liveState.playbackUrl) && liveState.status !== "offline";
  const visible = canPlay || userEnabled;
  const onLivePage = pathname === "/live" || pathname.startsWith("/live?");

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

        if (!cancelled) {
          setLiveState((current) => normalizePayload(payload, current));
        }
      } catch {
        // Keep the last known stream state if polling fails.
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
    const audio = audioRef.current;
    const playbackUrl = liveState.playbackUrl;
    let cancelled = false;

    hlsRef.current?.destroy();
    hlsRef.current = null;

    if (!audio) {
      return () => {
        cancelled = true;
      };
    }

    audio.removeAttribute("src");
    audio.load();
    setPlaying(false);

    if (!playbackUrl || !canPlay) {
      return () => {
        cancelled = true;
      };
    }

    async function playIfRequested() {
      if (!audio || !userEnabled || cancelled) {
        return;
      }

      try {
        await audio.play();
        if (!cancelled) {
          setBlocked(false);
          setPlaying(true);
        }
      } catch {
        if (!cancelled) {
          setBlocked(true);
          setPlaying(false);
        }
      }
    }

    if (isLikelyHls(playbackUrl) && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        startLevel: -1
      });
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void playIfRequested();
      });
      hls.on(Hls.Events.ERROR, (_event, data: ErrorData) => {
        if (!data.fatal || cancelled) {
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
      hls.attachMedia(audio);
      hls.loadSource(playbackUrl);

      return () => {
        cancelled = true;
        hls.destroy();
      };
    }

    audio.src = playbackUrl;
    void playIfRequested();

    return () => {
      cancelled = true;
    };
  }, [canPlay, liveState.playbackUrl, userEnabled]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    function onPlay() {
      setPlaying(true);
      setBlocked(false);
    }

    function onPause() {
      setPlaying(false);
    }

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  async function togglePlayback() {
    const audio = audioRef.current;

    if (!audio || !canPlay) {
      setUserEnabled(false);
      return;
    }

    if (userEnabled && !audio.paused) {
      audio.pause();
      setUserEnabled(false);
      return;
    }

    setUserEnabled(true);

    try {
      await audio.play();
      setBlocked(false);
      setPlaying(true);
    } catch {
      setBlocked(true);
      setPlaying(false);
    }
  }

  return (
    <>
      <audio ref={audioRef} preload="none" />
      {visible ? (
        <section
          className={`fixed z-[65] w-[min(22rem,calc(100vw-1.5rem))] rounded-md border border-bc-line bg-bc-panel/95 p-3 text-white shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur ${
            onLivePage ? "right-3 top-20" : "bottom-16 right-4"
          }`}
          aria-label="Persistent live audio"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-bc-electric/40 bg-bc-electric/10 text-bc-electric">
              {canPlay ? <Volume2 className="h-5 w-5" aria-hidden="true" /> : <WifiOff className="h-5 w-5" aria-hidden="true" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{liveState.title}</p>
              <p className="mt-0.5 truncate text-xs text-bc-muted">
                {canPlay
                  ? `${playing ? "Playing" : "Live audio ready"} / ${liveState.viewerCount.toLocaleString("en-GB")} viewers`
                  : "Live audio is offline"}
              </p>
              {blocked ? <p className="mt-1 text-xs text-bc-amber">Tap play again if the browser blocked autoplay.</p> : null}
            </div>
            <button
              aria-label={playing ? "Pause live audio" : "Play live audio"}
              className="bc-focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-md border border-bc-line bg-bc-ink text-white hover:border-bc-electric/60"
              disabled={!canPlay}
              onClick={togglePlayback}
              type="button"
            >
              {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
          {!canPlay ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-bc-muted">
              <Radio className="h-3.5 w-3.5" aria-hidden="true" />
              Audio will become available when the stream is live.
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
