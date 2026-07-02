export type PrivacyRightsActionState = {
  message: string | null;
  referenceId?: string;
  status: "idle" | "success" | "error";
};

export const initialPrivacyRightsActionState: PrivacyRightsActionState = {
  message: null,
  status: "idle"
};
