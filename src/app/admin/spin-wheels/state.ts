export type AdminSpinWheelsActionState = {
  message?: string;
  status: "idle" | "success" | "error";
};

export const initialAdminSpinWheelsActionState: AdminSpinWheelsActionState = {
  status: "idle"
};
