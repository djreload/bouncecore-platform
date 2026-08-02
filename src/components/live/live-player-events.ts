export const livePlayerQualityRequestEvent = "bouncecore:live-player-quality-request";
export const livePlayerQualityStateEvent = "bouncecore:live-player-quality-state";
export const livePlayerQualityStateRequestEvent = "bouncecore:live-player-quality-state-request";

export type LivePlayerQualityOption = {
  bitrate: number | null;
  height: number | null;
  index: number;
  label: string;
};

export type LivePlayerQualityState = {
  activeLevel: number;
  options: LivePlayerQualityOption[];
  selectedLevel: number;
};

export const emptyLivePlayerQualityState: LivePlayerQualityState = {
  activeLevel: -1,
  options: [],
  selectedLevel: -1
};

export function publishLivePlayerQualityState(state: LivePlayerQualityState) {
  window.dispatchEvent(new CustomEvent<LivePlayerQualityState>(livePlayerQualityStateEvent, { detail: state }));
}

export function requestLivePlayerQualityState() {
  window.dispatchEvent(new Event(livePlayerQualityStateRequestEvent));
}

export function selectLivePlayerQuality(level: number) {
  window.dispatchEvent(new CustomEvent<{ level: number }>(livePlayerQualityRequestEvent, { detail: { level } }));
}
