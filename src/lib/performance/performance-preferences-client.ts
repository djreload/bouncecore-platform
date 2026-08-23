"use client";

import {
  defaultPerformancePreferences,
  effectivePerformancePreferences,
  mergePerformancePreferences,
  type EffectivePerformancePreferences,
  type PerformancePreferences
} from "@/lib/account/performance-preferences-core";
import { isBouncecoreAndroidRuntime } from "@/lib/runtime/mobile-app-runtime";

export const performancePreferencesEvent = "bouncecore:performance-preferences";
export const performancePreferencesStorageKey = "bouncecore.performance.preferences";

type AndroidPerformanceBridgeWindow = Window & {
  BouncecoreAndroid?: {
    setPerformancePreferences?: (preferencesJson: string) => void;
  };
};

export type PerformancePreferencesSnapshot = {
  effective: EffectivePerformancePreferences;
  preferences: PerformancePreferences;
};

function connectionSaveDataEnabled() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;

  return connection?.saveData === true;
}

export function constrainedPerformanceDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;

  return (
    isBouncecoreAndroidRuntime() ||
    connectionSaveDataEnabled() ||
    (typeof deviceMemory === "number" && deviceMemory <= 4) ||
    (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4)
  );
}

export function readStoredPerformancePreferences() {
  if (typeof window === "undefined") {
    return defaultPerformancePreferences;
  }

  try {
    const value = window.localStorage.getItem(performancePreferencesStorageKey);

    return value ? mergePerformancePreferences(JSON.parse(value)) : defaultPerformancePreferences;
  } catch {
    return defaultPerformancePreferences;
  }
}

function setBooleanDataset(root: HTMLElement, key: string, value: boolean) {
  root.dataset[key] = value ? "true" : "false";
}

export function performancePreferencesSnapshot(value: unknown): PerformancePreferencesSnapshot {
  const preferences = mergePerformancePreferences(value);

  return {
    effective: effectivePerformancePreferences(preferences, {
      constrainedDevice: constrainedPerformanceDevice()
    }),
    preferences
  };
}

export function applyPerformancePreferences(value: unknown, options: { persist?: boolean } = {}) {
  const snapshot = performancePreferencesSnapshot(value);

  if (typeof document === "undefined") {
    return snapshot;
  }

  const root = document.documentElement;

  setBooleanDataset(root, "bcAnimationsEnabled", snapshot.effective.animationsEnabled);
  setBooleanDataset(root, "bcAnimatedMediaEnabled", snapshot.effective.animatedMediaEnabled);
  setBooleanDataset(root, "bcBackgroundPlaybackEnabled", snapshot.effective.backgroundPlaybackEnabled);
  setBooleanDataset(root, "bcBatterySaver", snapshot.effective.batterySaverActive);
  setBooleanDataset(root, "bcHapticsEnabled", snapshot.effective.hapticsEnabled);
  setBooleanDataset(root, "bcParticlesEnabled", snapshot.effective.particlesEnabled);
  setBooleanDataset(root, "bcRealtimeUpdatesEnabled", snapshot.effective.realtimeUpdatesEnabled);
  setBooleanDataset(root, "bcSecondaryVideoEnabled", snapshot.effective.secondaryVideoEnabled);
  root.dataset.bcMaxLiveHeight = snapshot.effective.maxLiveHeight ? String(snapshot.effective.maxLiveHeight) : "auto";

  if (options.persist !== false) {
    try {
      window.localStorage.setItem(performancePreferencesStorageKey, JSON.stringify(snapshot.preferences));
    } catch {
      // Preferences still apply for this page lifetime when storage is unavailable.
    }
  }

  try {
    (window as AndroidPerformanceBridgeWindow).BouncecoreAndroid?.setPerformancePreferences?.(
      JSON.stringify({
        batterySaverActive: snapshot.effective.batterySaverActive,
        hapticsEnabled: snapshot.effective.hapticsEnabled
      })
    );
  } catch {
    // Older Android shells do not expose performance controls.
  }

  window.dispatchEvent(new CustomEvent<PerformancePreferencesSnapshot>(performancePreferencesEvent, { detail: snapshot }));

  return snapshot;
}

export function currentPerformancePreferences() {
  return performancePreferencesSnapshot(readStoredPerformancePreferences());
}
