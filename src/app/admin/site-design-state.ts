export type AdminSiteDesignActionState = {
  message?: string;
  status: "idle" | "success" | "error";
};

export const initialAdminSiteDesignActionState: AdminSiteDesignActionState = {
  status: "idle"
};
