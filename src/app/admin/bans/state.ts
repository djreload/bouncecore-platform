export type AdminBansActionState = {
  message?: string;
  status: "idle" | "success" | "error";
};

export const initialAdminBansActionState: AdminBansActionState = {
  status: "idle"
};
