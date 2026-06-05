export type AdminStreamKeyRow = {
  id: string;
  fingerprint: string;
  status: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  userRoles: string[];
};

export type AdminStreamKeyUserOption = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  hasActiveKey: boolean;
};

export type AdminStreamKeyActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  rawKey?: string;
  fingerprint?: string;
};

export const initialAdminStreamKeyActionState: AdminStreamKeyActionState = {
  status: "idle"
};
