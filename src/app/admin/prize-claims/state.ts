export type AdminPrizeClaimsActionState = {
  message?: string;
  status: "idle" | "success" | "error";
};

export const initialAdminPrizeClaimsActionState: AdminPrizeClaimsActionState = {
  status: "idle"
};
