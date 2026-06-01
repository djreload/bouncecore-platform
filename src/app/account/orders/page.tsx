import { Clock3, CreditCard, PackageCheck, ShoppingBag, Truck } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireSignedInUser } from "@/lib/auth/guards";
import { getPayPalIntegrationData } from "@/lib/payments/paypal-service";
import { getAccountOrdersData } from "@/lib/shop/order-service";

export const dynamic = "force-dynamic";

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

export default async function AccountOrdersPage() {
  const user = await requireSignedInUser();
  const [data, paypal] = await Promise.all([getAccountOrdersData(user.id), getPayPalIntegrationData()]);

  return (
    <DashboardShell title="Orders" description="Your Bouncecore order history, PayPal payment status, and fulfilment progress.">
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
            <Badge tone="pink">PayPal orders</Badge>
            <h3 className="mt-4 text-2xl font-black">Order history</h3>
            <p className="mt-2 max-w-3xl text-sm text-bc-muted">
              Bouncecore purchases use PayPal {paypal.settings.mode} checkout. Completed shop and marketplace orders will appear here.
            </p>
          </div>
          <CreditCard className="h-7 w-7 text-bc-pink" aria-hidden="true" />
        </div>
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
          <p className="mt-1 text-sm text-bc-muted">Order records currently store total, status, and creation date.</p>
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
                    </div>
                    <p className="mt-2 text-sm text-bc-muted">{formatDate(order.createdAt)}</p>
                  </div>
                </div>
                <p className="text-2xl font-black">{formatMoney(order.totalPence)}</p>
              </div>
            </article>
          ))}

          {!data.orders.length ? (
            <article className="rounded-md border border-bc-line bg-bc-ink p-5">
              <Clock3 className="h-7 w-7 text-bc-acid" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-black">No orders yet</h3>
              <p className="mt-2 text-sm text-bc-muted">Your PayPal checkout orders will appear here once purchases are connected.</p>
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
