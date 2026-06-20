import type { Role } from "@/lib/auth/rbac";

export type PublicChatRoomRow = {
  id: string;
  lockedAt: string | null;
  slug: string;
  name: string;
  slowModeSeconds: number;
  type: string;
  messages: number;
};

export type PublicChatMessageRow = {
  id: string;
  roomId: string;
  replyTo: PublicChatReplyRow | null;
  body: string;
  kind: string;
  mediaUrl: string | null;
  mediaPreviewUrl: string | null;
  mediaAlt: string | null;
  mediaSource: string | null;
  mediaSourceId: string | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  effectId: string | null;
  starAmount: number | null;
  starNote: string | null;
  createdAt: string;
  deletedAt: string | null;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  authorUserId: string | null;
  authorRoles: Role[];
  reactions: PublicChatReactionRow[];
};

export type PublicChatReplyRow = {
  id: string;
  body: string;
  kind: string;
  mediaAlt: string | null;
  deletedAt: string | null;
  authorDisplayName: string;
};

export type PublicChatReactionRow = {
  key: string;
  count: number;
  reacted: boolean;
};

export type PublicChatAssetRow = {
  id: string;
  packId: string;
  packName: string;
  name: string;
  shortcode: string;
  imageUrl: string;
  kind: "sticker" | "emoji";
  isAnimated: boolean;
};

export type PublicChatUser = {
  id: string;
  displayName: string;
  roles: Role[];
};

export type PublicChatActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialPublicChatActionState: PublicChatActionState = {
  status: "idle"
};
