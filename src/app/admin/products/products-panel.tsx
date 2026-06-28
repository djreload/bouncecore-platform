"use client";
/* eslint-disable @next/next/no-img-element */

import { useActionState } from "react";
import { Archive, Boxes, Image as ImageIcon, PackagePlus, Plus, Save, ShoppingBag } from "lucide-react";
import { adminProductsAction } from "@/app/admin/products/actions";
import { initialAdminProductsActionState, type AdminProductsActionState } from "@/app/admin/products/state";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import type { ProductRow, ProductVariantRow, ShopStats } from "@/lib/shop/shop-service";

type AdminProductsRepairFilter = "missing-images" | "missing-variants";

type AdminProductsPanelProps = {
  products: ProductRow[];
  repairFilter?: AdminProductsRepairFilter | null;
  stats: ShopStats;
};

const productStatusOptions = ["draft", "active", "archived"] as const;

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

function priceInputValue(pence: number) {
  return (pence / 100).toFixed(2);
}

function statusTone(status: string) {
  if (status === "active") {
    return "acid" as const;
  }

  if (status === "archived") {
    return "muted" as const;
  }

  return "amber" as const;
}

function repairLabel(filter: AdminProductsRepairFilter) {
  if (filter === "missing-images") {
    return {
      detail: "Showing active shop products that need a product image.",
      title: "Missing product images"
    };
  }

  return {
    detail: "Showing active shop products that need at least one checkout variant.",
    title: "Missing variants"
  };
}

function matchesRepairFilter(product: ProductRow, filter: AdminProductsRepairFilter) {
  if (filter === "missing-images") {
    return product.status === "active" && !product.imageUrl;
  }

  return product.status === "active" && product.variantCount === 0;
}

function ProductFields({ pending, product }: { pending: boolean; product?: ProductRow }) {
  return (
    <>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={product ? `name-${product.id}` : "create-name"}>
          Name
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={product?.name ?? ""}
          disabled={pending}
          id={product ? `name-${product.id}` : "create-name"}
          maxLength={120}
          name="name"
          placeholder="Product name"
          required
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={product ? `slug-${product.id}` : "create-slug"}>
          Slug
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={product?.slug ?? ""}
          disabled={pending}
          id={product ? `slug-${product.id}` : "create-slug"}
          maxLength={58}
          name="slug"
          placeholder="product-slug"
        />
      </div>
      <div>
        <label
          className="text-xs font-semibold uppercase text-bc-muted"
          htmlFor={product ? `image-${product.id}` : "create-image"}
        >
          Product image URL
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={product?.imageUrl ?? ""}
          disabled={pending}
          id={product ? `image-${product.id}` : "create-image"}
          maxLength={500}
          name="imageUrl"
          placeholder="https://.../image.jpg or uploaded file path"
          type="text"
        />
        <p className="mt-1 text-xs text-bc-muted">Use a square JPG, PNG, WebP, GIF, or AVIF image. Maximum 100MB.</p>
      </div>
      <div>
        <label
          className="text-xs font-semibold uppercase text-bc-muted"
          htmlFor={product ? `image-file-${product.id}` : "create-image-file"}
        >
          Upload image
        </label>
        <input
          accept=".jpg,.jpeg,.png,.webp,.gif,.avif,image/jpeg,image/png,image/webp,image/gif,image/avif"
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-bc-electric file:px-3 file:py-1 file:text-sm file:font-semibold file:text-bc-void"
          disabled={pending}
          id={product ? `image-file-${product.id}` : "create-image-file"}
          name="imageFile"
          type="file"
        />
      </div>
      <div>
        <label
          className="text-xs font-semibold uppercase text-bc-muted"
          htmlFor={product ? `status-${product.id}` : "create-status"}
        >
          Status
        </label>
        <select
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={product?.status ?? "draft"}
          disabled={pending}
          id={product ? `status-${product.id}` : "create-status"}
          name="status"
        >
          {productStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
      <div className="lg:col-span-3">
        <label
          className="text-xs font-semibold uppercase text-bc-muted"
          htmlFor={product ? `description-${product.id}` : "create-description"}
        >
          Description
        </label>
        <textarea
          className="mt-2 min-h-24 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={product?.description ?? ""}
          disabled={pending}
          id={product ? `description-${product.id}` : "create-description"}
          maxLength={600}
          name="description"
          placeholder="Product description"
        />
      </div>
    </>
  );
}

function VariantFields({
  pending,
  productId,
  variant
}: {
  pending: boolean;
  productId: string;
  variant?: ProductVariantRow;
}) {
  const suffix = variant?.id ?? `create-${productId}`;

  return (
    <>
      <input name="productId" type="hidden" value={productId} />
      {variant ? <input name="variantId" type="hidden" value={variant.id} /> : null}
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`variant-name-${suffix}`}>
          Variant
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={variant?.name ?? ""}
          disabled={pending}
          id={`variant-name-${suffix}`}
          maxLength={80}
          name="variantName"
          placeholder="Size / option"
          required
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`sku-${suffix}`}>
          SKU
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={variant?.sku ?? ""}
          disabled={pending}
          id={`sku-${suffix}`}
          maxLength={80}
          name="sku"
          placeholder="BC-001"
          required
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`price-${suffix}`}>
          Price
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={variant ? priceInputValue(variant.pricePence) : "0.00"}
          disabled={pending}
          id={`price-${suffix}`}
          min="0"
          name="pricePounds"
          step="0.01"
          type="number"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`stock-${suffix}`}>
          Stock
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={variant?.stock ?? 0}
          disabled={pending}
          id={`stock-${suffix}`}
          min="0"
          name="stock"
          step="1"
          type="number"
        />
      </div>
    </>
  );
}

export function AdminProductsPanel({ products, repairFilter = null, stats }: AdminProductsPanelProps) {
  const [state, formAction, pending] = useActionState<AdminProductsActionState, FormData>(
    adminProductsAction,
    initialAdminProductsActionState
  );
  const visibleProducts = repairFilter ? products.filter((product) => matchesRepairFilter(product, repairFilter)) : products;
  const activeRepair = repairFilter ? repairLabel(repairFilter) : null;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Products</Badge>
          <p className="mt-4 text-3xl font-black">{stats.totalProducts}</p>
          <p className="mt-2 text-sm text-bc-muted">Total product records.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Active</Badge>
          <p className="mt-4 text-3xl font-black">{stats.activeProducts}</p>
          <p className="mt-2 text-sm text-bc-muted">Visible in the shop.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Variants</Badge>
          <p className="mt-4 text-3xl font-black">{stats.totalVariants}</p>
          <p className="mt-2 text-sm text-bc-muted">SKU and stock options.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Stock</Badge>
          <p className="mt-4 text-3xl font-black">{stats.totalStock}</p>
          <p className="mt-2 text-sm text-bc-muted">Combined available units.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Merch shop</Badge>
            <h3 className="mt-4 text-2xl font-black">Product catalogue</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Manage product copy, listing status, SKUs, pricing, and stock for the public shop.
            </p>
          </div>
          <ShoppingBag className="h-7 w-7 text-bc-pink" aria-hidden="true" />
        </div>

        {state.message ? (
          <div
            className={`mt-5 rounded-md border p-3 text-sm ${
              state.status === "error"
                ? "border-bc-pink/30 bg-bc-pink/10 text-bc-pink"
                : "border-bc-acid/30 bg-bc-acid/10 text-bc-acid"
            }`}
          >
            {state.message}
          </div>
        ) : null}
      </section>

      {activeRepair ? (
        <section className="rounded-md border border-bc-acid/35 bg-bc-acid/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge tone="acid">Repair filter</Badge>
              <h3 className="mt-2 text-xl font-black">{activeRepair.title}</h3>
              <p className="mt-1 text-sm text-bc-muted">
                {activeRepair.detail} Showing {visibleProducts.length.toLocaleString("en-GB")} of {products.length.toLocaleString("en-GB")} products.
              </p>
            </div>
            <ButtonLink href="/admin/products" size="sm" variant="ghost">
              Clear filter
            </ButtonLink>
          </div>
        </section>
      ) : null}

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <Badge tone="cyan">New product</Badge>
        <form action={formAction} className="mt-4 grid gap-4 lg:grid-cols-3" encType="multipart/form-data">
          <input name="intent" type="hidden" value="create-product" />
          <ProductFields pending={pending} />
          <div className="flex items-end">
            <Button disabled={pending} type="submit" variant="primary">
              <PackagePlus className="h-4 w-4" aria-hidden="true" />
              Create product
            </Button>
          </div>
        </form>
      </section>

      <div className="grid gap-4">
        {visibleProducts.map((product) => (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={product.id}>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <Badge tone={statusTone(product.status)}>{product.status}</Badge>
                <h3 className="mt-3 text-2xl font-black">{product.name}</h3>
                <p className="mt-2 text-sm text-bc-muted">
                  {product.variantCount} variants / {product.totalStock} units /{" "}
                  {product.minPricePence === null ? "No price" : `from ${formatMoney(product.minPricePence)}`}
                </p>
              </div>
              {product.imageUrl ? (
                <img
                  alt=""
                  className="h-20 w-20 rounded-md border border-bc-line object-cover"
                  src={product.imageUrl}
                />
              ) : (
                <ImageIcon className="h-7 w-7 text-bc-acid" aria-hidden="true" />
              )}
            </div>

            <form action={formAction} className="grid gap-4 lg:grid-cols-3" encType="multipart/form-data">
              <input name="intent" type="hidden" value="update-product" />
              <input name="productId" type="hidden" value={product.id} />
              <ProductFields pending={pending} product={product} />
              <div className="flex items-end gap-3">
                <Button disabled={pending} type="submit" variant="dark">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save product
                </Button>
              </div>
            </form>

            <form action={formAction} className="mt-3 flex justify-end">
              <input name="intent" type="hidden" value="archive-product" />
              <input name="productId" type="hidden" value={product.id} />
              <Button disabled={pending || product.status === "archived"} size="sm" type="submit" variant="pink">
                <Archive className="h-4 w-4" aria-hidden="true" />
                Archive
              </Button>
            </form>

            <section className="mt-5 rounded-md border border-bc-line bg-bc-ink p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-lg font-black">Variants</h4>
                  <p className="mt-1 text-sm text-bc-muted">SKU, price, and stock options for this product.</p>
                </div>
                <Badge tone="muted">{product.slug}</Badge>
              </div>

              <form action={formAction} className="mt-4 grid gap-4 xl:grid-cols-[1fr_180px_140px_120px_auto]">
                <input name="intent" type="hidden" value="create-variant" />
                <VariantFields pending={pending} productId={product.id} />
                <div className="flex items-end">
                  <Button disabled={pending} type="submit" variant="primary">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add
                  </Button>
                </div>
              </form>

              <div className="mt-4 grid gap-3">
                {product.variants.map((variant) => (
                  <form
                    action={formAction}
                    className="grid gap-4 rounded-md border border-bc-line bg-bc-panel p-4 xl:grid-cols-[1fr_180px_140px_120px_auto]"
                    key={variant.id}
                  >
                    <input name="intent" type="hidden" value="update-variant" />
                    <VariantFields pending={pending} productId={product.id} variant={variant} />
                    <div className="flex items-end">
                      <Button disabled={pending} type="submit" variant="dark">
                        <Save className="h-4 w-4" aria-hidden="true" />
                        Save
                      </Button>
                    </div>
                  </form>
                ))}
                {!product.variants.length ? (
                  <article className="rounded-md border border-bc-line bg-bc-panel p-5">
                    <Boxes className="h-7 w-7 text-bc-acid" aria-hidden="true" />
                    <h4 className="mt-4 text-xl font-black">No variants yet</h4>
                    <p className="mt-2 text-sm text-bc-muted">Add at least one variant before listing stock publicly.</p>
                  </article>
                ) : null}
              </div>
            </section>
          </article>
        ))}

        {!visibleProducts.length ? (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <ShoppingBag className="h-7 w-7 text-bc-pink" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-black">{activeRepair ? "No products match this repair filter" : "No products yet"}</h3>
            <p className="mt-2 text-sm text-bc-muted">
              {activeRepair ? "This repair category is currently clean." : "Create the first product record to start building the shop catalogue."}
            </p>
          </article>
        ) : null}
      </div>
    </div>
  );
}
