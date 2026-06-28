"use client";

import { useEffect, useRef } from "react";

const minimumHeartbeatGapMs = 30_000;
const activityFreshnessMs = 5 * 60 * 1000;
const activityEvents = ["keydown", "pointerdown", "scroll", "touchstart"] as const;

export function SitePresenceHeartbeat() {
  const lastSentAtRef = useRef(0);
  const lastActivityAtRef = useRef(0);
  const queuedHeartbeatRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

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

      if (!force && (!hasRecentActivity || now - lastSentAtRef.current < minimumHeartbeatGapMs)) {
        return;
      }

      lastSentAtRef.current = now;

      try {
        await fetch("/api/presence/heartbeat", {
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

      const waitMs = Math.max(0, minimumHeartbeatGapMs - (Date.now() - lastSentAtRef.current));

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

      if (Date.now() - lastSentAtRef.current >= minimumHeartbeatGapMs) {
        void sendHeartbeat();
      } else {
        queueHeartbeatAfterThrottle();
      }
    }

    lastActivityAtRef.current = Date.now();
    void sendHeartbeat(true);

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
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return null;
}
