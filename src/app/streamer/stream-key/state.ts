import type { StreamKeySummary } from "@/lib/stream/stream-key-service";

export type StreamKeyActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  rawKey?: string;
  key?: StreamKeySummary | null;
};

export const initialStreamKeyActionState: StreamKeyActionState = {
  status: "idle"
};
