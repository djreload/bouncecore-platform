export const liveAudioFocusChangeEvent = "bouncecore:live-audio-focus-change";

export type LiveAudioFocusChangeDetail = {
  active: boolean;
  sourceId: string;
};

export function shouldMuteLiveAudio(userEnabled: boolean, temporaryAudioFocus: boolean) {
  return !userEnabled || temporaryAudioFocus;
}

export function setTemporaryLiveAudioFocus(sourceId: string, active: boolean) {
  if (typeof window === "undefined" || !sourceId) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<LiveAudioFocusChangeDetail>(liveAudioFocusChangeEvent, {
      detail: {
        active,
        sourceId
      }
    })
  );
}
