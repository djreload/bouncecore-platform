"use client";

import { useEffect } from "react";
import { isBouncecoreAndroidUserAgent } from "@/lib/runtime/mobile-app-runtime";
import {
  applyPerformancePreferences,
  readStoredPerformancePreferences
} from "@/lib/performance/performance-preferences-client";

type PerformancePreferencesResponse = {
  preferences?: unknown;
};

export function BrowserResourceSaver() {
  useEffect(() => {
    const root = document.documentElement;
    const isAndroidWebView = isBouncecoreAndroidUserAgent(window.navigator.userAgent);
    const controller = new AbortController();
    const connection = (
      navigator as Navigator & {
        connection?: EventTarget;
      }
    ).connection;

    root.dataset.bcAndroidWebview = isAndroidWebView ? "true" : "false";
    applyPerformancePreferences(readStoredPerformancePreferences(), { persist: false });

    function applyVisibilityState() {
      root.dataset.bcPageVisibility = document.visibilityState;
      root.classList.toggle("bc-page-hidden", document.visibilityState === "hidden");
    }

    applyVisibilityState();
    document.addEventListener("visibilitychange", applyVisibilityState);

    function refreshConstrainedDeviceState() {
      applyPerformancePreferences(readStoredPerformancePreferences(), { persist: false });
    }

    connection?.addEventListener("change", refreshConstrainedDeviceState);

    void fetch("/api/account/performance", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal
    })
      .then(async (response) => (response.ok ? ((await response.json()) as PerformancePreferencesResponse) : null))
      .then((payload) => {
        if (payload?.preferences) {
          applyPerformancePreferences(payload.preferences);
        }
      })
      .catch(() => {
        // Stored/default preferences remain active when the account endpoint is unavailable.
      });

    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", applyVisibilityState);
      connection?.removeEventListener("change", refreshConstrainedDeviceState);
      delete root.dataset.bcAndroidWebview;
      delete root.dataset.bcPageVisibility;
      root.classList.remove("bc-page-hidden");
    };
  }, []);

  return null;
}
