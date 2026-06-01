import type { Role } from "@/lib/auth/rbac";
import type { StreamScheduleStatus } from "@/lib/stream/stream-schedule-service";

export const adminScheduleStatusOptions = ["scheduled", "live", "completed", "cancelled"] as const satisfies readonly StreamScheduleStatus[];

export type AdminScheduleRow = {
  id: string;
  channelId: string;
  channelTitle: string;
  channelSlug: string;
  hostUserId: string | null;
  hostDisplayName: string | null;
  hostEmail: string | null;
  hostRoles: Role[];
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
};

export type AdminScheduleChannelOption = {
  id: string;
  title: string;
  slug: string;
};

export type AdminScheduleHostOption = {
  id: string;
  displayName: string;
  email: string;
  roles: Role[];
};

export type AdminScheduleStats = {
  total: number;
  upcoming: number;
  live: number;
  cancelled: number;
};

export type AdminScheduleActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialAdminScheduleActionState: AdminScheduleActionState = {
  status: "idle"
};

export type AdminScheduleFormValues = {
  channelId: string;
  hostUserId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  status: StreamScheduleStatus;
};
