import type { StreamHealth, StreamStatus } from "@/lib/stream/stream-provider";
import type { StreamProfileSummary } from "@/lib/stream/stream-profile-service";

export type AdminStreamChannelRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  playbackUrl: string | null;
  offlineImageUrl: string | null;
  streamProfile: StreamProfileSummary | null;
  streamKeys: number;
  sessions: number;
  events: number;
};

export type AdminStreamProfileRow = StreamProfileSummary;

export type AdminStreamProviderState = {
  status: StreamStatus;
  playbackUrl: string | null;
  viewerCount: number;
  health: StreamHealth;
};

export type AdminStreamActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialAdminStreamActionState: AdminStreamActionState = {
  status: "idle"
};
