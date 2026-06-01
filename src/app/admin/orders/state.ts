export type AdminOrdersActionState = {
  message?: string;
  status: "idle" | "success" | "error";
};

export const initialAdminOrdersActionState: AdminOrdersActionState = {
  status: "idle"
};
