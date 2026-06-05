export type AdminSettingsActionState = {
  message?: string;
  status: "idle" | "success" | "error";
};

export const initialAdminSettingsActionState: AdminSettingsActionState = {
  status: "idle"
};
