export type StreamerProfileActionState = {
  message?: string;
  profileUrl?: string;
  status: "idle" | "success" | "error";
};

export const initialStreamerProfileActionState: StreamerProfileActionState = {
  status: "idle"
};
