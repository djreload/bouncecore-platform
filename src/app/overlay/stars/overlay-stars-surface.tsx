"use client";

import { useEffect } from "react";
import { StarSupportOverlay } from "@/app/live/star-support-panel";
import type { LiveStarSupportData } from "@/lib/stars/star-send-service";

type OverlayStarsSurfaceProps = {
  initialData: LiveStarSupportData;
};

export function OverlayStarsSurface({ initialData }: OverlayStarsSurfaceProps) {
  useEffect(() => {
    const previousHtmlBackground = document.documentElement.style.background;
    const previousBodyBackground = document.body.style.background;
    const previousBodyMargin = document.body.style.margin;
    const previousBodyOverflow = document.body.style.overflow;

    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.background = previousHtmlBackground;
      document.body.style.background = previousBodyBackground;
      document.body.style.margin = previousBodyMargin;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  return (
    <main className="min-h-screen bg-transparent">
      <StarSupportOverlay initialData={initialData} />
    </main>
  );
}
