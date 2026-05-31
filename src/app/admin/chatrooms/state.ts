import type { Role } from "@/lib/auth/rbac";

export type AdminChatRoomRow = {
  id: string;
  slug: string;
  name: string;
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
  createdAt: string;
  deletedAt: string | null;
  authorDisplayName: string;
  authorRoles: Role[];
};

export type AdminChatroomsActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialAdminChatroomsActionState: AdminChatroomsActionState = {
  status: "idle"
};
