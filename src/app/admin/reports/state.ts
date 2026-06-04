export type AdminReportsActionState = {
  message?: string;
  status: "idle" | "success" | "error";
};

export const initialAdminReportsActionState: AdminReportsActionState = {
  status: "idle"
};
