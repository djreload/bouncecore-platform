export const streamStatusOptions = ["offline", "starting", "live", "degraded"] as const;

export type ChannelStatus = (typeof streamStatusOptions)[number];
