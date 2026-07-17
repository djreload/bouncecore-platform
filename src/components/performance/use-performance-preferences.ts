"use client";

import { useEffect, useState } from "react";
import {
  defaultPerformancePreferences,
  effectivePerformancePreferences
} from "@/lib/account/performance-preferences-core";
import {
  currentPerformancePreferences,
  performancePreferencesEvent,
  type PerformancePreferencesSnapshot
} from "@/lib/performance/performance-preferences-client";

const initialSnapshot: PerformancePreferencesSnapshot = {
  effective: effectivePerformancePreferences(defaultPerformancePreferences),
  preferences: defaultPerformancePreferences
};

export function usePerformancePreferences() {
  const [snapshot, setSnapshot] = useState<PerformancePreferencesSnapshot>(initialSnapshot);

  useEffect(() => {
    function handlePreferences(event: Event) {
      const detail = (event as CustomEvent<PerformancePreferencesSnapshot>).detail;

      setSnapshot(detail ?? currentPerformancePreferences());
    }

    window.addEventListener(performancePreferencesEvent, handlePreferences);
    const refreshTimer = window.setTimeout(() => setSnapshot(currentPerformancePreferences()), 0);

    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener(performancePreferencesEvent, handlePreferences);
    };
  }, []);

  return snapshot;
}
