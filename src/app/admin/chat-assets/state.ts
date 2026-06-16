export type AdminChatAssetRow = {
  id: string;
  packId: string;
  packName: string;
  name: string;
  shortcode: string;
  imageUrl: string;
  kind: "sticker" | "emoji";
  isAnimated: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminChatAssetPackRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: "active" | "draft" | "archived";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  stickers: AdminChatAssetRow[];
};

export type AdminChatAssetsStats = {
  packs: number;
  activePacks: number;
  assets: number;
  animated: number;
};

export type AdminChatAssetsActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialAdminChatAssetsActionState: AdminChatAssetsActionState = {
  status: "idle"
};
