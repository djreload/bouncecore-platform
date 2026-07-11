/* eslint-disable @next/next/no-img-element */
import { Boxes, CreditCard, PackageCheck, ShoppingBag, Tags } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth/session";
import { getPayPalCheckoutReadiness, getPayPalIntegrationData } from "@/lib/payments/paypal-service";
import { getSquareIntegrationData, getSquareShopReadiness } from "@/lib/payments/square-service";
import { getPublicShopProducts } from "@/lib/shop/shop-service";
import { ShopCartButton, ShopCartProvider, type ShopCartVariant } from "./shop-cart-panel";

export const dynamic = "force-dynamic";

type ShopPageProps = {
  searchParams?: Promise<{
    checkout?: string | string[];
  }>;
};

const checkoutMessages: Record<string, { message: string; tone: "acid" | "amber" | "pink" }> = {
  cancelled: {
    message: "Checkout was cancelled.",
    tone: "amber"
  },
  "capture-error": {
    message: "The payment was approved, but the capture could not be completed.",
    tone: "pink"
  },
  error: {
    message: "Checkout could not start for that product.",
    tone: "pink"
  },
  "paypal-not-ready": {
    message: "PayPal shop checkout needs client ID and server secret configuration before purchases can start.",
    tone: "pink"
  },
  "paypal-api-error": {
    message: "PayPal rejected the shop checkout request. Check sandbox/live mode and API credentials, then try again.",
    tone: "pink"
  },
  "square-not-ready": {
    message: "Square shop checkout needs application, location, and access token configuration before purchases can start.",
    tone: "pink"
  },
  "square-api-error": {
    message: "Square rejected the shop checkout request. Check sandbox/live mode and API credentials, then try again.",
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
  const [products, paypal, square, currentUser] = await Promise.all([
    getPublicShopProducts(),
    getPayPalIntegrationData(),
    getSquareIntegrationData(),
    getCurrentUser()
  ]);
  const variantCount = products.reduce((total, product) => total + product.variantCount, 0);
  const totalStock = products.reduce((total, product) => total + product.totalStock, 0);
  const paypalReadiness = getPayPalCheckoutReadiness(paypal.settings, paypal.secretConfigured);
  const squareReadiness = getSquareShopReadiness(square.settings, square.accessTokenConfigured);
  const checkoutReady = paypalReadiness.ready || squareReadiness.ready;
  const checkoutReason = checkoutReady ? null : [paypalReadiness.reason, squareReadiness.reason].filter(Boolean).join(" ");
  const checkoutMessage = checkoutMessages[firstParam(params.checkout) ?? ""];
  const cartVariants: ShopCartVariant[] = products.flatMap((product) =>
    product.variants.map((variant) => ({
      id: variant.id,
      imageUrl: product.imageUrl,
      pricePence: variant.pricePence,
      productName: product.name,
      sku: variant.sku,
      stock: variant.stock,
      variantName: variant.name
    }))
  );

  return (
    <PublicShell>
      <ShopCartProvider
        checkoutReady={checkoutReady}
        checkoutReason={checkoutReason}
        paypalReady={paypalReadiness.ready}
        squareReady={squareReadiness.ready}
        signedIn={Boolean(currentUser)}
        variants={cartVariants}
      >
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
                      <ShopCartButton disabled={variant.stock < 1} size="sm" variantId={variant.id} />
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
            <h2 className="mt-4 text-xl font-black">Checkout</h2>
            <p className="mt-2 text-sm text-bc-muted">
              Shop purchases can use PayPal {paypal.settings.mode}
              {square.settings.shopEnabled ? ` or Square ${square.settings.mode}` : ""} checkout.{" "}
              {checkoutReady ? "Checkout is ready for active products." : checkoutReason}
            </p>
          </article>
        </section>
        </main>
      </ShopCartProvider>
    </PublicShell>
  );
}
