"use client";

import { useEffect, useRef } from "react";

const heartbeatIntervalMs = 60_000;
const minimumHeartbeatGapMs = 30_000;

export function SitePresenceHeartbeat() {
  const lastSentAtRef = useRef(0);

  useEffect(() => {
    let active = true;

    async function sendHeartbeat(force = false) {
      if (document.visibilityState === "hidden") {
        return;
      }

      const now = Date.now();

      if (!force && now - lastSentAtRef.current < minimumHeartbeatGapMs) {
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

    void sendHeartbeat(true);

    const interval = window.setInterval(() => {
      if (active) {
        void sendHeartbeat();
      }
    }, heartbeatIntervalMs);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void sendHeartbeat();
      }
    }

    function handleFocus() {
      void sendHeartbeat();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return null;
}
