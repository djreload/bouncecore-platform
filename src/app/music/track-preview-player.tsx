"use client";

import { useEffect, useId, useRef } from "react";
import { setTemporaryLiveAudioFocus } from "@/components/live/live-audio-focus";

const musicPreviewStartedEvent = "bouncecore:music-preview-started";

type TrackPreviewPlayerProps = {
  playerId: string;
  previewUrl: string;
  title: string;
};

export function TrackPreviewPlayer({ playerId, previewUrl, title }: TrackPreviewPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reactId = useId();
  const focusSourceId = `music-preview-${reactId}`;

  useEffect(() => {
    function pauseForAnotherPreview(event: Event) {
      const sourceId = (event as CustomEvent<{ sourceId?: unknown }>).detail?.sourceId;

      if (sourceId !== focusSourceId && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    }

    window.addEventListener(musicPreviewStartedEvent, pauseForAnotherPreview);

    return () => {
      window.removeEventListener(musicPreviewStartedEvent, pauseForAnotherPreview);
      setTemporaryLiveAudioFocus(focusSourceId, false);
    };
  }, [focusSourceId]);

  function claimAudioFocus() {
    setTemporaryLiveAudioFocus(focusSourceId, true);
    window.dispatchEvent(
      new CustomEvent(musicPreviewStartedEvent, {
        detail: {
          sourceId: focusSourceId
        }
      })
    );
  }

  function releaseAudioFocus() {
    setTemporaryLiveAudioFocus(focusSourceId, false);
  }

  return (
    <audio
      aria-label={`Preview ${title}`}
      className="w-full"
      controls
      id={playerId}
      onAbort={releaseAudioFocus}
      onEmptied={releaseAudioFocus}
      onEnded={releaseAudioFocus}
      onError={releaseAudioFocus}
      onPause={releaseAudioFocus}
      onPlay={claimAudioFocus}
      preload="none"
      ref={audioRef}
      src={previewUrl}
    >
      <a href={previewUrl}>Preview {title}</a>
    </audio>
  );
}
