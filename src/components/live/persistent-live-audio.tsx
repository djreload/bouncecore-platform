"use client";

import Hls from "hls.js";
import type { ErrorData } from "hls.js";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildLiveHlsConfig,
  installLiveStallWatchdog,
  keepNormalPlaybackSpeed,
  startBufferedLivePlayback
} from "@/components/live/live-playback-buffer";
import { subscribeToLiveStatus, type LiveStatusPayload } from "@/components/live/live-status-client";
import { reconnectDelayMs } from "@/lib/realtime/reconnect";
import { isBouncecoreAndroidRuntime } from "@/lib/runtime/mobile-app-runtime";
import { defaultStreamPlaybackSettings } from "@/lib/stream/stream-playback-settings";

const liveAudioEnabledStorageKey = "bouncecore.liveAudio.enabled";
const liveAudioEnableEvent = "bouncecore:live-audio-enable";
const liveVideoSlotSelector = "[data-live-primary-video-slot]";

type AndroidAudioBridgeWindow = Window & {
  BouncecoreAndroid?: {
    setPersistentAudioActive?: (active: boolean) => void;
  };
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

function setAudiblePreference(enabled: boolean, video?: HTMLVideoElement | null) {
  if (video) {
    video.muted = !enabled;
  }

  storeAudioEnabled(enabled);
}

function isLivePath(pathname: string | null) {
  return pathname === "/live" || Boolean(pathname?.startsWith("/live/"));
}

function shouldSuspendPersistentPlayback(pathname: string | null, userEnabled: boolean) {
  if (userEnabled) {
    return false;
  }

  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    return true;
  }

  return isBouncecoreAndroidRuntime() && !isLivePath(pathname);
}

function setAndroidPersistentAudioActive(active: boolean) {
  if (typeof window === "undefined" || !isBouncecoreAndroidRuntime()) {
    return;
  }

  try {
    (window as AndroidAudioBridgeWindow).BouncecoreAndroid?.setPersistentAudioActive?.(active);
  } catch {
    // Older app shells do not expose this bridge method; web playback still works in foreground.
  }
}

export function requestPersistentLiveAudio() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(liveAudioEnableEvent));
}

const initialLiveStatus: LiveStatusPayload = {
  activeIngests: [],
  channel: null,
  health: {
    checkedAt: new Date(0).toISOString(),
    ingestConnected: false,
    status: "unknown"
  },
  offlineImageUrl: null,
  playbackSettings: defaultStreamPlaybackSettings,
  playbackUrl: null,
  status: "checking",
  viewerCount: 0
};

function getPrimaryPlaybackUrl(liveState: LiveStatusPayload) {
  const primaryIngest =
    liveState.activeIngests.find((ingest) => ingest.role === "primary" && ingest.playbackUrl) ??
    liveState.activeIngests.find((ingest) => ingest.playbackUrl);

  return primaryIngest?.playbackUrl ?? liveState.playbackUrl;
}

export function PersistentLiveAudio() {
  const pathname = usePathname();
  const parkingRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const reconnectAttemptRef = useRef(0);
  const canPlayRef = useRef(false);
  const playbackBufferSecondsRef = useRef(defaultStreamPlaybackSettings.playbackBufferSeconds);
  const suspendPlaybackRef = useRef(false);
  const userEnabledRef = useRef(false);
  const [liveState, setLiveState] = useState<LiveStatusPayload>(initialLiveStatus);
  const [playbackReconnectGeneration, setPlaybackReconnectGeneration] = useState(0);
  const [suspendPlayback, setSuspendPlayback] = useState(() => shouldSuspendPersistentPlayback(pathname, false));
  const [userEnabled, setUserEnabled] = useState(false);
  const primaryPlaybackUrl = getPrimaryPlaybackUrl(liveState);
  const playbackBufferSeconds = liveState.playbackSettings.playbackBufferSeconds;
  const canPlay = Boolean(primaryPlaybackUrl) && liveState.status !== "offline" && !suspendPlayback;
  const persistentAudioActive = userEnabled && canPlay;

  useEffect(() => {
    canPlayRef.current = canPlay;
  }, [canPlay]);

  useEffect(() => {
    playbackBufferSecondsRef.current = playbackBufferSeconds;
  }, [playbackBufferSeconds]);

  useEffect(() => {
    suspendPlaybackRef.current = suspendPlayback;
  }, [suspendPlayback]);

  useEffect(() => {
    userEnabledRef.current = userEnabled;
  }, [userEnabled]);

  useEffect(() => {
    function updateSuspendState() {
      setSuspendPlayback(shouldSuspendPersistentPlayback(pathname, userEnabled));
    }

    function suspendForPageHide() {
      setSuspendPlayback(shouldSuspendPersistentPlayback(pathname, userEnabled));
    }

    updateSuspendState();
    document.addEventListener("visibilitychange", updateSuspendState);
    window.addEventListener("pagehide", suspendForPageHide);
    window.addEventListener("pageshow", updateSuspendState);

    return () => {
      document.removeEventListener("visibilitychange", updateSuspendState);
      window.removeEventListener("pagehide", suspendForPageHide);
      window.removeEventListener("pageshow", updateSuspendState);
    };
  }, [pathname, userEnabled]);

  useEffect(() => {
    setAndroidPersistentAudioActive(persistentAudioActive);
  }, [persistentAudioActive]);

  useEffect(() => {
    return () => {
      setAndroidPersistentAudioActive(false);
    };
  }, []);

  const placeVideo = useCallback((host: HTMLElement, docked: boolean) => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (video.parentElement !== host) {
      host.appendChild(video);
    }

    video.controls = docked;
    video.setAttribute("aria-label", "Primary live stream");
    video.style.backgroundColor = "#000000";
    video.style.objectFit = "contain";
    video.style.pointerEvents = docked ? "auto" : "none";
    video.style.position = docked ? "absolute" : "fixed";
    video.style.inset = docked ? "0" : "auto";
    video.style.left = docked ? "0" : "-9999px";
    video.style.top = docked ? "0" : "0";
    video.style.width = docked ? "100%" : "1px";
    video.style.height = docked ? "100%" : "1px";
    video.style.opacity = docked ? "1" : "0";
    video.style.zIndex = docked ? "1" : "-1";
  }, []);

  const parkVideo = useCallback(() => {
    const parking = parkingRef.current;

    if (parking) {
      placeVideo(parking, false);
    }
  }, [placeVideo]);

  const updateVideoPlacement = useCallback(() => {
    const parking = parkingRef.current;

    if (!parking) {
      return;
    }

    const slot = document.querySelector<HTMLElement>(liveVideoSlotSelector);
    placeVideo(slot ?? parking, Boolean(slot));
  }, [placeVideo]);

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
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const activeVideo = video;

    function rememberAudiblePlayback() {
      if (activeVideo.muted || activeVideo.volume <= 0) {
        return;
      }

      setUserEnabled(true);
      setAudiblePreference(true, activeVideo);
    }

    function enableAudioFromUserGesture() {
      setUserEnabled(true);
      setAudiblePreference(true, activeVideo);
    }

    activeVideo.autoplay = true;
    activeVideo.muted = !userEnabledRef.current;
    activeVideo.playsInline = true;
    activeVideo.preload = "metadata";
    keepNormalPlaybackSpeed(activeVideo);
    activeVideo.addEventListener("pointerdown", enableAudioFromUserGesture);
    activeVideo.addEventListener("keydown", enableAudioFromUserGesture);
    activeVideo.addEventListener("ratechange", resetPlaybackSpeed);
    activeVideo.addEventListener("volumechange", rememberAudiblePlayback);
    activeVideo.addEventListener("ended", recoverLivePlayback);
    window.addEventListener("online", recoverLivePlayback);
    const stopStallWatchdog = installLiveStallWatchdog({
      getCanRecover: () => canPlayRef.current && !suspendPlaybackRef.current,
      getHls: () => hlsRef.current,
      getPlaybackBufferSeconds: () => playbackBufferSecondsRef.current,
      video: activeVideo
    });

    function resetPlaybackSpeed() {
      keepNormalPlaybackSpeed(activeVideo);
    }

    function recoverLivePlayback() {
      if (!canPlayRef.current || suspendPlaybackRef.current) {
        return;
      }

      hlsRef.current?.startLoad(-1);
      activeVideo.muted = !userEnabledRef.current;
      void startBufferedLivePlayback(activeVideo, playbackBufferSecondsRef.current).catch(() => undefined);
    }

    updateVideoPlacement();

    let frame = 0;
    const schedulePlacementUpdate = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updateVideoPlacement();
      });
    };
    const throttledObserver = new MutationObserver(schedulePlacementUpdate);
    throttledObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }

      throttledObserver.disconnect();
      stopStallWatchdog();
      activeVideo.removeEventListener("pointerdown", enableAudioFromUserGesture);
      activeVideo.removeEventListener("keydown", enableAudioFromUserGesture);
      activeVideo.removeEventListener("ratechange", resetPlaybackSpeed);
      activeVideo.removeEventListener("volumechange", rememberAudiblePlayback);
      activeVideo.removeEventListener("ended", recoverLivePlayback);
      window.removeEventListener("online", recoverLivePlayback);
    };
  }, [updateVideoPlacement]);

  useEffect(() => {
    updateVideoPlacement();
  }, [pathname, updateVideoPlacement]);

  useEffect(() => {
    function sameSiteNavigationAwayFromLive(event: Event) {
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

    function parkBeforeNavigation(event: Event) {
      if (sameSiteNavigationAwayFromLive(event)) {
        parkVideo();
      }
    }

    document.addEventListener("pointerdown", parkBeforeNavigation, { capture: true });

    return () => {
      document.removeEventListener("pointerdown", parkBeforeNavigation, { capture: true });
    };
  }, [parkVideo]);

  useEffect(() => {
    if (suspendPlayback) {
      return () => undefined;
    }

    return subscribeToLiveStatus(setLiveState);
  }, [suspendPlayback]);

  useEffect(() => {
    const video = videoRef.current;
    const playbackUrl = primaryPlaybackUrl;
    let cancelled = false;
    let reconnectTimer: number | null = null;
    let mediaRecoveryAttempts = 0;

    function requestFullReconnect(immediate = false) {
      if (cancelled || suspendPlaybackRef.current) {
        return;
      }

      if (immediate && reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      } else if (reconnectTimer !== null) {
        return;
      }

      const delay = immediate ? 0 : reconnectDelayMs(reconnectAttemptRef.current);
      reconnectAttemptRef.current += 1;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        setPlaybackReconnectGeneration((current) => current + 1);
      }, delay);
    }

    function handleOnline() {
      requestFullReconnect(true);
    }

    hlsRef.current?.destroy();
    hlsRef.current = null;

    if (!video) {
      return () => {
        cancelled = true;
      };
    }

    video.removeAttribute("src");
    video.load();

    if (!playbackUrl || !canPlay || suspendPlayback) {
      video.pause();

      return () => {
        cancelled = true;
      };
    }

    window.addEventListener("online", handleOnline);

    if (isLikelyHls(playbackUrl) && Hls.isSupported()) {
      const hls = new Hls(buildLiveHlsConfig(playbackBufferSeconds));
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (cancelled) {
          return;
        }

        reconnectAttemptRef.current = 0;
        mediaRecoveryAttempts = 0;
        video.muted = !userEnabledRef.current;
        keepNormalPlaybackSpeed(video);
        void startBufferedLivePlayback(video, playbackBufferSeconds).catch(() => undefined);
      });
      hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
        if (!data.details.live || cancelled || !video.paused) {
          return;
        }

        video.muted = !userEnabledRef.current;
        void startBufferedLivePlayback(video, playbackBufferSeconds).catch(() => undefined);
      });
      hls.on(Hls.Events.ERROR, (_event, data: ErrorData) => {
        if (!data.fatal || cancelled) {
          return;
        }

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.stopLoad();
          requestFullReconnect();
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveryAttempts < 2) {
          mediaRecoveryAttempts += 1;
          hls.recoverMediaError();
          return;
        }

        requestFullReconnect();
      });
      hls.attachMedia(video);
      hls.loadSource(playbackUrl);

      return () => {
        cancelled = true;
        window.removeEventListener("online", handleOnline);
        if (reconnectTimer !== null) {
          window.clearTimeout(reconnectTimer);
        }
        hls.destroy();
      };
    }

    video.src = playbackUrl;
    keepNormalPlaybackSpeed(video);
    void startBufferedLivePlayback(video, playbackBufferSeconds).catch(() => undefined);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
    };
  }, [canPlay, playbackBufferSeconds, playbackReconnectGeneration, primaryPlaybackUrl, suspendPlayback]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (!canPlay || suspendPlayback) {
      video.pause();
      return;
    }

    video.muted = !userEnabled;
    keepNormalPlaybackSpeed(video);
    void startBufferedLivePlayback(video, playbackBufferSeconds).catch(() => undefined);
  }, [canPlay, playbackBufferSeconds, suspendPlayback, userEnabled]);

  useEffect(() => {
    function enableAudio() {
      setUserEnabled(true);
      setAudiblePreference(true, videoRef.current);

      if (canPlayRef.current && !suspendPlaybackRef.current) {
        if (videoRef.current) {
          keepNormalPlaybackSpeed(videoRef.current);
        }

        if (videoRef.current) {
          void startBufferedLivePlayback(videoRef.current, playbackBufferSecondsRef.current).catch(() => undefined);
        }
      }
    }

    window.addEventListener(liveAudioEnableEvent, enableAudio);
    window.addEventListener("bouncecore:live-video-play", enableAudio);

    return () => {
      window.removeEventListener(liveAudioEnableEvent, enableAudio);
      window.removeEventListener("bouncecore:live-video-play", enableAudio);
    };
  }, []);

  return (
    <div aria-hidden="true" data-persistent-live-parking ref={parkingRef}>
      <video data-persistent-live-video ref={videoRef} />
    </div>
  );
}
