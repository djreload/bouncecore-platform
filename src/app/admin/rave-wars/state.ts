export type AdminRaveWarRepairActionState = {
  message: string;
  status: "error" | "idle" | "success";
};

export const initialAdminRaveWarRepairActionState: AdminRaveWarRepairActionState = {
  message: "",
  status: "idle"
};
