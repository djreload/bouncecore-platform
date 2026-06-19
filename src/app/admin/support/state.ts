export type AdminSupportActionState = {
  message: string | null;
  status: "idle" | "success" | "error";
};

export const initialAdminSupportActionState: AdminSupportActionState = {
  message: null,
  status: "idle"
};
