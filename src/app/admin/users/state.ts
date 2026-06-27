export type AdminUserInviteActionState = {
  inviteUrl?: string;
  message: string;
  status: "idle" | "success" | "error";
};

export type AdminUserManagementActionState = {
  message: string;
  status: "idle" | "success" | "error";
};

export const initialAdminUserInviteActionState: AdminUserInviteActionState = {
  message: "",
  status: "idle"
};

export const initialAdminUserManagementActionState: AdminUserManagementActionState = {
  message: "",
  status: "idle"
};
