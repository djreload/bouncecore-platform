import { Boxes, CreditCard, PackageCheck, ShoppingBag, Tags } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { getPayPalIntegrationData } from "@/lib/payments/paypal-service";
import { getPublicShopProducts } from "@/lib/shop/shop-service";

export const dynamic = "force-dynamic";

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

export default async function ShopPage() {
  const [products, paypal] = await Promise.all([getPublicShopProducts(), getPayPalIntegrationData()]);
  const variantCount = products.reduce((total, product) => total + product.variantCount, 0);
  const totalStock = products.reduce((total, product) => total + product.totalStock, 0);

  return (
    <PublicShell>
      <main className="mx-auto max-w-7xl px-4 py-10">
        <section className="rounded-md border border-bc-line bg-bc-panel p-6">
          <Badge tone="pink">Merch shop</Badge>
          <h1 className="mt-4 text-4xl font-black">Shop</h1>
          <p className="mt-3 max-w-3xl text-bc-muted">
            Active Bouncecore products, variants, prices, and live stock levels from the merch catalogue.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="cyan">Products</Badge>
              <p className="mt-3 text-3xl font-black">{products.length}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="acid">Variants</Badge>
              <p className="mt-3 text-3xl font-black">{variantCount}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="amber">Stock</Badge>
              <p className="mt-3 text-3xl font-black">{totalStock}</p>
            </article>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={product.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge tone={product.totalStock ? "acid" : "amber"}>{product.totalStock ? "In stock" : "Out of stock"}</Badge>
                  <h2 className="mt-4 text-2xl font-black">{product.name}</h2>
                </div>
                <ShoppingBag className="h-7 w-7 text-bc-pink" aria-hidden="true" />
              </div>
              <p className="mt-4 text-sm text-bc-muted">{product.description ?? "Bouncecore merch catalogue item."}</p>

              <div className="mt-5 grid gap-3 text-sm">
                {product.variants.map((variant) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink p-3"
                    key={variant.id}
                  >
                    <div>
                      <p className="font-semibold">{variant.name}</p>
                      <p className="mt-1 text-xs text-bc-muted">{variant.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatMoney(variant.pricePence)}</p>
                      <p className="mt-1 text-xs text-bc-muted">{variant.stock} available</p>
                    </div>
                  </div>
                ))}
                {!product.variants.length ? (
                  <div className="rounded-md border border-bc-line bg-bc-ink p-3 text-sm text-bc-muted">No variants listed.</div>
                ) : null}
              </div>
            </article>
          ))}

          {!products.length ? (
            <article className="rounded-md border border-bc-line bg-bc-panel p-5 md:col-span-2 xl:col-span-3">
              <PackageCheck className="h-7 w-7 text-bc-acid" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-black">No active products yet</h2>
              <p className="mt-2 text-sm text-bc-muted">Active merch products will appear here automatically.</p>
            </article>
          ) : null}
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <Boxes className="h-7 w-7 text-bc-electric" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-black">Variant stock</h2>
            <p className="mt-2 text-sm text-bc-muted">Each visible item is backed by SKU-level stock from the admin catalogue.</p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <Tags className="h-7 w-7 text-bc-pink" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-black">Live pricing</h2>
            <p className="mt-2 text-sm text-bc-muted">Prices update on this page as soon as product variants are saved.</p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-panel p-5 md:col-span-2">
            <CreditCard className="h-7 w-7 text-bc-acid" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-black">PayPal checkout</h2>
            <p className="mt-2 text-sm text-bc-muted">
              Shop purchases are routed through PayPal {paypal.settings.mode} checkout. Admins can manage PayPal settings in the
              payments control room.
            </p>
          </article>
        </section>
      </main>
    </PublicShell>
  );
}
