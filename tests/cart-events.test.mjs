import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMusicCartIds, parseShopCartItems } from "../src/lib/cart/cart-core.ts";

test("shop cart parser keeps valid items and normalizes quantities", () => {
  assert.deepEqual(
    parseShopCartItems([
      {
        quantity: "2",
        variantId: "variant-1"
      },
      {
        quantity: 0,
        variantId: "variant-2"
      },
      {
        quantity: "invalid",
        variantId: "variant-3"
      },
      {
        quantity: 1
      }
    ]),
    [
      {
        quantity: 2,
        variantId: "variant-1"
      },
      {
        quantity: 1,
        variantId: "variant-2"
      }
    ]
  );
});

test("music cart parser keeps valid track ids only", () => {
  assert.deepEqual(parseMusicCartIds(["track-1", "", 42, "track-2"]), ["track-1", "track-2"]);
});
