export const liveQualityOptions = ["auto", "720p", "480p"] as const;

export type LiveQualityPreference = (typeof liveQualityOptions)[number];

export type PerformancePreferences = {
  animationsEnabled: boolean;
  animatedMediaEnabled: boolean;
  automaticMobileSaverEnabled: boolean;
  backgroundPlaybackEnabled: boolean;
  batterySaverEnabled: boolean;
  hapticsEnabled: boolean;
  maxLiveQuality: LiveQualityPreference;
  particlesEnabled: boolean;
  realtimeUpdatesEnabled: boolean;
  secondaryVideoEnabled: boolean;
};

export type EffectivePerformancePreferences = PerformancePreferences & {
  automaticSaverActive: boolean;
  batterySaverActive: boolean;
  maxLiveHeight: number | null;
};

export const defaultPerformancePreferences: PerformancePreferences = {
  animationsEnabled: true,
  animatedMediaEnabled: true,
  automaticMobileSaverEnabled: false,
  backgroundPlaybackEnabled: true,
  batterySaverEnabled: false,
  hapticsEnabled: true,
  maxLiveQuality: "auto",
  particlesEnabled: true,
  realtimeUpdatesEnabled: true,
  secondaryVideoEnabled: true
};

export const recommendedMobileProtectionPreferences: PerformancePreferences = {
  ...defaultPerformancePreferences,
  automaticMobileSaverEnabled: true
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function qualityValue(value: unknown): LiveQualityPreference {
  return typeof value === "string" && liveQualityOptions.includes(value as LiveQualityPreference)
    ? (value as LiveQualityPreference)
    : defaultPerformancePreferences.maxLiveQuality;
}

export function mergePerformancePreferences(value: unknown): PerformancePreferences {
  const source = objectValue(value);

  return {
    animationsEnabled: booleanValue(source.animationsEnabled, defaultPerformancePreferences.animationsEnabled),
    animatedMediaEnabled: booleanValue(source.animatedMediaEnabled, defaultPerformancePreferences.animatedMediaEnabled),
    automaticMobileSaverEnabled: booleanValue(
      source.automaticMobileSaverEnabled,
      defaultPerformancePreferences.automaticMobileSaverEnabled
    ),
    backgroundPlaybackEnabled: booleanValue(
      source.backgroundPlaybackEnabled,
      defaultPerformancePreferences.backgroundPlaybackEnabled
    ),
    batterySaverEnabled: booleanValue(source.batterySaverEnabled, defaultPerformancePreferences.batterySaverEnabled),
    hapticsEnabled: booleanValue(source.hapticsEnabled, defaultPerformancePreferences.hapticsEnabled),
    maxLiveQuality: qualityValue(source.maxLiveQuality),
    particlesEnabled: booleanValue(source.particlesEnabled, defaultPerformancePreferences.particlesEnabled),
    realtimeUpdatesEnabled: booleanValue(
      source.realtimeUpdatesEnabled,
      defaultPerformancePreferences.realtimeUpdatesEnabled
    ),
    secondaryVideoEnabled: booleanValue(source.secondaryVideoEnabled, defaultPerformancePreferences.secondaryVideoEnabled)
  };
}

export function effectivePerformancePreferences(
  value: unknown,
  options: { constrainedDevice?: boolean } = {}
): EffectivePerformancePreferences {
  const preferences = mergePerformancePreferences(value);
  const automaticSaverActive = Boolean(options.constrainedDevice && preferences.automaticMobileSaverEnabled);
  const batterySaverActive = preferences.batterySaverEnabled || automaticSaverActive;
  const forcedBatterySaver = preferences.batterySaverEnabled;
  const selectedMaxHeight = preferences.maxLiveQuality === "480p" ? 480 : preferences.maxLiveQuality === "720p" ? 720 : null;

  return {
    ...preferences,
    animationsEnabled: batterySaverActive ? false : preferences.animationsEnabled,
    animatedMediaEnabled: batterySaverActive ? false : preferences.animatedMediaEnabled,
    automaticSaverActive,
    backgroundPlaybackEnabled: forcedBatterySaver ? false : preferences.backgroundPlaybackEnabled,
    batterySaverActive,
    hapticsEnabled: batterySaverActive ? false : preferences.hapticsEnabled,
    maxLiveHeight: batterySaverActive ? Math.min(selectedMaxHeight ?? 480, 480) : selectedMaxHeight,
    particlesEnabled: batterySaverActive ? false : preferences.particlesEnabled,
    realtimeUpdatesEnabled: batterySaverActive ? false : preferences.realtimeUpdatesEnabled,
    secondaryVideoEnabled: batterySaverActive ? false : preferences.secondaryVideoEnabled
  };
}
