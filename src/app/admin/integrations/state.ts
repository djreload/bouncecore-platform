export type AdminIntegrationsActionState = {
  message?: string;
  status: "idle" | "success" | "error";
};

export const initialAdminIntegrationsActionState: AdminIntegrationsActionState = {
  status: "idle"
};
