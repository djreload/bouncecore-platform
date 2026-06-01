export type AdminProductsActionState = {
  message?: string;
  status: "idle" | "success" | "error";
};

export const initialAdminProductsActionState: AdminProductsActionState = {
  status: "idle"
};
