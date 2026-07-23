"use client";

import { useEffect } from "react";

type CoreFpsPresenceTrackerProps = {
  sessionId: string;
};

export function CoreFpsPresenceTracker({ sessionId }: CoreFpsPresenceTrackerProps) {
  useEffect(() => {
    const endpoint = `/api/games/core/sessions/${encodeURIComponent(sessionId)}/presence`;
    const updatePresence = (active: boolean) =>
      fetch(endpoint, {
        body: JSON.stringify({ active }),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        keepalive: !active,
        method: "POST"
      }).catch(() => undefined);
    const finishPresence = () => {
      const body = new Blob([JSON.stringify({ active: false })], {
        type: "application/json"
      });
      navigator.sendBeacon(endpoint, body);
    };

    void updatePresence(true);
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void updatePresence(true);
      }
    }, 20_000);

    window.addEventListener("pagehide", finishPresence);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("pagehide", finishPresence);
      finishPresence();
    };
  }, [sessionId]);

  return null;
}
