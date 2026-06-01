import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";

export const productStatusOptions = ["draft", "active", "archived"] as const;

export type ProductStatus = (typeof productStatusOptions)[number];

export type ProductInput = {
  productId?: string;
  name: string;
  slug: string;
  description?: string;
  status: ProductStatus;
};

export type ProductVariantInput = {
  variantId?: string;
  productId: string;
  sku: string;
  name: string;
  pricePounds: string;
  stock: string;
};

export type ProductVariantRow = {
  id: string;
  sku: string;
  name: string;
  pricePence: number;
  stock: number;
};

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  variants: ProductVariantRow[];
  variantCount: number;
  totalStock: number;
  minPricePence: number | null;
};

export type ShopStats = {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  archivedProducts: number;
  totalVariants: number;
  totalStock: number;
};

function normalizeSlug(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 58);

  if (normalized) {
    return normalized;
  }

  return (
    fallback
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 58) || "product"
  );
}

function normalizedText(value: string | undefined, maxLength: number) {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new Error(`Text must be ${maxLength} characters or fewer.`);
  }

  return text;
}

function assertProductStatus(status: string): asserts status is ProductStatus {
  if (!productStatusOptions.includes(status as ProductStatus)) {
    throw new Error("Invalid product status.");
  }
}

function parsePricePence(value: string) {
  const price = Number(value);

  if (!Number.isFinite(price) || price < 0 || price > 99999) {
    throw new Error("Variant price must be between 0 and 99999.");
  }

  return Math.round(price * 100);
}

function parseStock(value: string) {
  const stock = Number(value);

  if (!Number.isInteger(stock) || stock < 0 || stock > 999999) {
    throw new Error("Stock must be a whole number between 0 and 999999.");
  }

  return stock;
}

function toProductRow(product: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  variants: ProductVariantRow[];
}): ProductRow {
  const prices = product.variants.map((variant) => variant.pricePence);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    status: product.status,
    variants: product.variants,
    variantCount: product.variants.length,
    totalStock: product.variants.reduce((total, variant) => total + variant.stock, 0),
    minPricePence: prices.length ? Math.min(...prices) : null
  };
}

function toVariantRow(variant: ProductVariantRow): ProductVariantRow {
  return {
    id: variant.id,
    sku: variant.sku,
    name: variant.name,
    pricePence: variant.pricePence,
    stock: variant.stock
  };
}

async function uniqueProductSlug(slug: string, productId?: string) {
  const existing = await prisma.product.findUnique({
    where: {
      slug
    },
    select: {
      id: true
    }
  });

  if (existing && existing.id !== productId) {
    throw new Error("That product slug is already in use.");
  }
}

async function uniqueVariantSku(sku: string, variantId?: string) {
  const existing = await prisma.productVariant.findUnique({
    where: {
      sku
    },
    select: {
      id: true
    }
  });

  if (existing && existing.id !== variantId) {
    throw new Error("That SKU is already in use.");
  }
}

function normalizeProductInput(input: ProductInput) {
  assertProductStatus(input.status);

  const name = normalizedText(input.name, 120);

  if (!name || name.length < 2) {
    throw new Error("Product name must be at least 2 characters.");
  }

  return {
    description: normalizedText(input.description, 600),
    name,
    slug: normalizeSlug(input.slug, name),
    status: input.status
  };
}

function normalizeVariantInput(input: ProductVariantInput) {
  const name = normalizedText(input.name, 80);
  const sku = normalizedText(input.sku, 80)?.toUpperCase();

  if (!name || name.length < 2) {
    throw new Error("Variant name must be at least 2 characters.");
  }

  if (!sku || sku.length < 2) {
    throw new Error("SKU must be at least 2 characters.");
  }

  return {
    name,
    pricePence: parsePricePence(input.pricePounds),
    sku,
    stock: parseStock(input.stock)
  };
}

export async function getAdminShopData(): Promise<{ products: ProductRow[]; stats: ShopStats }> {
  const products = await prisma.product.findMany({
    include: {
      variants: {
        orderBy: {
          name: "asc"
        }
      }
    },
    orderBy: {
      name: "asc"
    }
  });
  const rows = products.map((product) =>
    toProductRow({
      ...product,
      variants: product.variants.map(toVariantRow)
    })
  );

  return {
    products: rows,
    stats: {
      activeProducts: rows.filter((product) => product.status === "active").length,
      archivedProducts: rows.filter((product) => product.status === "archived").length,
      draftProducts: rows.filter((product) => product.status === "draft").length,
      totalProducts: rows.length,
      totalStock: rows.reduce((total, product) => total + product.totalStock, 0),
      totalVariants: rows.reduce((total, product) => total + product.variantCount, 0)
    }
  };
}

export async function getPublicShopProducts(): Promise<ProductRow[]> {
  const products = await prisma.product.findMany({
    where: {
      status: "active"
    },
    include: {
      variants: {
        orderBy: {
          pricePence: "asc"
        }
      }
    },
    orderBy: {
      name: "asc"
    },
    take: 100
  });

  return products.map((product) =>
    toProductRow({
      ...product,
      variants: product.variants.map(toVariantRow)
    })
  );
}

export async function createProduct(actorId: string, input: ProductInput) {
  const productInput = normalizeProductInput(input);

  await uniqueProductSlug(productInput.slug);

  const product = await prisma.product.create({
    data: productInput
  });

  await writeAuditLog({
    actorId,
    action: "shop.product.create",
    target: `product:${product.id}`,
    severity: product.status === "active" ? "warning" : "info",
    metadata: {
      slug: product.slug,
      status: product.status
    }
  });

  return product;
}

export async function updateProduct(actorId: string, input: ProductInput) {
  if (!input.productId) {
    throw new Error("Missing product.");
  }

  const productInput = normalizeProductInput(input);
  const existing = await prisma.product.findUniqueOrThrow({
    where: {
      id: input.productId
    }
  });

  await uniqueProductSlug(productInput.slug, input.productId);

  const product = await prisma.product.update({
    where: {
      id: input.productId
    },
    data: productInput
  });

  await writeAuditLog({
    actorId,
    action: "shop.product.update",
    target: `product:${product.id}`,
    severity: existing.status !== product.status ? "warning" : "info",
    metadata: {
      previousStatus: existing.status,
      slug: product.slug,
      status: product.status
    }
  });

  return product;
}

export async function archiveProduct(actorId: string, productId: string) {
  if (!productId) {
    throw new Error("Missing product.");
  }

  const product = await prisma.product.update({
    where: {
      id: productId
    },
    data: {
      status: "archived"
    }
  });

  await writeAuditLog({
    actorId,
    action: "shop.product.archive",
    target: `product:${product.id}`,
    severity: "warning",
    metadata: {
      slug: product.slug
    }
  });

  return product;
}

export async function createProductVariant(actorId: string, input: ProductVariantInput) {
  const variantInput = normalizeVariantInput(input);

  await prisma.product.findUniqueOrThrow({
    where: {
      id: input.productId
    },
    select: {
      id: true
    }
  });
  await uniqueVariantSku(variantInput.sku);

  const variant = await prisma.productVariant.create({
    data: {
      ...variantInput,
      productId: input.productId
    }
  });

  await writeAuditLog({
    actorId,
    action: "shop.variant.create",
    target: `product-variant:${variant.id}`,
    severity: "info",
    metadata: {
      productId: input.productId,
      sku: variant.sku
    }
  });

  return variant;
}

export async function updateProductVariant(actorId: string, input: ProductVariantInput) {
  if (!input.variantId) {
    throw new Error("Missing variant.");
  }

  const variantInput = normalizeVariantInput(input);
  const existing = await prisma.productVariant.findUniqueOrThrow({
    where: {
      id: input.variantId
    }
  });

  if (existing.productId !== input.productId) {
    throw new Error("Variant does not belong to this product.");
  }

  await uniqueVariantSku(variantInput.sku, input.variantId);

  const variant = await prisma.productVariant.update({
    where: {
      id: input.variantId
    },
    data: variantInput
  });

  await writeAuditLog({
    actorId,
    action: "shop.variant.update",
    target: `product-variant:${variant.id}`,
    severity: existing.stock !== variant.stock || existing.pricePence !== variant.pricePence ? "warning" : "info",
    metadata: {
      productId: variant.productId,
      sku: variant.sku
    }
  });

  return variant;
}
