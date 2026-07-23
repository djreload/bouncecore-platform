export type AdminCoreFpsActionState = {
  message?: string;
  status: "idle" | "success" | "error";
};

export const initialAdminCoreFpsActionState: AdminCoreFpsActionState = {
  status: "idle"
};
