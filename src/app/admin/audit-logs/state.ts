export type AdminAuditLogsActionState = {
  message: string;
  status: "idle" | "success" | "error";
};

export const initialAdminAuditLogsActionState: AdminAuditLogsActionState = {
  message: "",
  status: "idle"
};
