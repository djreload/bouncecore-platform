import { defaultStreamPlaybackSettings, normalizePlaybackBufferSeconds } from "@/lib/stream/stream-playback-settings";

const bufferedPlaybackTimeoutMs = 8000;
const liveStallCheckMs = 1000;
const liveStallRecoveryMs = 10_000;
const minimumRecoveryGapMs = 12_000;
const minimumForwardSeekSeconds = 0.35;
const pendingPlaybackStarts = new WeakMap<HTMLVideoElement, Promise<void>>();

export type LiveConnectionTier = "high" | "low" | "medium";

export type LiveConnectionHints = {
  downlink?: number | null;
  effectiveType?: string | null;
  rtt?: number | null;
  saveData?: boolean;
};

export type LiveConnectionProfile = {
  bufferMinimumSeconds: number;
  estimatedBandwidth: number;
  maxAutoHeight: number | null;
  maxBufferLength: number;
  tier: LiveConnectionTier;
};

type BrowserNetworkConnection = LiveConnectionHints & {
  addEventListener?: (type: "change", listener: () => void) => void;
  addListener?: (listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
  removeListener?: (listener: () => void) => void;
};

type LiveHlsController = {
  startLoad: (startPosition?: number) => void;
};

type LiveHlsQualityController = {
  autoLevelCapping: number;
  levels: Array<{
    height?: number;
  }>;
};

type LiveStallWatchdogOptions = {
  getCanRecover?: () => boolean;
  getHls?: () => LiveHlsController | null;
  getPlaybackBufferSeconds: () => number;
  onPlaybackStarted?: () => void;
  video: HTMLVideoElement;
};

const liveConnectionProfiles: Record<LiveConnectionTier, LiveConnectionProfile> = {
  low: {
    bufferMinimumSeconds: 12,
    estimatedBandwidth: 450_000,
    maxAutoHeight: 240,
    maxBufferLength: 60,
    tier: "low"
  },
  medium: {
    bufferMinimumSeconds: 8,
    estimatedBandwidth: 1_400_000,
    maxAutoHeight: 480,
    maxBufferLength: 45,
    tier: "medium"
  },
  high: {
    bufferMinimumSeconds: 0,
    estimatedBandwidth: 3_000_000,
    maxAutoHeight: null,
    maxBufferLength: 30,
    tier: "high"
  }
};

function browserNetworkConnection(): BrowserNetworkConnection | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  return (navigator as Navigator & { connection?: BrowserNetworkConnection }).connection ?? null;
}

export function resolveLiveConnectionProfile(hints: LiveConnectionHints = {}): LiveConnectionProfile {
  const effectiveType = hints.effectiveType?.trim().toLowerCase() ?? "";
  const downlink = typeof hints.downlink === "number" && Number.isFinite(hints.downlink) ? hints.downlink : null;
  const rtt = typeof hints.rtt === "number" && Number.isFinite(hints.rtt) ? hints.rtt : null;

  if (
    hints.saveData === true ||
    effectiveType === "slow-2g" ||
    effectiveType === "2g" ||
    (downlink !== null && downlink <= 1.25) ||
    (rtt !== null && rtt >= 650)
  ) {
    return liveConnectionProfiles.low;
  }

  if (
    effectiveType === "3g" ||
    (downlink !== null && downlink <= 4) ||
    (rtt !== null && rtt >= 250)
  ) {
    return liveConnectionProfiles.medium;
  }

  return liveConnectionProfiles.high;
}

export function currentLiveConnectionProfile() {
  return resolveLiveConnectionProfile(browserNetworkConnection() ?? {});
}

export function connectionAdjustedPlaybackBufferSeconds(
  playbackBufferSeconds: number,
  profile = currentLiveConnectionProfile()
) {
  return normalizePlaybackBufferSeconds(Math.max(playbackBufferSeconds, profile.bufferMinimumSeconds));
}

export function installLiveConnectionAdaptation(onChange: (profile: LiveConnectionProfile) => void) {
  const connection = browserNetworkConnection();

  if (!connection) {
    return () => undefined;
  }

  const handleChange = () => onChange(resolveLiveConnectionProfile(connection));

  if (connection.addEventListener) {
    connection.addEventListener("change", handleChange);
    return () => connection.removeEventListener?.("change", handleChange);
  }

  connection.addListener?.(handleChange);
  return () => connection.removeListener?.(handleChange);
}

export function buildLiveHlsConfig(
  playbackBufferSeconds: number,
  connectionProfile = currentLiveConnectionProfile()
) {
  const bufferSeconds = connectionAdjustedPlaybackBufferSeconds(playbackBufferSeconds, connectionProfile);

  return {
    abrBandWidthFactor: 0.75,
    abrBandWidthUpFactor: 0.6,
    abrEwmaDefaultEstimate: connectionProfile.estimatedBandwidth,
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
    maxBufferLength: Math.max(connectionProfile.maxBufferLength, bufferSeconds + 12),
    maxLiveSyncPlaybackRate: 1,
    startLevel: -1
  };
}

export function applyLiveQualityCap(
  hls: LiveHlsQualityController,
  maxLiveHeight: number | null,
  connectionProfile = currentLiveConnectionProfile()
) {
  const effectiveMaxHeight = [maxLiveHeight, connectionProfile.maxAutoHeight]
    .filter((height): height is number => typeof height === "number" && Number.isFinite(height))
    .reduce<number | null>((lowest, height) => (lowest === null ? height : Math.min(lowest, height)), null);

  if (!effectiveMaxHeight) {
    hls.autoLevelCapping = -1;
    return -1;
  }

  const eligibleLevels = hls.levels
    .map((level, index) => ({ height: level.height ?? Number.POSITIVE_INFINITY, index }))
    .filter((level) => level.height <= effectiveMaxHeight);
  const cappedLevel = eligibleLevels.length
    ? eligibleLevels.reduce((highest, level) => (level.height >= highest.height ? level : highest)).index
    : 0;

  hls.autoLevelCapping = cappedLevel;
  return cappedLevel;
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

  const bufferSeconds = connectionAdjustedPlaybackBufferSeconds(playbackBufferSeconds);
  const end = seekable.end(seekable.length - 1);
  const start = seekable.start(seekable.length - 1);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return;
  }

  const target = Math.max(start, end - bufferSeconds);
  const currentTime = video.currentTime;
  const currentTimeOutsideWindow =
    !Number.isFinite(currentTime) || currentTime < start - minimumForwardSeekSeconds || currentTime > end;

  if (currentTimeOutsideWindow || target > currentTime + minimumForwardSeekSeconds) {
    video.currentTime = target;
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
  const bufferSeconds = connectionAdjustedPlaybackBufferSeconds(playbackBufferSeconds);
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
  keepNormalPlaybackSpeed(video);

  if (!video.paused && !video.ended) {
    onPlaybackStarted?.();
    return;
  }

  const pendingStart = pendingPlaybackStarts.get(video);

  if (pendingStart) {
    return pendingStart;
  }

  const startRequest = (async () => {
    seekToBufferedLivePosition(video, playbackBufferSeconds);
    await waitForLiveBuffer(video, playbackBufferSeconds);

    if (!video.paused && !video.ended) {
      onPlaybackStarted?.();
      return;
    }

    seekToBufferedLivePosition(video, playbackBufferSeconds);
    keepNormalPlaybackSpeed(video);
    await video.play();
    onPlaybackStarted?.();
  })().finally(() => {
    if (pendingPlaybackStarts.get(video) === startRequest) {
      pendingPlaybackStarts.delete(video);
    }
  });

  pendingPlaybackStarts.set(video, startRequest);
  return startRequest;
}

export async function recoverBufferedLivePlayback(
  video: HTMLVideoElement,
  playbackBufferSeconds = defaultStreamPlaybackSettings.playbackBufferSeconds,
  hls?: LiveHlsController | null,
  onPlaybackStarted?: () => void
) {
  if (!video.paused && !video.ended) {
    seekToBufferedLivePosition(video, playbackBufferSeconds);
    keepNormalPlaybackSpeed(video);
    return;
  }

  if (video.ended) {
    hls?.startLoad(-1);
  }

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
  video.addEventListener("stalled", checkForStall);
  video.addEventListener("waiting", checkForStall);

  return () => {
    window.clearInterval(interval);
    video.removeEventListener("canplay", markProgress);
    video.removeEventListener("playing", markProgress);
    video.removeEventListener("timeupdate", markProgress);
    video.removeEventListener("stalled", checkForStall);
    video.removeEventListener("waiting", checkForStall);
  };
}
