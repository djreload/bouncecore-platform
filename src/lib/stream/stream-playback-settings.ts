export type StreamPlaybackSettings = {
  playbackBufferSeconds: number;
  showUpcomingSets: boolean;
};

export type StreamPlaybackSettingsInput = {
  playbackBufferSeconds?: number | string;
  showUpcomingSets?: boolean;
};

export const streamPlaybackBufferLimits = {
  default: 4,
  max: 20,
  min: 1
};

export const defaultStreamPlaybackSettings: StreamPlaybackSettings = {
  playbackBufferSeconds: streamPlaybackBufferLimits.default,
  showUpcomingSets: false
};

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function normalizePlaybackBufferSeconds(value: unknown) {
  const parsed = numberValue(value);

  if (parsed === null) {
    return streamPlaybackBufferLimits.default;
  }

  return Math.min(streamPlaybackBufferLimits.max, Math.max(streamPlaybackBufferLimits.min, Math.round(parsed)));
}

export function normalizeStreamPlaybackSettings(value: unknown): StreamPlaybackSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultStreamPlaybackSettings;
  }

  const settings = value as Partial<Record<keyof StreamPlaybackSettings, unknown>>;

  return {
    playbackBufferSeconds: normalizePlaybackBufferSeconds(settings.playbackBufferSeconds),
    showUpcomingSets: settings.showUpcomingSets === true
  };
}

export function normalizeStreamPlaybackSettingsInput(input: StreamPlaybackSettingsInput): StreamPlaybackSettings {
  return {
    playbackBufferSeconds: normalizePlaybackBufferSeconds(input.playbackBufferSeconds),
    showUpcomingSets: input.showUpcomingSets === true
  };
}
