export type AdminPaymentsActionState = {
  message?: string;
  status: "idle" | "success" | "error";
};

export const initialAdminPaymentsActionState: AdminPaymentsActionState = {
  status: "idle"
};
