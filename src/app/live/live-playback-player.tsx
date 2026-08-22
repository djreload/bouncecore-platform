"use client";
/* eslint-disable @next/next/no-img-element */

import Hls from "hls.js";
import type { ErrorData } from "hls.js";
import {
  Eye,
  LoaderCircle,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Radio,
  Settings2,
  Volume2,
  VolumeX,
  WifiOff
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  buildLiveHlsConfig,
  applyLiveQualityCap,
  installLiveStallWatchdog,
  keepNormalPlaybackSpeed,
  seekToBufferedLivePosition,
  startBufferedLivePlayback
} from "@/components/live/live-playback-buffer";
import {
  emptyLivePlayerQualityState,
  livePlayerQualityStateEvent,
  requestLivePlayerQualityState,
  selectLivePlayerQuality,
  type LivePlayerQualityState
} from "@/components/live/live-player-events";
import { mutePersistentLiveAudio, requestPersistentLiveAudio } from "@/components/live/persistent-live-audio";
import { usePerformancePreferences } from "@/components/performance/use-performance-preferences";
import { subscribeToLiveStatus } from "@/components/live/live-status-client";
import { reconnectDelayMs } from "@/lib/realtime/reconnect";
import { cn } from "@/lib/utils";
import type { StreamPlaybackSource } from "@/lib/stream/stream-provider";
import { defaultStreamPlaybackSettings, type StreamPlaybackSettings } from "@/lib/stream/stream-playback-settings";

type LivePlaybackPlayerProps = {
  activeIngests?: StreamPlaybackSource[];
  title: string;
  status: string;
  playbackUrl: string | null;
  offlineImageUrl: string | null;
  playbackSettings?: StreamPlaybackSettings;
  viewerCount: number;
};

type LivePlaybackState = {
  activeIngests: StreamPlaybackSource[];
  title: string;
  status: string;
  playbackUrl: string | null;
  offlineImageUrl: string | null;
  playbackSettings: StreamPlaybackSettings;
  viewerCount: number;
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

function getPageVisible() {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

function usePageVisible() {
  const [pageVisible, setPageVisible] = useState(getPageVisible);

  useEffect(() => {
    function handleVisibilityChange() {
      setPageVisible(getPageVisible());
    }

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return pageVisible;
}

function sourceLabel(source: StreamPlaybackSource | null, fallback: string) {
  return source?.presenterName ?? source?.title ?? fallback;
}

function LivePlayerControls({
  hostRef,
  playbackBufferSeconds,
  status,
  title,
  viewerCount
}: {
  hostRef: RefObject<HTMLElement | null>;
  playbackBufferSeconds: number;
  status: string;
  title: string;
  viewerCount: number;
}) {
  const controlledVideoRef = useRef<HTMLVideoElement | null>(null);
  const controlsHideTimerRef = useRef<number | null>(null);
  const qualityMenuRef = useRef<HTMLDivElement | null>(null);
  const [atLiveEdge, setAtLiveEdge] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [qualityState, setQualityState] = useState<LivePlayerQualityState>(emptyLivePlayerQualityState);
  const [volume, setVolume] = useState(1);

  const clearControlsHideTimer = useCallback(() => {
    if (controlsHideTimerRef.current !== null) {
      window.clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }
  }, []);

  const scheduleControlsHide = useCallback(() => {
    clearControlsHideTimer();
    controlsHideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
      controlsHideTimerRef.current = null;
    }, 3_200);
  }, [clearControlsHideTimer]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    function handlePlayerPress(event: PointerEvent) {
      if (event.pointerType !== "mouse") {
        revealControls();
      }
    }

    host.addEventListener("pointerup", handlePlayerPress);

    return () => {
      host.removeEventListener("pointerup", handlePlayerPress);
      clearControlsHideTimer();
    };
  }, [clearControlsHideTimer, hostRef, revealControls]);

  useEffect(() => {
    if (qualityMenuOpen) {
      clearControlsHideTimer();
      return;
    }

    if (controlsVisible) {
      scheduleControlsHide();
    }
  }, [clearControlsHideTimer, controlsVisible, qualityMenuOpen, scheduleControlsHide]);

  useEffect(() => {
    const host = hostRef.current;
    let activeVideo: HTMLVideoElement | null = null;
    let frame = 0;

    function updateMediaState() {
      const video = controlledVideoRef.current;

      if (!video) {
        return;
      }

      setIsPlaying(!video.paused && !video.ended);
      setMuted(video.muted);
      setVolume(video.volume);

      if (video.seekable.length) {
        const liveEdge = video.seekable.end(video.seekable.length - 1);
        setAtLiveEdge(liveEdge - video.currentTime <= Math.max(4, playbackBufferSeconds + 2));
      }
    }

    function scheduleMediaStateUpdate() {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updateMediaState();
      });
    }

    function connectMediaEvents() {
      const nextVideo = host?.querySelector<HTMLVideoElement>("[data-live-primary-video-slot] video") ?? null;

      if (nextVideo === activeVideo) {
        return;
      }

      if (activeVideo) {
        activeVideo.removeEventListener("play", scheduleMediaStateUpdate);
        activeVideo.removeEventListener("pause", scheduleMediaStateUpdate);
        activeVideo.removeEventListener("timeupdate", scheduleMediaStateUpdate);
        activeVideo.removeEventListener("volumechange", scheduleMediaStateUpdate);
        activeVideo.removeEventListener("waiting", markBuffering);
        activeVideo.removeEventListener("stalled", markBuffering);
        activeVideo.removeEventListener("playing", clearBuffering);
        activeVideo.removeEventListener("canplay", clearBuffering);
      }

      activeVideo = nextVideo;
      controlledVideoRef.current = nextVideo;

      if (activeVideo) {
        activeVideo.addEventListener("play", scheduleMediaStateUpdate);
        activeVideo.addEventListener("pause", scheduleMediaStateUpdate);
        activeVideo.addEventListener("timeupdate", scheduleMediaStateUpdate);
        activeVideo.addEventListener("volumechange", scheduleMediaStateUpdate);
        activeVideo.addEventListener("waiting", markBuffering);
        activeVideo.addEventListener("stalled", markBuffering);
        activeVideo.addEventListener("playing", clearBuffering);
        activeVideo.addEventListener("canplay", clearBuffering);
        updateMediaState();
      }
    }

    function markBuffering() {
      setBuffering(true);
    }

    function clearBuffering() {
      setBuffering(false);
      scheduleMediaStateUpdate();
    }

    connectMediaEvents();
    const observer = host ? new MutationObserver(connectMediaEvents) : null;
    observer?.observe(host as HTMLElement, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      if (activeVideo) {
        activeVideo.removeEventListener("play", scheduleMediaStateUpdate);
        activeVideo.removeEventListener("pause", scheduleMediaStateUpdate);
        activeVideo.removeEventListener("timeupdate", scheduleMediaStateUpdate);
        activeVideo.removeEventListener("volumechange", scheduleMediaStateUpdate);
        activeVideo.removeEventListener("waiting", markBuffering);
        activeVideo.removeEventListener("stalled", markBuffering);
        activeVideo.removeEventListener("playing", clearBuffering);
        activeVideo.removeEventListener("canplay", clearBuffering);
      }
      controlledVideoRef.current = null;
    };
  }, [hostRef, playbackBufferSeconds]);

  useEffect(() => {
    function handleQualityState(event: Event) {
      setQualityState((event as CustomEvent<LivePlayerQualityState>).detail);
    }

    window.addEventListener(livePlayerQualityStateEvent, handleQualityState);
    requestLivePlayerQualityState();

    return () => {
      window.removeEventListener(livePlayerQualityStateEvent, handleQualityState);
    };
  }, []);

  useEffect(() => {
    function handleFullscreenChange() {
      setFullscreen(document.fullscreenElement === hostRef.current);
    }

    function closeQualityMenu(event: PointerEvent) {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(event.target as Node)) {
        setQualityMenuOpen(false);
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("pointerdown", closeQualityMenu);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("pointerdown", closeQualityMenu);
    };
  }, [hostRef]);

  function togglePlayback() {
    const video = controlledVideoRef.current;

    if (!video) {
      return;
    }

    if (!video.paused && !video.ended) {
      video.pause();
      return;
    }

    seekToBufferedLivePosition(video, playbackBufferSeconds);
    if (!video.muted) {
      requestPersistentLiveAudio();
    }
    void video.play().catch(() => undefined);
  }

  function toggleMute() {
    const video = controlledVideoRef.current;

    if (!video) {
      return;
    }

    if (video.muted || video.volume === 0) {
      if (video.volume === 0) {
        video.volume = 0.75;
      }
      video.muted = false;
      requestPersistentLiveAudio();
      return;
    }

    mutePersistentLiveAudio();
  }

  function updateVolume(nextVolume: number) {
    const video = controlledVideoRef.current;

    if (!video) {
      return;
    }

    video.volume = nextVolume;
    video.muted = nextVolume === 0;

    if (nextVolume === 0) {
      mutePersistentLiveAudio();
    }
  }

  function jumpToLive() {
    const video = controlledVideoRef.current;

    if (!video) {
      return;
    }

    seekToBufferedLivePosition(video, playbackBufferSeconds);
    if (!video.muted) {
      requestPersistentLiveAudio();
    }
    void video.play().catch(() => undefined);
  }

  async function toggleFullscreen() {
    const host = hostRef.current;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (host) {
        await host.requestFullscreen();
      }
    } catch {
      // Fullscreen can be unavailable in embedded browsers; playback remains usable inline.
    }
  }

  async function togglePictureInPicture() {
    const video = controlledVideoRef.current;

    if (!video || !document.pictureInPictureEnabled) {
      return;
    }

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      // Some mobile and embedded browsers expose the API but reject the request.
    }
  }

  const selectedQuality =
    qualityState.selectedLevel === -1
      ? qualityState.options.find((option) => option.index === qualityState.activeLevel)?.label
      : qualityState.options.find((option) => option.index === qualityState.selectedLevel)?.label;
  const qualityLabel = qualityState.selectedLevel === -1 ? `Auto${selectedQuality ? ` ${selectedQuality}` : ""}` : selectedQuality ?? "Auto";

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-40 flex flex-col justify-between transition-opacity duration-200 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
        controlsVisible || qualityMenuOpen ? "opacity-100 md:opacity-100" : "opacity-0 md:opacity-0"
      )}
      data-controls-visible={controlsVisible || qualityMenuOpen ? "true" : "false"}
      data-live-player-controls
    >
      <div className="hidden items-start justify-between gap-4 bg-black/65 px-4 py-2 text-white sm:flex">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold sm:text-base">{title}</p>
          <p className="mt-0.5 text-[11px] text-white/75">Live broadcast</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded bg-black/55 px-2 py-1 text-xs font-semibold">
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{viewerCount.toLocaleString("en-GB")}</span>
        </div>
      </div>

      <div className="pointer-events-auto mt-auto flex min-h-12 items-center gap-1.5 bg-black/80 px-2 py-2 text-white sm:gap-2 sm:px-3">
        <button
          aria-label={isPlaying ? "Pause live stream" : "Play live stream"}
          className="bc-focus-ring grid h-9 w-9 shrink-0 place-items-center rounded hover:bg-white/15"
          onClick={togglePlayback}
          title={isPlaying ? "Pause" : "Play"}
          type="button"
        >
          {buffering ? (
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : isPlaying ? (
            <Pause className="h-5 w-5 fill-current" aria-hidden="true" />
          ) : (
            <Play className="h-5 w-5 fill-current" aria-hidden="true" />
          )}
        </button>
        <button
          aria-label={muted || volume === 0 ? "Unmute live stream" : "Mute live stream"}
          className="bc-focus-ring grid h-9 w-9 shrink-0 place-items-center rounded hover:bg-white/15"
          onClick={toggleMute}
          title={muted || volume === 0 ? "Unmute" : "Mute"}
          type="button"
        >
          {muted || volume === 0 ? <VolumeX className="h-5 w-5" aria-hidden="true" /> : <Volume2 className="h-5 w-5" aria-hidden="true" />}
        </button>
        <input
          aria-label="Live stream volume"
          className="hidden h-1.5 w-20 cursor-pointer accent-bc-electric sm:block lg:w-24"
          max={1}
          min={0}
          onChange={(event) => updateVolume(Number(event.target.value))}
          step={0.05}
          type="range"
          value={muted ? 0 : volume}
        />
        <button
          className="bc-focus-ring ml-0.5 inline-flex h-9 shrink-0 items-center gap-1.5 rounded px-2 text-xs font-black uppercase hover:bg-white/15"
          onClick={jumpToLive}
          title="Jump to live"
          type="button"
        >
          <span className={cn("h-2 w-2 rounded-full", atLiveEdge && status === "live" ? "bg-red-500" : "bg-white/45")} />
          Live
        </button>
        <div className="ml-auto flex items-center gap-1">
          <span className="hidden items-center gap-1.5 px-2 text-xs font-semibold text-white/85 sm:inline-flex">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            {viewerCount.toLocaleString("en-GB")}
          </span>
          <div className="relative" ref={qualityMenuRef}>
            <button
              aria-expanded={qualityMenuOpen}
              aria-haspopup="menu"
              className="bc-focus-ring inline-flex h-9 items-center gap-1.5 rounded px-2 text-xs font-semibold hover:bg-white/15"
              onClick={() => setQualityMenuOpen((current) => !current)}
              title="Video quality"
              type="button"
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              <span className="max-w-20 truncate">{qualityLabel}</span>
            </button>
            {qualityMenuOpen ? (
              <div className="absolute bottom-full right-0 mb-2 min-w-36 overflow-hidden rounded-md border border-white/20 bg-[#090b12]/98 p-1 shadow-2xl" role="menu">
                <button
                  className={cn(
                    "bc-focus-ring flex w-full items-center justify-between rounded px-3 py-2 text-left text-xs font-semibold hover:bg-white/10",
                    qualityState.selectedLevel === -1 ? "text-bc-electric" : "text-white"
                  )}
                  onClick={() => {
                    selectLivePlayerQuality(-1);
                    setQualityMenuOpen(false);
                  }}
                  role="menuitem"
                  type="button"
                >
                  Auto
                  {qualityState.selectedLevel === -1 ? <span aria-hidden="true">&#10003;</span> : null}
                </button>
                {qualityState.options.map((option) => (
                  <button
                    className={cn(
                      "bc-focus-ring flex w-full items-center justify-between rounded px-3 py-2 text-left text-xs font-semibold hover:bg-white/10",
                      qualityState.selectedLevel === option.index ? "text-bc-electric" : "text-white"
                    )}
                    key={option.index}
                    onClick={() => {
                      selectLivePlayerQuality(option.index);
                      setQualityMenuOpen(false);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    {option.label}
                    {qualityState.selectedLevel === option.index ? <span aria-hidden="true">&#10003;</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button
            aria-label="Picture in picture"
            className="bc-focus-ring hidden h-9 w-9 place-items-center rounded hover:bg-white/15 sm:grid"
            onClick={() => void togglePictureInPicture()}
            title="Picture in picture"
            type="button"
          >
            <PictureInPicture2 className="h-4.5 w-4.5" aria-hidden="true" />
          </button>
          <button
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="bc-focus-ring grid h-9 w-9 place-items-center rounded hover:bg-white/15"
            onClick={() => void toggleFullscreen()}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            type="button"
          >
            {fullscreen ? <Minimize className="h-5 w-5" aria-hidden="true" /> : <Maximize className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function HlsVideo({
  ariaLabel,
  className,
  controls,
  muted,
  onPlaybackStarted,
  maxLiveHeight,
  playbackBufferSeconds,
  playbackUrl
}: {
  ariaLabel: string;
  className?: string;
  controls?: boolean;
  muted: boolean;
  onPlaybackStarted?: () => void;
  maxLiveHeight: number | null;
  playbackBufferSeconds: number;
  playbackUrl: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const reconnectAttemptRef = useRef(0);
  const [reconnectGeneration, setReconnectGeneration] = useState(0);
  const pageVisible = usePageVisible();

  useEffect(() => {
    const video = videoRef.current;
    let cancelled = false;

    if (!video) {
      return () => {
        cancelled = true;
      };
    }

    const activeVideo = video;
    let reconnectTimer: number | null = null;
    let mediaRecoveryAttempts = 0;

    hlsRef.current?.destroy();
    hlsRef.current = null;
    activeVideo.removeAttribute("src");
    activeVideo.load();
    keepNormalPlaybackSpeed(activeVideo);

    if (!pageVisible) {
      activeVideo.pause();

      return () => {
        cancelled = true;
      };
    }

    function recoverLivePlayback() {
      hlsRef.current?.startLoad(-1);
      void startBufferedLivePlayback(activeVideo, playbackBufferSeconds, onPlaybackStarted).catch(() => undefined);
    }

    function requestFullReconnect(immediate = false) {
      if (cancelled || !pageVisible) {
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
        setReconnectGeneration((current) => current + 1);
      }, delay);
    }

    function handleOnline() {
      requestFullReconnect(true);
    }

    function resetPlaybackSpeed() {
      keepNormalPlaybackSpeed(activeVideo);
    }

    activeVideo.addEventListener("ended", recoverLivePlayback);
    activeVideo.addEventListener("ratechange", resetPlaybackSpeed);
    window.addEventListener("online", handleOnline);
    const stopStallWatchdog = installLiveStallWatchdog({
      getCanRecover: () => !cancelled && pageVisible,
      getHls: () => hlsRef.current,
      getPlaybackBufferSeconds: () => playbackBufferSeconds,
      onPlaybackStarted,
      video: activeVideo
    });

    const hlsPlayback = isLikelyHls(playbackUrl);

    if (hlsPlayback && Hls.isSupported()) {
      const hls = new Hls(buildLiveHlsConfig(playbackBufferSeconds));
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!cancelled) {
          applyLiveQualityCap(hls, maxLiveHeight);
          reconnectAttemptRef.current = 0;
          mediaRecoveryAttempts = 0;
          void startBufferedLivePlayback(activeVideo, playbackBufferSeconds, onPlaybackStarted).catch(() => undefined);
        }
      });
      hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
        if (!data.details.live || cancelled || !activeVideo.paused) {
          return;
        }

        void startBufferedLivePlayback(activeVideo, playbackBufferSeconds, onPlaybackStarted).catch(() => undefined);
      });

      hls.on(Hls.Events.ERROR, (_event, data: ErrorData) => {
        if (cancelled || !data.fatal) {
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

      hls.attachMedia(activeVideo);
      hls.loadSource(playbackUrl);

      return () => {
        cancelled = true;
        stopStallWatchdog();
        activeVideo.removeEventListener("ended", recoverLivePlayback);
        activeVideo.removeEventListener("ratechange", resetPlaybackSpeed);
        window.removeEventListener("online", handleOnline);
        if (reconnectTimer !== null) {
          window.clearTimeout(reconnectTimer);
        }
        hls.destroy();
      };
    }

    activeVideo.src = playbackUrl;
    keepNormalPlaybackSpeed(activeVideo);
    void startBufferedLivePlayback(activeVideo, playbackBufferSeconds, onPlaybackStarted).catch(() => undefined);

    return () => {
      cancelled = true;
      stopStallWatchdog();
      activeVideo.removeEventListener("ended", recoverLivePlayback);
      activeVideo.removeEventListener("ratechange", resetPlaybackSpeed);
      window.removeEventListener("online", handleOnline);
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
    };
  }, [maxLiveHeight, onPlaybackStarted, pageVisible, playbackBufferSeconds, playbackUrl, reconnectGeneration]);

  return (
    <video
      aria-label={ariaLabel}
      autoPlay
      className={className}
      controls={controls}
      muted={muted}
      onPlay={onPlaybackStarted}
      playsInline
      preload="auto"
      ref={videoRef}
    />
  );
}

export function LivePlaybackPlayer({
  activeIngests = [],
  title,
  status,
  playbackUrl,
  offlineImageUrl,
  playbackSettings = defaultStreamPlaybackSettings,
  viewerCount
}: LivePlaybackPlayerProps) {
  const playerRef = useRef<HTMLElement | null>(null);
  const { effective: performancePreferences } = usePerformancePreferences();
  const [liveState, setLiveState] = useState<LivePlaybackState>({
    activeIngests,
    title,
    status,
    playbackUrl,
    offlineImageUrl,
    playbackSettings,
    viewerCount
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
  const hasSecondaryPlayback = Boolean(
    performancePreferences.secondaryVideoEnabled &&
      canAttemptPlayback &&
      secondaryPlaybackUrl &&
      liveState.activeIngests.length > 1
  );

  useEffect(() => {
    return subscribeToLiveStatus((payload) => {
      setLiveState((current) => ({
        activeIngests: payload.status === "offline" ? [] : payload.activeIngests,
        title: payload.channel?.title ?? current.title,
        status: payload.status,
        playbackUrl: payload.playbackUrl,
        offlineImageUrl: payload.offlineImageUrl,
        playbackSettings: payload.playbackSettings,
        viewerCount: payload.viewerCount
      }));
    });
  }, []);

  return (
    <section
      className={cn(
        "group bc-scanlines relative aspect-video overflow-hidden border-y border-bc-line bg-black shadow-2xl shadow-bc-electric/10 fullscreen:h-screen fullscreen:w-screen fullscreen:rounded-none fullscreen:border-0 lg:rounded-t-md lg:border-x"
      )}
      ref={playerRef}
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
        <div className="absolute left-2 top-2 z-20 max-w-40 rounded border border-bc-pink/55 bg-black/65 px-2 py-1 text-left shadow-md shadow-black/30 backdrop-blur-sm">
          <p className="text-[8px] font-black uppercase text-bc-pink">Live now</p>
          <p className="truncate text-[11px] font-black leading-tight text-white">{sourceLabel(primarySource, "Main DJ")}</p>
        </div>
      ) : null}

      {hasSecondaryPlayback && secondaryPlaybackUrl ? (
        <div className="absolute bottom-12 right-2 z-30 w-[clamp(9rem,22%,20rem)] overflow-hidden rounded border-2 border-[#22c55e]/80 bg-black shadow-[0_8px_24px_rgba(0,0,0,0.6)] max-sm:bottom-11 max-sm:right-1.5 max-sm:w-[38%]">
          <div className="relative aspect-video bg-black">
            <HlsVideo
              ariaLabel={secondarySource?.presenterName ? `${secondarySource.presenterName} secondary stream` : "Secondary live stream"}
              className="absolute inset-0 h-full w-full bg-black object-contain"
              muted
              maxLiveHeight={performancePreferences.maxLiveHeight}
              playbackBufferSeconds={liveState.playbackSettings.playbackBufferSeconds}
              playbackUrl={secondaryPlaybackUrl}
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-1 bg-gradient-to-b from-black/80 via-black/25 to-transparent p-1.5 max-sm:p-1">
              <div className="min-w-0">
                <p className="text-[8px] font-black uppercase text-[#22c55e] max-sm:hidden">Up next</p>
                <p className="truncate text-[11px] font-black leading-tight text-white max-sm:text-[9px]">
                  {sourceLabel(secondarySource, "Next DJ")}
                </p>
              </div>
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-sm bg-black/60 text-[#22c55e] max-sm:h-4 max-sm:w-4" title="Secondary stream muted">
                <VolumeX className="h-3 w-3" aria-hidden="true" />
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {hasSecondaryPlayback ? (
        <div className="absolute right-2 top-2 z-20 rounded border border-bc-line/70 bg-black/65 px-1.5 py-1 text-[9px] font-black text-white backdrop-blur-sm">
          {liveState.activeIngests.length} DJs connected
        </div>
      ) : null}

      {canAttemptPlayback ? (
        <LivePlayerControls
          hostRef={playerRef}
          playbackBufferSeconds={liveState.playbackSettings.playbackBufferSeconds}
          status={liveState.status}
          title={liveState.title}
          viewerCount={liveState.viewerCount}
        />
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
