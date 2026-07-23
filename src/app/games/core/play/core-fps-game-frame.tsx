"use client";

import { useCallback, useEffect, useRef } from "react";
import { CoreFpsLivePip } from "@/app/games/core/play/core-fps-live-pip";

type CoreFpsGameFrameProps = {
  launchUrl: string;
};

export function CoreFpsGameFrame({ launchUrl }: CoreFpsGameFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const focusGame = useCallback(() => {
    frameRef.current?.focus();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(focusGame, 250);
    return () => window.clearTimeout(timeout);
  }, [focusGame]);

  return (
    <>
      <iframe
        allow="autoplay; clipboard-write; fullscreen; gamepad"
        className="absolute inset-0 h-full w-full border-0 bg-black"
        onLoad={focusGame}
        ref={frameRef}
        referrerPolicy="no-referrer"
        sandbox="allow-downloads allow-fullscreen allow-pointer-lock allow-same-origin allow-scripts"
        src={launchUrl}
        tabIndex={0}
        title="Core FPS game"
      />
      <CoreFpsLivePip />
    </>
  );
}
