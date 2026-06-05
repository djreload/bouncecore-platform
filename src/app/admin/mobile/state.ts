export type AdminMobileActionState = {
  message?: string;
  status: "idle" | "success" | "error";
};

export const initialAdminMobileActionState: AdminMobileActionState = {
  status: "idle"
};
