export type AccountProfileActionState = {
  message?: string;
  profileUrl?: string;
  status: "idle" | "success" | "error";
};

export const initialAccountProfileActionState: AccountProfileActionState = {
  status: "idle"
};
