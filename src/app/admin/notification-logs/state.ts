export type AdminNotificationLogsActionState = {
  message: string;
  status: "idle" | "success" | "error";
};

export const initialAdminNotificationLogsActionState: AdminNotificationLogsActionState = {
  message: "",
  status: "idle"
};
