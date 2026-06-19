export type SupportActionState = {
  message: string | null;
  referenceId?: string;
  status: "idle" | "success" | "error";
};

export const initialSupportActionState: SupportActionState = {
  message: null,
  status: "idle"
};
