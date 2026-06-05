export type AdminPushActionState = {
  message?: string;
  status: "idle" | "success" | "error";
};

export const initialAdminPushActionState: AdminPushActionState = {
  status: "idle"
};
