export type NotificationPreferencesActionState = {
  message: string;
  status: "idle" | "success" | "error";
};

export type AccountDeletionActionState = {
  message: string;
  status: "idle" | "success" | "error";
};

export const initialNotificationPreferencesActionState: NotificationPreferencesActionState = {
  message: "",
  status: "idle"
};

export const initialAccountDeletionActionState: AccountDeletionActionState = {
  message: "",
  status: "idle"
};
