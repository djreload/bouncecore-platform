"use client";

import { useEffect, useState } from "react";
import { Star, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LiveStarSupportData } from "@/lib/stars/star-send-service";

type StarSupportPanelProps = {
  initialData: LiveStarSupportData;
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function StarSupportOverlay({ initialData }: StarSupportPanelProps) {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const response = await fetch("/api/live/stars", {
          cache: "no-store"
        });
        const payload = (await response.json()) as LiveStarSupportData;

        if (active && response.ok) {
          setData(payload);
        }
      } catch {
        // Keep the last known star state if polling fails.
      }
    }

    const interval = window.setInterval(refresh, 5000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  if (!data.latestSend) {
    return (
      <div className="absolute bottom-4 left-4 right-4 z-20 max-w-md rounded-md border border-bc-line bg-bc-panel/90 p-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-bc-acid" aria-hidden="true" />
          <span className="text-sm font-semibold text-bc-muted">Star alerts will appear here during the livestream.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-4 left-4 right-4 z-20 max-w-md rounded-md border border-bc-acid/40 bg-bc-ink/90 p-4 shadow-lg shadow-bc-acid/10 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <Star className="h-6 w-6 fill-bc-acid text-bc-acid" aria-hidden="true" />
        <Badge tone="acid">Star alert</Badge>
        <span className="text-xs text-bc-muted">{formatTime(data.latestSend.createdAt)}</span>
      </div>
      <p className="mt-2 text-xl font-black">
        {data.latestSend.displayName} sent {data.latestSend.amount.toLocaleString("en-GB")} stars
      </p>
      {data.latestSend.note ? <p className="mt-1 text-sm text-bc-muted">{data.latestSend.note}</p> : null}
    </div>
  );
}

export function StarSupportLeaderboard({ initialData }: StarSupportPanelProps) {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const response = await fetch("/api/live/stars", {
          cache: "no-store"
        });
        const payload = (await response.json()) as LiveStarSupportData;

        if (active && response.ok) {
          setData(payload);
        }
      } catch {
        // Keep the last known leaderboard if polling fails.
      }
    }

    const interval = window.setInterval(refresh, 5000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="rounded-md border border-bc-line bg-bc-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <Badge tone="acid">Stars sent</Badge>
        <Trophy className="h-5 w-5 text-bc-acid" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-xl font-black">Live leaderboard</h2>
      <p className="mt-2 text-sm text-bc-muted">
        {data.totalStarsSent.toLocaleString("en-GB")} stars sent across {data.sendCount} live chat sends.
      </p>
      <div className="mt-4 space-y-2">
        {data.leaderboard.map((row, index) => (
          <div className="flex items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink p-3" key={row.userId}>
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-md border border-bc-line bg-bc-panel text-sm font-black">
                {index + 1}
              </span>
              <span className="font-semibold">{row.displayName}</span>
            </div>
            <Badge tone="acid">{row.stars.toLocaleString("en-GB")}</Badge>
          </div>
        ))}
        {!data.leaderboard.length ? <p className="text-sm text-bc-muted">No stars have been sent in this live window yet.</p> : null}
      </div>
    </div>
  );
}
