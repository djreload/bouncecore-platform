import type { Role } from "@/lib/auth/rbac";

export type PublicChatRoomRow = {
  id: string;
  slug: string;
  name: string;
  type: string;
  messages: number;
};

export type PublicChatMessageRow = {
  id: string;
  roomId: string;
  body: string;
  kind: string;
  mediaUrl: string | null;
  mediaPreviewUrl: string | null;
  mediaAlt: string | null;
  mediaSource: string | null;
  mediaSourceId: string | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  createdAt: string;
  authorDisplayName: string;
  authorRoles: Role[];
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
