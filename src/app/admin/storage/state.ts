export type AdminStorageActionState = {
  message: string;
  status: "idle" | "success" | "error";
};

export const initialAdminStorageActionState: AdminStorageActionState = {
  message: "",
  status: "idle"
};
