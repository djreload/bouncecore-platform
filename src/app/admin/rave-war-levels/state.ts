export type AdminRaveWarLevelsActionState = {
  message?: string;
  status: "idle" | "success" | "error";
};

export const initialAdminRaveWarLevelsActionState: AdminRaveWarLevelsActionState = {
  status: "idle"
};

