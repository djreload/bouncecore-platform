export type AdminUserInviteActionState = {
  inviteUrl?: string;
  message: string;
  status: "idle" | "success" | "error";
};

export const initialAdminUserInviteActionState: AdminUserInviteActionState = {
  message: "",
  status: "idle"
};
