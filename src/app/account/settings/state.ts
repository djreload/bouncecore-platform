export type NotificationPreferencesActionState = {
  message: string;
  status: "idle" | "success" | "error";
};

export const initialNotificationPreferencesActionState: NotificationPreferencesActionState = {
  message: "",
  status: "idle"
};
