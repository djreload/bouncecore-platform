"use client";

import { useEffect, useRef } from "react";
import { usePerformancePreferences } from "@/components/performance/use-performance-preferences";

const minimumHeartbeatGapMs = 15_000;
const liveViewerHeartbeatIntervalMs = 15_000;
const activityFreshnessMs = 5 * 60 * 1000;
const liveAudioEnabledStorageKey = "bouncecore.liveAudio.enabled";
const visitorStorageKey = "bouncecore.presence.visitorId";
const activityEvents = ["keydown", "pointerdown", "scroll", "touchstart"] as const;

function createVisitorId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 18)}`;
}

function getPresenceVisitorId() {
  try {
    const existing = window.localStorage.getItem(visitorStorageKey);

    if (existing) {
      return existing;
    }

    const next = createVisitorId();

    window.localStorage.setItem(visitorStorageKey, next);
    return next;
  } catch {
    return createVisitorId();
  }
}

function persistentAudioEnabled() {
  try {
    return window.localStorage.getItem(liveAudioEnabledStorageKey) === "true";
  } catch {
    return false;
  }
}

function isLiveViewerActive() {
  return window.location.pathname === "/live" || window.location.pathname.startsWith("/live/") || persistentAudioEnabled();
}

export function SitePresenceHeartbeat() {
  const { effective: performancePreferences } = usePerformancePreferences();
  const lastSentAtRef = useRef(0);
  const lastActivityAtRef = useRef(0);
  const queuedHeartbeatRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    const heartbeatGapMs = performancePreferences.realtimeUpdatesEnabled ? minimumHeartbeatGapMs : 60_000;
    const viewerHeartbeatMs = performancePreferences.realtimeUpdatesEnabled ? liveViewerHeartbeatIntervalMs : 60_000;

    function clearQueuedHeartbeat() {
      if (queuedHeartbeatRef.current !== null) {
        window.clearTimeout(queuedHeartbeatRef.current);
        queuedHeartbeatRef.current = null;
      }
    }

    async function sendHeartbeat(force = false) {
      if (!active || document.visibilityState === "hidden") {
        return;
      }

      const now = Date.now();
      const hasRecentActivity = now - lastActivityAtRef.current <= activityFreshnessMs;

      if (!force && (!hasRecentActivity || now - lastSentAtRef.current < heartbeatGapMs)) {
        return;
      }

      lastSentAtRef.current = now;

      try {
        const liveViewer = isLiveViewerActive();

        await fetch("/api/presence/heartbeat", {
          body: JSON.stringify({
            liveViewer,
            path: liveViewer ? "/live" : window.location.pathname,
            visitorId: getPresenceVisitorId()
          }),
          headers: {
            "Content-Type": "application/json"
          },
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          keepalive: true
        });
      } catch {
        // Presence is best-effort and should never interrupt browsing.
      }
    }

    function queueHeartbeatAfterThrottle() {
      if (queuedHeartbeatRef.current !== null) {
        return;
      }

      const waitMs = Math.max(0, heartbeatGapMs - (Date.now() - lastSentAtRef.current));

      queuedHeartbeatRef.current = window.setTimeout(() => {
        queuedHeartbeatRef.current = null;
        void sendHeartbeat();
      }, waitMs);
    }

    function recordActivity() {
      lastActivityAtRef.current = Date.now();

      if (document.visibilityState === "hidden") {
        return;
      }

      if (Date.now() - lastSentAtRef.current >= heartbeatGapMs) {
        void sendHeartbeat();
      } else {
        queueHeartbeatAfterThrottle();
      }
    }

    lastActivityAtRef.current = Date.now();
    void sendHeartbeat(true);
    const liveViewerInterval = window.setInterval(() => {
      if (isLiveViewerActive()) {
        void sendHeartbeat(true);
      }
    }, viewerHeartbeatMs);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        recordActivity();
      }
    }

    function handleFocus() {
      recordActivity();
    }

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, recordActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      clearQueuedHeartbeat();
      window.clearInterval(liveViewerInterval);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [performancePreferences.realtimeUpdatesEnabled]);

  return null;
}
