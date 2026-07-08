import type { Role } from "@/lib/auth/rbac";

export type AdminChatRoomRow = {
  id: string;
  lockedAt: string | null;
  slug: string;
  name: string;
  slowModeSeconds: number;
  type: string;
  createdAt: string;
  messages: number;
};

export type AdminChatMessageRow = {
  id: string;
  roomId: string;
  roomName: string;
  roomSlug: string;
  body: string;
  kind: string;
  mediaPreviewUrl: string | null;
  mediaAlt: string | null;
  createdAt: string;
  deletedAt: string | null;
  authorDisplayName: string;
  authorRoles: Role[];
};

export type AdminChatSheepThrowRow = {
  id: string;
  roomName: string;
  roomSlug: string;
  spriteId: string;
  throwerDisplayName: string;
  targetDisplayName: string;
  targetMessageId: string | null;
  createdAt: string;
};

export type AdminChatroomsActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialAdminChatroomsActionState: AdminChatroomsActionState = {
  status: "idle"
};
