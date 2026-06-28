import { parseMusicCartIds, parseShopCartItems, type GlobalCartSummary, type ShopCartStoredItem } from "@/lib/cart/cart-core";
import { musicCartStorageKey, shopCartStorageKey } from "@/lib/cart/storage-keys";

export const cartUpdatedEventName = "bouncecore:cart-updated";

function parseJson(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function readShopCartItems(): ShopCartStoredItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  return parseShopCartItems(parseJson(window.localStorage.getItem(shopCartStorageKey)));
}

export function readMusicCartIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  return parseMusicCartIds(parseJson(window.localStorage.getItem(musicCartStorageKey)));
}

export function readGlobalCartSummary(): GlobalCartSummary {
  const shopCount = readShopCartItems().reduce((total, item) => total + item.quantity, 0);
  const musicCount = readMusicCartIds().length;

  return {
    musicCount,
    shopCount,
    totalCount: musicCount + shopCount
  };
}

export function dispatchCartUpdated() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(cartUpdatedEventName, { detail: readGlobalCartSummary() }));
}
