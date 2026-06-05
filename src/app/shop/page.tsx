/* eslint-disable @next/next/no-img-element */
import { Boxes, CreditCard, LogIn, PackageCheck, ShoppingBag, Tags } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getPayPalCheckoutReadiness, getPayPalIntegrationData } from "@/lib/payments/paypal-service";
import { getPublicShopProducts } from "@/lib/shop/shop-service";

export const dynamic = "force-dynamic";

type ShopPageProps = {
  searchParams?: Promise<{
    checkout?: string | string[];
  }>;
};

const checkoutMessages: Record<string, { message: string; tone: "acid" | "amber" | "pink" }> = {
  cancelled: {
    message: "PayPal checkout was cancelled.",
    tone: "amber"
  },
  "capture-error": {
    message: "PayPal approved the checkout, but the capture could not be completed.",
    tone: "pink"
  },
  error: {
    message: "Checkout could not start for that product.",
    tone: "pink"
  },
  "paypal-not-ready": {
    message: "PayPal shop checkout needs client ID and server secret configuration before purchases can start.",
    tone: "pink"
  }
};

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function messageClass(tone: "acid" | "amber" | "pink") {
  if (tone === "acid") {
    return "border-bc-acid/30 bg-bc-acid/10 text-bc-acid";
  }

  if (tone === "amber") {
    return "border-amber-300/30 bg-amber-300/10 text-amber-200";
  }

  return "border-bc-pink/30 bg-bc-pink/10 text-bc-pink";
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = searchParams ? await searchParams : {};
  const [products, paypal, currentUser] = await Promise.all([
    getPublicShopProducts(),
    getPayPalIntegrationData(),
    getCurrentUser()
  ]);
  const variantCount = products.reduce((total, product) => total + product.variantCount, 0);
  const totalStock = products.reduce((total, product) => total + product.totalStock, 0);
  const checkoutReadiness = getPayPalCheckoutReadiness(paypal.settings, paypal.secretConfigured);
  const checkoutMessage = checkoutMessages[firstParam(params.checkout) ?? ""];

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
          {checkoutMessage ? (
            <div className={`mt-5 rounded-md border p-3 text-sm ${messageClass(checkoutMessage.tone)}`}>
              {checkoutMessage.message}
            </div>
          ) : null}
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={product.id}>
              <div className="mb-5 aspect-square overflow-hidden rounded-md border border-bc-line bg-bc-ink">
                {product.imageUrl ? (
                  <img alt={product.name} className="h-full w-full object-cover" src={product.imageUrl} />
                ) : (
                  <div className="grid h-full place-items-center">
                    <ShoppingBag className="h-12 w-12 text-bc-pink" aria-hidden="true" />
                  </div>
                )}
              </div>
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
                  <div className="rounded-md border border-bc-line bg-bc-ink p-3" key={variant.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{variant.name}</p>
                        <p className="mt-1 text-xs text-bc-muted">{variant.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatMoney(variant.pricePence)}</p>
                        <p className="mt-1 text-xs text-bc-muted">{variant.stock} available</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      {!currentUser ? (
                        <ButtonLink href="/auth/login?error=auth-required" size="sm" variant="ghost">
                          <LogIn className="h-4 w-4" aria-hidden="true" />
                          Login to checkout
                        </ButtonLink>
                      ) : (
                        <form action="/shop/checkout" className="grid gap-3 sm:grid-cols-[96px_1fr]" method="post">
                          <input name="variantId" type="hidden" value={variant.id} />
                          <label className="sr-only" htmlFor={`quantity-${variant.id}`}>
                            Quantity
                          </label>
                          <input
                            className="min-h-9 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                            defaultValue={1}
                            disabled={!checkoutReadiness.ready || variant.stock < 1}
                            id={`quantity-${variant.id}`}
                            max={Math.min(variant.stock, 10)}
                            min={1}
                            name="quantity"
                            step={1}
                            type="number"
                          />
                          <Button disabled={!checkoutReadiness.ready || variant.stock < 1} size="sm" type="submit" variant="primary">
                            <CreditCard className="h-4 w-4" aria-hidden="true" />
                            PayPal checkout
                          </Button>
                        </form>
                      )}
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
              Shop purchases are routed through PayPal {paypal.settings.mode} checkout.{" "}
              {checkoutReadiness.ready
                ? "Checkout is ready for active products."
                : (checkoutReadiness.reason ?? "Admins can manage PayPal settings in the payments control room.")}
            </p>
          </article>
        </section>
      </main>
    </PublicShell>
  );
}
