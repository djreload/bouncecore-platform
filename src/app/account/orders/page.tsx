import { Clock3, CreditCard, PackageCheck, ShoppingBag, Truck } from "lucide-react";
import { CartStorageClearer } from "@/components/checkout/cart-storage-clearer";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireSignedInUser } from "@/lib/auth/guards";
import { shopCartStorageKey } from "@/lib/cart/storage-keys";
import { getPayPalIntegrationData } from "@/lib/payments/paypal-service";
import { getSquareIntegrationData } from "@/lib/payments/square-service";
import { getAccountOrdersData } from "@/lib/shop/order-service";

export const dynamic = "force-dynamic";

type AccountOrdersPageProps = {
  searchParams?: Promise<{
    checkout?: string | string[];
  }>;
};

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusTone(status: string) {
  if (status === "fulfilled" || status === "paid") {
    return "acid" as const;
  }

  if (status === "processing" || status === "pending") {
    return "amber" as const;
  }

  if (status === "cancelled" || status === "refunded") {
    return "muted" as const;
  }

  return "cyan" as const;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function shippingLines(order: Awaited<ReturnType<typeof getAccountOrdersData>>["orders"][number]) {
  const address = order.shippingAddress;

  return [
    address.name,
    address.line1,
    address.line2,
    [address.city, address.county].filter(Boolean).join(", "),
    address.postcode,
    address.country
  ].filter((line): line is string => Boolean(line));
}

export default async function AccountOrdersPage({ searchParams }: AccountOrdersPageProps) {
  const params = searchParams ? await searchParams : {};
  const user = await requireSignedInUser();
  const [data, paypal, square] = await Promise.all([getAccountOrdersData(user.id), getPayPalIntegrationData(), getSquareIntegrationData()]);
  const checkoutComplete = firstParam(params.checkout) === "success";

  return (
    <DashboardShell title="Orders" description="Your Bouncecore order history, PayPal payment status, and fulfilment progress.">
      {checkoutComplete ? <CartStorageClearer storageKey={shopCartStorageKey} /> : null}
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Orders</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.totalOrders}</p>
          <p className="mt-2 text-sm text-bc-muted">Total orders on your account.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Spend</Badge>
          <p className="mt-4 text-3xl font-black">{formatMoney(data.stats.grossPence)}</p>
          <p className="mt-2 text-sm text-bc-muted">Non-cancelled order total.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Active</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.activeFulfilment}</p>
          <p className="mt-2 text-sm text-bc-muted">Paid or processing orders.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Fulfilled</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.fulfilledOrders}</p>
          <p className="mt-2 text-sm text-bc-muted">Completed order records.</p>
        </article>
      </div>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Shop orders</Badge>
            <h3 className="mt-4 text-2xl font-black">Order history</h3>
            <p className="mt-2 max-w-3xl text-sm text-bc-muted">
              Bouncecore merch can use PayPal {paypal.settings.mode}
              {square.settings.shopEnabled ? ` or Square ${square.settings.mode}` : ""} checkout. Producer music purchases stay on PayPal.
            </p>
          </div>
          <CreditCard className="h-7 w-7 text-bc-pink" aria-hidden="true" />
        </div>
        {checkoutComplete ? (
          <div className="mt-5 rounded-md border border-bc-acid/30 bg-bc-acid/10 p-3 text-sm text-bc-acid">
            Checkout complete. Your order is now in the fulfilment queue.
          </div>
        ) : null}
        <div className="mt-5">
          <ButtonLink href="/shop" variant="primary">
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            Shop
          </ButtonLink>
        </div>
      </section>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel">
        <div className="border-b border-bc-line p-4">
          <h3 className="text-xl font-black">Recent orders</h3>
          <p className="mt-1 text-sm text-bc-muted">Order records include payment capture status, totals, line items, and fulfilment state.</p>
        </div>
        <div className="grid gap-4 p-4">
          {data.orders.map((order) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={order.id}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Truck className="h-5 w-5 text-bc-acid" aria-hidden="true" />
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={statusTone(order.status)}>{order.status}</Badge>
                      <Badge tone="muted">#{order.id.slice(0, 8)}</Badge>
                      <Badge tone="cyan">{order.paymentProvider}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-bc-muted">{formatDate(order.createdAt)}</p>
                  </div>
                </div>
                <p className="text-2xl font-black">{formatMoney(order.totalPence)}</p>
              </div>
              <div className="mt-4 grid gap-2">
                {order.items.map((item) => (
                  <div className="rounded-md border border-bc-line bg-bc-panel p-3 text-sm" key={item.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {item.productName} / {item.variantName}
                        </p>
                        <p className="mt-1 text-xs text-bc-muted">
                          {item.sku} / Qty {item.quantity}
                        </p>
                      </div>
                      <p className="font-semibold">{formatMoney(item.totalPence)}</p>
                    </div>
                  </div>
                ))}
                {!order.items.length ? (
                  <p className="text-sm text-bc-muted">Legacy order without line item detail.</p>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {order.paypalOrderId ? <Badge tone="muted">PayPal {order.paypalOrderId.slice(0, 10)}</Badge> : null}
                {order.paypalCaptureId ? <Badge tone="acid">Captured</Badge> : null}
                {order.squareOrderId ? <Badge tone="muted">Square {order.squareOrderId.slice(0, 10)}</Badge> : null}
                {order.squarePaymentId ? <Badge tone="acid">Captured</Badge> : null}
              </div>
              <div className="mt-4 rounded-md border border-bc-line bg-bc-panel p-3 text-sm">
                <p className="font-black">Shipping address</p>
                <div className="mt-2 space-y-1 text-bc-muted">
                  {shippingLines(order).length ? (
                    shippingLines(order).map((line) => <p key={line}>{line}</p>)
                  ) : (
                    <p>No shipping address captured.</p>
                  )}
                </div>
              </div>
            </article>
          ))}

          {!data.orders.length ? (
            <article className="rounded-md border border-bc-line bg-bc-ink p-5">
              <Clock3 className="h-7 w-7 text-bc-acid" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-black">No orders yet</h3>
              <p className="mt-2 text-sm text-bc-muted">Your checkout orders will appear here once purchases are connected.</p>
            </article>
          ) : null}
        </div>
      </section>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel p-5">
        <PackageCheck className="h-7 w-7 text-bc-acid" aria-hidden="true" />
        <h3 className="mt-4 text-xl font-black">Fulfilment updates</h3>
        <p className="mt-2 text-sm text-bc-muted">
          Admin fulfilment status changes will update this history as orders move through paid, processing, and fulfilled states.
        </p>
      </section>
    </DashboardShell>
  );
}
