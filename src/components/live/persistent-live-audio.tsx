"use client";

import Hls from "hls.js";
import type { ErrorData } from "hls.js";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildLiveHlsConfig,
  applyLiveQualityCap,
  installLiveConnectionAdaptation,
  installLiveStallWatchdog,
  keepNormalPlaybackSpeed,
  recoverBufferedLivePlayback,
  startBufferedLivePlayback
} from "@/components/live/live-playback-buffer";
import {
  emptyLivePlayerQualityState,
  livePlayerQualityRequestEvent,
  livePlayerQualityStateRequestEvent,
  publishLivePlayerQualityState,
  type LivePlayerQualityOption,
  type LivePlayerQualityState
} from "@/components/live/live-player-events";
import {
  liveAudioFocusChangeEvent,
  shouldMuteLiveAudio,
  type LiveAudioFocusChangeDetail
} from "@/components/live/live-audio-focus";
import { usePerformancePreferences } from "@/components/performance/use-performance-preferences";
import { subscribeToLiveStatus, type LiveStatusPayload } from "@/components/live/live-status-client";
import { reconnectDelayMs } from "@/lib/realtime/reconnect";
import { isBouncecoreAndroidRuntime } from "@/lib/runtime/mobile-app-runtime";
import { defaultStreamPlaybackSettings } from "@/lib/stream/stream-playback-settings";

const liveAudioEnabledStorageKey = "bouncecore.liveAudio.enabled";
const liveAudioEnableEvent = "bouncecore:live-audio-enable";
const liveAudioDisableEvent = "bouncecore:live-audio-disable";
const liveVideoSlotSelector = '[data-live-primary-video-slot="true"]';

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

function setAudiblePreference(enabled: boolean, video?: HTMLVideoElement | null, temporaryAudioFocus = false) {
  if (video) {
    video.muted = shouldMuteLiveAudio(enabled, temporaryAudioFocus);
  }

  storeAudioEnabled(enabled);
}

function isLivePath(pathname: string | null) {
  return pathname === "/live" || Boolean(pathname?.startsWith("/live/"));
}

export function shouldSuspendPersistentPlayback(
  pathname: string | null,
  userEnabled: boolean,
  backgroundPlaybackEnabled = true,
  pageHidden = typeof document !== "undefined" && document.visibilityState === "hidden"
) {
  if (backgroundPlaybackEnabled && userEnabled) {
    return false;
  }

  return pageHidden || !isLivePath(pathname);
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

export function mutePersistentLiveAudio() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(liveAudioDisableEvent));
}

function qualityOptions(hls: Hls, maxLiveHeight: number | null): LivePlayerQualityOption[] {
  const byHeight = new Map<string, LivePlayerQualityOption>();

  hls.levels.forEach((level, index) => {
    const height = level.height || null;

    if (maxLiveHeight && height && height > maxLiveHeight) {
      return;
    }

    const key = height ? String(height) : `level-${index}`;
    const option = {
      bitrate: level.bitrate || null,
      height,
      index,
      label: height ? `${height}p` : `Quality ${index + 1}`
    };
    const existing = byHeight.get(key);

    if (!existing || (option.bitrate ?? 0) > (existing.bitrate ?? 0)) {
      byHeight.set(key, option);
    }
  });

  return Array.from(byHeight.values()).sort((left, right) => (right.height ?? 0) - (left.height ?? 0));
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
  const { effective: performancePreferences } = usePerformancePreferences();
  const parkingRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const reconnectAttemptRef = useRef(0);
  const audioFocusHoldersRef = useRef(new Set<string>());
  const audioFocusSuppressedRef = useRef(false);
  const canPlayRef = useRef(false);
  const playbackBufferSecondsRef = useRef(defaultStreamPlaybackSettings.playbackBufferSeconds);
  const qualityStateRef = useRef<LivePlayerQualityState>(emptyLivePlayerQualityState);
  const suspendPlaybackRef = useRef(false);
  const userEnabledRef = useRef(false);
  const [liveState, setLiveState] = useState<LiveStatusPayload>(initialLiveStatus);
  const [playbackReconnectGeneration, setPlaybackReconnectGeneration] = useState(0);
  const [suspendPlayback, setSuspendPlayback] = useState(() =>
    shouldSuspendPersistentPlayback(pathname, false, performancePreferences.backgroundPlaybackEnabled)
  );
  const [userEnabled, setUserEnabled] = useState(false);
  const primaryPlaybackUrl = getPrimaryPlaybackUrl(liveState);
  const playbackBufferSeconds = liveState.playbackSettings.playbackBufferSeconds;
  const canPlay = Boolean(primaryPlaybackUrl) && liveState.status !== "offline" && !suspendPlayback;
  const persistentAudioActive = userEnabled && canPlay && performancePreferences.backgroundPlaybackEnabled;

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
    const audioFocusHolders = audioFocusHoldersRef.current;

    function handleAudioFocusChange(event: Event) {
      const detail = (event as CustomEvent<LiveAudioFocusChangeDetail>).detail;

      if (!detail || typeof detail.sourceId !== "string" || typeof detail.active !== "boolean") {
        return;
      }

      if (detail.active) {
        audioFocusHolders.add(detail.sourceId);
      } else {
        audioFocusHolders.delete(detail.sourceId);
      }

      audioFocusSuppressedRef.current = audioFocusHolders.size > 0;

      if (videoRef.current) {
        videoRef.current.muted = shouldMuteLiveAudio(userEnabledRef.current, audioFocusSuppressedRef.current);
      }
    }

    window.addEventListener(liveAudioFocusChangeEvent, handleAudioFocusChange);

    return () => {
      window.removeEventListener(liveAudioFocusChangeEvent, handleAudioFocusChange);
      audioFocusHolders.clear();
      audioFocusSuppressedRef.current = false;
    };
  }, []);

  useEffect(() => {
    function updateSuspendState() {
      setSuspendPlayback(
        shouldSuspendPersistentPlayback(pathname, userEnabled, performancePreferences.backgroundPlaybackEnabled)
      );
    }

    function suspendForPageHide() {
      setSuspendPlayback(
        shouldSuspendPersistentPlayback(pathname, userEnabled, performancePreferences.backgroundPlaybackEnabled)
      );
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
  }, [pathname, performancePreferences.backgroundPlaybackEnabled, userEnabled]);

  useEffect(() => {
    setAndroidPersistentAudioActive(persistentAudioActive);
  }, [persistentAudioActive]);

  useEffect(() => {
    return () => {
      setAndroidPersistentAudioActive(false);
    };
  }, []);

  useEffect(() => {
    function publishCurrentQualityState() {
      publishLivePlayerQualityState(qualityStateRef.current);
    }

    window.addEventListener(livePlayerQualityStateRequestEvent, publishCurrentQualityState);

    return () => {
      window.removeEventListener(livePlayerQualityStateRequestEvent, publishCurrentQualityState);
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

    video.controls = false;
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
      setAudiblePreference(true, activeVideo, audioFocusSuppressedRef.current);
    }

    function enableAudioFromUserGesture() {
      setUserEnabled(true);
      setAudiblePreference(true, activeVideo, audioFocusSuppressedRef.current);
    }

    activeVideo.autoplay = true;
    activeVideo.muted = shouldMuteLiveAudio(userEnabledRef.current, audioFocusSuppressedRef.current);
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

      activeVideo.muted = shouldMuteLiveAudio(userEnabledRef.current, audioFocusSuppressedRef.current);
      void recoverBufferedLivePlayback(
        activeVideo,
        playbackBufferSecondsRef.current,
        hlsRef.current
      ).catch(() => undefined);
    }

    updateVideoPlacement();

    return () => {
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
    if (!canPlay || !isLivePath(pathname)) {
      parkVideo();
      return;
    }

    updateVideoPlacement();

    if (document.querySelector(liveVideoSlotSelector)) {
      return;
    }

    let frame = 0;
    const observer = new MutationObserver(() => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0;

        if (document.querySelector(liveVideoSlotSelector)) {
          updateVideoPlacement();
          observer.disconnect();
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      observer.disconnect();

      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [canPlay, parkVideo, pathname, updateVideoPlacement]);

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
    qualityStateRef.current = emptyLivePlayerQualityState;
    publishLivePlayerQualityState(qualityStateRef.current);

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
      let selectedQualityLevel = -1;
      hlsRef.current = hls;
      const stopConnectionAdaptation = installLiveConnectionAdaptation((profile) => {
        if (cancelled || selectedQualityLevel !== -1 || !hls.levels.length) {
          return;
        }

        applyLiveQualityCap(hls, performancePreferences.maxLiveHeight, profile);
        updateQualityState();
      });

      function updateQualityState(activeLevel = hls.currentLevel) {
        qualityStateRef.current = {
          activeLevel,
          options: qualityOptions(hls, performancePreferences.maxLiveHeight),
          selectedLevel: selectedQualityLevel
        };
        publishLivePlayerQualityState(qualityStateRef.current);
      }

      function handleQualityRequest(event: Event) {
        const requestedLevel = (event as CustomEvent<{ level?: unknown }>).detail?.level;

        if (typeof requestedLevel !== "number" || !Number.isInteger(requestedLevel)) {
          return;
        }

        if (requestedLevel === -1) {
          selectedQualityLevel = -1;
          applyLiveQualityCap(hls, performancePreferences.maxLiveHeight);
          hls.currentLevel = -1;
          updateQualityState();
          return;
        }

        if (!qualityOptions(hls, performancePreferences.maxLiveHeight).some((option) => option.index === requestedLevel)) {
          return;
        }

        selectedQualityLevel = requestedLevel;
        hls.currentLevel = requestedLevel;
        updateQualityState(requestedLevel);
      }

      window.addEventListener(livePlayerQualityRequestEvent, handleQualityRequest);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (cancelled) {
          return;
        }

        applyLiveQualityCap(hls, performancePreferences.maxLiveHeight);
        updateQualityState();
        reconnectAttemptRef.current = 0;
        mediaRecoveryAttempts = 0;
        video.muted = shouldMuteLiveAudio(userEnabledRef.current, audioFocusSuppressedRef.current);
        keepNormalPlaybackSpeed(video);
        void startBufferedLivePlayback(video, playbackBufferSeconds).catch(() => undefined);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        updateQualityState(data.level);
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
        window.removeEventListener(livePlayerQualityRequestEvent, handleQualityRequest);
        stopConnectionAdaptation();
        qualityStateRef.current = emptyLivePlayerQualityState;
        publishLivePlayerQualityState(qualityStateRef.current);
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
  }, [
    canPlay,
    performancePreferences.maxLiveHeight,
    playbackBufferSeconds,
    playbackReconnectGeneration,
    primaryPlaybackUrl,
    suspendPlayback
  ]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (!canPlay || suspendPlayback) {
      video.pause();
      return;
    }

    video.muted = shouldMuteLiveAudio(userEnabled, audioFocusSuppressedRef.current);
    keepNormalPlaybackSpeed(video);
    void startBufferedLivePlayback(video, playbackBufferSeconds).catch(() => undefined);
  }, [canPlay, playbackBufferSeconds, suspendPlayback, userEnabled]);

  useEffect(() => {
    function enableAudio() {
      setUserEnabled(true);
      setAudiblePreference(true, videoRef.current, audioFocusSuppressedRef.current);

      if (canPlayRef.current && !suspendPlaybackRef.current) {
        if (videoRef.current) {
          keepNormalPlaybackSpeed(videoRef.current);
        }

        if (videoRef.current) {
          void startBufferedLivePlayback(videoRef.current, playbackBufferSecondsRef.current).catch(() => undefined);
        }
      }
    }

    function disableAudio() {
      setUserEnabled(false);
      setAudiblePreference(false, videoRef.current);
    }

    window.addEventListener(liveAudioEnableEvent, enableAudio);
    window.addEventListener(liveAudioDisableEvent, disableAudio);
    window.addEventListener("bouncecore:live-video-play", enableAudio);

    return () => {
      window.removeEventListener(liveAudioEnableEvent, enableAudio);
      window.removeEventListener(liveAudioDisableEvent, disableAudio);
      window.removeEventListener("bouncecore:live-video-play", enableAudio);
    };
  }, []);

  return (
    <div aria-hidden="true" data-persistent-live-parking ref={parkingRef}>
      <video data-persistent-live-video ref={videoRef} />
    </div>
  );
}
