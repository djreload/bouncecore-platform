export const chatRoomTypeOptions = ["public", "live", "vip", "dj", "producer", "private"] as const;

export type ChatRoomType = (typeof chatRoomTypeOptions)[number];
