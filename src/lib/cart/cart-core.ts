export type ShopCartStoredItem = {
  quantity: number;
  variantId: string;
};

export type GlobalCartSummary = {
  musicCount: number;
  shopCount: number;
  totalCount: number;
};

export function parseShopCartItems(parsed: unknown): ShopCartStoredItem[] {
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item) => (item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => {
      const variantId = typeof item.variantId === "string" ? item.variantId : "";
      const quantity = typeof item.quantity === "number" ? item.quantity : Number(item.quantity);

      if (!variantId || !Number.isFinite(quantity)) {
        return null;
      }

      return {
        quantity: Math.max(1, Math.round(quantity)),
        variantId
      };
    })
    .filter((item): item is ShopCartStoredItem => Boolean(item));
}

export function parseMusicCartIds(parsed: unknown): string[] {
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter((trackId): trackId is string => typeof trackId === "string" && Boolean(trackId.trim()));
}
