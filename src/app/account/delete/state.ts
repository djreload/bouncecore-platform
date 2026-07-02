export type PublicAccountDeletionActionState = {
  message: string;
  referenceId?: string;
  status: "idle" | "success" | "error";
};

export const initialPublicAccountDeletionActionState: PublicAccountDeletionActionState = {
  message: "",
  status: "idle"
};
