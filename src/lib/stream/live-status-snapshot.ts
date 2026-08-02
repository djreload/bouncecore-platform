import type { PublicLiveState } from "@/lib/stream/stream-channel-service";
import type { StreamHealth, StreamPlaybackSource } from "@/lib/stream/stream-provider";
import type { StreamProfileSummary } from "@/lib/stream/stream-profile-service";
import type { StreamPlaybackSettings } from "@/lib/stream/stream-playback-settings";

export type LiveStatusChannelPayload = {
  slug: string;
  title: string;
  status: string;
  playbackUrl: string | null;
  offlineImageUrl: string | null;
  streamProfile: StreamProfileSummary | null;
};

export type LiveStatusEventPayload = {
  activeIngests: StreamPlaybackSource[];
  channel: LiveStatusChannelPayload | null;
  health: StreamHealth;
  offlineImageUrl: string | null;
  playbackSettings: StreamPlaybackSettings;
  playbackUrl: string | null;
  provider: PublicLiveState["provider"];
  status: string;
  viewerCount: number;
};

export function publicLiveStateToStatusPayload(liveState: PublicLiveState): LiveStatusEventPayload {
  return {
    activeIngests: liveState.activeIngests,
    channel: liveState.channel,
    health: liveState.health,
    offlineImageUrl: liveState.offlineImageUrl,
    playbackSettings: liveState.playbackSettings,
    playbackUrl: liveState.playbackUrl,
    provider: liveState.provider,
    status: liveState.status,
    viewerCount: liveState.viewerCount
  };
}

export function liveStatusSignature(payload: LiveStatusEventPayload) {
  const activeIngestSignature = payload.activeIngests
    .map((ingest) =>
      [
        ingest.id,
        ingest.playbackUrl ?? "",
        ingest.presenterName ?? "",
        ingest.role,
        ingest.startedAt,
        ingest.status,
        ingest.streamKeyFingerprint ?? "",
        ingest.title ?? ""
      ].join(":")
    )
    .join("|");

  return [
    payload.status,
    payload.playbackUrl ?? "",
    payload.offlineImageUrl ?? "",
    payload.playbackSettings?.playbackBufferSeconds ?? "",
    payload.playbackSettings?.showUpcomingSets ? "1" : "0",
    payload.viewerCount,
    payload.channel?.slug ?? "",
    payload.channel?.title ?? "",
    payload.channel?.status ?? "",
    payload.channel?.playbackUrl ?? "",
    payload.channel?.offlineImageUrl ?? "",
    payload.health.status,
    payload.health.ingestConnected ? "1" : "0",
    payload.health.bitrateKbps ?? "",
    payload.health.droppedFrames ?? "",
    activeIngestSignature
  ].join("~");
}
