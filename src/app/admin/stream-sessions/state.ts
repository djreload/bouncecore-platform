export type AdminStreamSessionsActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialAdminStreamSessionsActionState: AdminStreamSessionsActionState = {
  status: "idle"
};
