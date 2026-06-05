export type AdminTracksActionState = {
  message?: string;
  status: "idle" | "success" | "error";
};

export const initialAdminTracksActionState: AdminTracksActionState = {
  status: "idle"
};
