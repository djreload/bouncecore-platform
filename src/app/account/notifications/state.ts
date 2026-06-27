export type AccountNotificationsActionState = {
  message: string;
  status: "idle" | "success" | "error";
};

export const initialAccountNotificationsActionState: AccountNotificationsActionState = {
  message: "",
  status: "idle"
};
