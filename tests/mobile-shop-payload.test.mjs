import assert from "node:assert/strict";
import test from "node:test";
import { buildMobileShopPayload } from "../src/lib/mobile/shop-payload-core.ts";

function product(overrides) {
  const variants = overrides.variants ?? [];

  return {
    description: null,
    id: overrides.id,
    imageUrl: null,
    minPricePence: variants.length ? Math.min(...variants.map((variant) => variant.pricePence)) : null,
    name: overrides.name ?? overrides.id,
    slug: overrides.id,
    status: "active",
    totalStock: variants.reduce((total, variant) => total + variant.stock, 0),
    variantCount: variants.length,
    variants
  };
}

function variant(overrides) {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    pricePence: overrides.pricePence ?? 100,
    sku: overrides.id.toUpperCase(),
    stock: overrides.stock
  };
}

test("mobile shop payload marks only stocked products and variants as purchasable", () => {
  const payload = buildMobileShopPayload([
    product({
      id: "shirt",
      variants: [
        variant({ id: "small", stock: 0 }),
        variant({ id: "large", pricePence: 1200, stock: 4 })
      ]
    }),
    product({
      id: "poster",
      variants: [variant({ id: "poster-a3", stock: 0 })]
    }),
    product({
      id: "empty",
      variants: []
    })
  ]);

  assert.equal(payload.stats.products, 3);
  assert.equal(payload.stats.purchasableProducts, 1);
  assert.equal(payload.stats.outOfStockProducts, 2);
  assert.equal(payload.stats.purchasableVariants, 1);
  assert.equal(payload.stats.totalStock, 4);

  const shirt = payload.products.find((item) => item.id === "shirt");
  assert.equal(shirt?.isPurchasable, true);
  assert.equal(shirt?.availableVariantCount, 1);
  assert.deepEqual(
    shirt?.variants.map((item) => [item.id, item.isPurchasable]),
    [
      ["small", false],
      ["large", true]
    ]
  );

  assert.equal(payload.products.find((item) => item.id === "poster")?.isPurchasable, false);
  assert.equal(payload.products.find((item) => item.id === "empty")?.isPurchasable, false);
});
