import { defaultStreamPlaybackSettings, normalizePlaybackBufferSeconds } from "@/lib/stream/stream-playback-settings";

const bufferedPlaybackTimeoutMs = 8000;
const liveStallCheckMs = 1000;
const liveStallRecoveryMs = 5000;
const minimumRecoveryGapMs = 4500;

type LiveHlsController = {
  startLoad: (startPosition?: number) => void;
};

type LiveStallWatchdogOptions = {
  getCanRecover?: () => boolean;
  getHls?: () => LiveHlsController | null;
  getPlaybackBufferSeconds: () => number;
  onPlaybackStarted?: () => void;
  video: HTMLVideoElement;
};

export function buildLiveHlsConfig(playbackBufferSeconds: number) {
  const bufferSeconds = normalizePlaybackBufferSeconds(playbackBufferSeconds);

  return {
    abrEwmaDefaultEstimate: 3_000_000,
    backBufferLength: 30,
    capLevelToPlayerSize: true,
    enableWorker: true,
    fragLoadingMaxRetry: 8,
    levelLoadingMaxRetry: 8,
    liveDurationInfinity: true,
    liveMaxLatencyDuration: Math.max(bufferSeconds + 8, bufferSeconds * 2),
    liveSyncDuration: bufferSeconds,
    lowLatencyMode: bufferSeconds <= 2,
    manifestLoadingMaxRetry: 8,
    maxBufferLength: Math.max(30, bufferSeconds + 12),
    maxLiveSyncPlaybackRate: 1,
    startLevel: -1
  };
}

export function keepNormalPlaybackSpeed(video: HTMLVideoElement) {
  video.defaultPlaybackRate = 1;

  if (video.playbackRate !== 1) {
    video.playbackRate = 1;
  }
}

export function seekToBufferedLivePosition(video: HTMLVideoElement, playbackBufferSeconds: number) {
  const seekable = video.seekable;

  if (!seekable.length) {
    return;
  }

  const bufferSeconds = normalizePlaybackBufferSeconds(playbackBufferSeconds);
  const end = seekable.end(seekable.length - 1);
  const start = seekable.start(seekable.length - 1);

  if (Number.isFinite(end)) {
    video.currentTime = Math.max(start, end - bufferSeconds);
  }
}

function bufferedAheadSeconds(video: HTMLVideoElement) {
  for (let index = 0; index < video.buffered.length; index += 1) {
    const start = video.buffered.start(index);
    const end = video.buffered.end(index);

    if (video.currentTime >= start - 0.2 && video.currentTime <= end + 0.2) {
      return Math.max(0, end - video.currentTime);
    }
  }

  return 0;
}

function hasEnoughBuffer(video: HTMLVideoElement, playbackBufferSeconds: number) {
  const bufferSeconds = normalizePlaybackBufferSeconds(playbackBufferSeconds);
  const minimumReadySeconds = Math.min(4, Math.max(1, bufferSeconds / 2));

  return video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA || bufferedAheadSeconds(video) >= minimumReadySeconds;
}

export function waitForLiveBuffer(video: HTMLVideoElement, playbackBufferSeconds: number) {
  if (hasEnoughBuffer(video, playbackBufferSeconds)) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let resolved = false;
    const events = ["canplay", "loadeddata", "progress", "timeupdate"] as const;
    const timeout = window.setTimeout(finish, bufferedPlaybackTimeoutMs);

    function finish() {
      if (resolved) {
        return;
      }

      resolved = true;
      window.clearTimeout(timeout);

      for (const eventName of events) {
        video.removeEventListener(eventName, check);
      }

      resolve();
    }

    function check() {
      if (hasEnoughBuffer(video, playbackBufferSeconds)) {
        finish();
      }
    }

    for (const eventName of events) {
      video.addEventListener(eventName, check);
    }
  });
}

export async function startBufferedLivePlayback(
  video: HTMLVideoElement,
  playbackBufferSeconds = defaultStreamPlaybackSettings.playbackBufferSeconds,
  onPlaybackStarted?: () => void
) {
  seekToBufferedLivePosition(video, playbackBufferSeconds);
  keepNormalPlaybackSpeed(video);
  await waitForLiveBuffer(video, playbackBufferSeconds);
  keepNormalPlaybackSpeed(video);
  await video.play();
  onPlaybackStarted?.();
}

export async function recoverBufferedLivePlayback(
  video: HTMLVideoElement,
  playbackBufferSeconds = defaultStreamPlaybackSettings.playbackBufferSeconds,
  hls?: LiveHlsController | null,
  onPlaybackStarted?: () => void
) {
  hls?.startLoad(-1);
  await startBufferedLivePlayback(video, playbackBufferSeconds, onPlaybackStarted);
}

export function installLiveStallWatchdog({
  getCanRecover,
  getHls,
  getPlaybackBufferSeconds,
  onPlaybackStarted,
  video
}: LiveStallWatchdogOptions) {
  let lastObservedTime = video.currentTime;
  let lastProgressAt = Date.now();
  let lastRecoveryAt = 0;
  let recovering = false;

  function canRecover() {
    return getCanRecover?.() !== false;
  }

  function markProgress() {
    const currentTime = video.currentTime;

    if (Math.abs(currentTime - lastObservedTime) > 0.25) {
      lastObservedTime = currentTime;
      lastProgressAt = Date.now();
    }

    keepNormalPlaybackSpeed(video);
  }

  function recoverIfNeeded() {
    if (!canRecover() || recovering) {
      return;
    }

    const now = Date.now();

    if (now - lastRecoveryAt < minimumRecoveryGapMs) {
      return;
    }

    recovering = true;
    lastRecoveryAt = now;
    lastProgressAt = now;

    void recoverBufferedLivePlayback(video, getPlaybackBufferSeconds(), getHls?.(), onPlaybackStarted)
      .catch(() => undefined)
      .finally(() => {
        recovering = false;
      });
  }

  function checkForStall() {
    if (!canRecover()) {
      return;
    }

    markProgress();

    if (video.ended || (!video.paused && !video.seeking && Date.now() - lastProgressAt >= liveStallRecoveryMs)) {
      recoverIfNeeded();
    }
  }

  const interval = window.setInterval(checkForStall, liveStallCheckMs);
  video.addEventListener("canplay", markProgress);
  video.addEventListener("playing", markProgress);
  video.addEventListener("timeupdate", markProgress);
  video.addEventListener("stalled", recoverIfNeeded);
  video.addEventListener("waiting", recoverIfNeeded);

  return () => {
    window.clearInterval(interval);
    video.removeEventListener("canplay", markProgress);
    video.removeEventListener("playing", markProgress);
    video.removeEventListener("timeupdate", markProgress);
    video.removeEventListener("stalled", recoverIfNeeded);
    video.removeEventListener("waiting", recoverIfNeeded);
  };
}
