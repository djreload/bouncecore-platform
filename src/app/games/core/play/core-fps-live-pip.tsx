"use client";

import { ArrowLeftRight, Minus, Radio, SquareArrowOutUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { subscribeToLiveStatus } from "@/components/live/live-status-client";
import { cn } from "@/lib/utils";

export function CoreFpsLivePip() {
  const [live, setLive] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [leftAligned, setLeftAligned] = useState(false);

  useEffect(() => {
    return subscribeToLiveStatus((payload) => {
      setLive(Boolean(payload.playbackUrl) && payload.status !== "offline");
    });
  }, []);

  if (!live) {
    return null;
  }

  return (
    <aside
      aria-label="Live stream picture in picture"
      className={cn(
        "absolute top-3 z-30 overflow-hidden rounded-md border border-bc-electric/65 bg-black shadow-[0_12px_36px_rgba(0,0,0,0.72)]",
        leftAligned ? "left-3" : "right-3",
        collapsed ? "w-auto" : "w-[clamp(11rem,19vw,18rem)]"
      )}
    >
      <div className="flex h-8 items-center gap-2 border-b border-bc-line bg-black/90 px-2">
        <Radio className="h-3.5 w-3.5 text-bc-pink" aria-hidden="true" />
        <span className="mr-auto text-[10px] font-black uppercase text-white">Live</span>
        <button
          aria-label={leftAligned ? "Move live video to top right" : "Move live video to top left"}
          className="bc-focus-ring grid h-6 w-6 place-items-center rounded-md text-bc-muted hover:bg-white/10 hover:text-white"
          onClick={() => setLeftAligned((current) => !current)}
          title={leftAligned ? "Move right" : "Move left"}
          type="button"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          aria-label={collapsed ? "Show live video" : "Minimize live video"}
          className="bc-focus-ring grid h-6 w-6 place-items-center rounded-md text-bc-muted hover:bg-white/10 hover:text-white"
          onClick={() => setCollapsed((current) => !current)}
          title={collapsed ? "Show video" : "Minimize"}
          type="button"
        >
          {collapsed ? (
            <SquareArrowOutUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
      {!collapsed ? (
        <div
          className="relative aspect-video bg-black"
          data-live-primary-video-slot="true"
          role="region"
        />
      ) : null}
    </aside>
  );
}
