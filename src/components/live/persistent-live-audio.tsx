"use client";

import Hls from "hls.js";
import type { ErrorData } from "hls.js";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type LiveAudioState = {
  playbackUrl: string | null;
  status: string;
};

type LiveStatusPayload = {
  playbackUrl?: unknown;
  status?: unknown;
};

const liveAudioEnabledStorageKey = "bouncecore.liveAudio.enabled";
const liveAudioEnableEvent = "bouncecore:live-audio-enable";

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
    status: typeof payload.status === "string" ? payload.status : current.status
  };
}

function storedAudioEnabled() {
  try {
    return window.localStorage.getItem(liveAudioEnabledStorageKey) === "true";
  } catch {
    return false;
  }
}

function storeAudioEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(liveAudioEnabledStorageKey, enabled ? "true" : "false");
  } catch {
    // Storage can be unavailable in strict privacy modes; playback still works for this page lifetime.
  }
}

export function requestPersistentLiveAudio() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(liveAudioEnableEvent));
}

export function PersistentLiveAudio() {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [liveState, setLiveState] = useState<LiveAudioState>({
    playbackUrl: null,
    status: "checking"
  });
  const [userEnabled, setUserEnabled] = useState(false);
  const canPlay = Boolean(liveState.playbackUrl) && liveState.status !== "offline";
  const onLivePage = pathname === "/live" || pathname.startsWith("/live?");

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) {
        setUserEnabled(storedAudioEnabled());
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

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

    if (!playbackUrl || !canPlay) {
      return () => {
        cancelled = true;
      };
    }

    if (isLikelyHls(playbackUrl) && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        startLevel: -1
      });
      hlsRef.current = hls;
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

    return () => {
      cancelled = true;
    };
  }, [canPlay, liveState.playbackUrl]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (!canPlay || !userEnabled || onLivePage) {
      audio.pause();
      return;
    }

    void audio.play().catch(() => undefined);
  }, [canPlay, onLivePage, userEnabled]);

  useEffect(() => {
    function enableAudio() {
      setUserEnabled(true);
      storeAudioEnabled(true);
    }

    window.addEventListener(liveAudioEnableEvent, enableAudio);
    window.addEventListener("bouncecore:live-video-play", enableAudio);

    return () => {
      window.removeEventListener(liveAudioEnableEvent, enableAudio);
      window.removeEventListener("bouncecore:live-video-play", enableAudio);
    };
  }, []);

  useEffect(() => {
    function eventLeavesLivePage(event: Event) {
      const target = event.target;

      if (!(target instanceof Element)) {
        return false;
      }

      const anchor = target.closest("a[href]");

      if (!(anchor instanceof HTMLAnchorElement) || !anchor.href) {
        return false;
      }

      try {
        const url = new URL(anchor.href);

        return url.origin === window.location.origin && url.pathname !== "/live";
      } catch {
        return false;
      }
    }

    function primeBackgroundAudio(event: Event) {
      const audio = audioRef.current;

      if (!audio || !canPlay || !userEnabled || !onLivePage || !eventLeavesLivePage(event)) {
        return;
      }

      void audio.play().catch(() => undefined);
    }

    document.addEventListener("pointerdown", primeBackgroundAudio, { capture: true });

    return () => {
      document.removeEventListener("pointerdown", primeBackgroundAudio, { capture: true });
    };
  }, [canPlay, onLivePage, userEnabled]);

  return <audio aria-hidden="true" data-persistent-live-audio ref={audioRef} preload="auto" />;
}
