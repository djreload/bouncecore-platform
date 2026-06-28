import type { ProductRow } from "../shop/shop-service";

function publicProduct(product: ProductRow) {
  const availableVariants = product.variants.filter((variant) => variant.stock > 0);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    minPricePence: product.minPricePence,
    totalStock: product.totalStock,
    variantCount: product.variantCount,
    availableVariantCount: availableVariants.length,
    isPurchasable: availableVariants.length > 0,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      pricePence: variant.pricePence,
      stock: variant.stock,
      isPurchasable: variant.stock > 0
    }))
  };
}

export function buildMobileShopPayload(products: ProductRow[]) {
  const purchasableProducts = products.filter((product) => product.variants.some((variant) => variant.stock > 0));

  return {
    products: products.map(publicProduct),
    stats: {
      products: products.length,
      purchasableProducts: purchasableProducts.length,
      outOfStockProducts: products.length - purchasableProducts.length,
      variants: products.reduce((total, product) => total + product.variantCount, 0),
      purchasableVariants: products.reduce(
        (total, product) => total + product.variants.filter((variant) => variant.stock > 0).length,
        0
      ),
      totalStock: products.reduce((total, product) => total + product.totalStock, 0)
    }
  };
}
