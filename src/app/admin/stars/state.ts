export type AdminStarsActionState = {
  message?: string;
  status: "idle" | "success" | "error";
};

export const initialAdminStarsActionState: AdminStarsActionState = {
  status: "idle"
};
