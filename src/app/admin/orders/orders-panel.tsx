"use client";

import { useActionState } from "react";
import { CheckCircle2, Clock3, PackageCheck, Save, Truck, WalletCards } from "lucide-react";
import { adminOrdersAction } from "@/app/admin/orders/actions";
import { initialAdminOrdersActionState, type AdminOrdersActionState } from "@/app/admin/orders/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OrdersData } from "@/lib/shop/order-service";

type AdminOrdersPanelProps = {
  data: OrdersData;
  mode?: "orders" | "fulfilment";
};

const orderStatusOptions = ["pending", "paid", "processing", "fulfilled", "cancelled", "refunded"] as const;

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

function shippingLines(order: OrdersData["orders"][number]) {
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

export function AdminOrdersPanel({ data, mode = "orders" }: AdminOrdersPanelProps) {
  const [state, formAction, pending] = useActionState<AdminOrdersActionState, FormData>(
    adminOrdersAction,
    initialAdminOrdersActionState
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">{mode === "fulfilment" ? "Queue" : "Orders"}</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.totalOrders}</p>
          <p className="mt-2 text-sm text-bc-muted">{mode === "fulfilment" ? "Orders waiting fulfilment." : "Total order records."}</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Gross</Badge>
          <p className="mt-4 text-3xl font-black">{formatMoney(data.stats.grossPence)}</p>
          <p className="mt-2 text-sm text-bc-muted">Non-cancelled order total.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Processing</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.processingOrders}</p>
          <p className="mt-2 text-sm text-bc-muted">Currently being handled.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Fulfilled</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.fulfilledOrders}</p>
          <p className="mt-2 text-sm text-bc-muted">Completed orders.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone={mode === "fulfilment" ? "amber" : "pink"}>{mode === "fulfilment" ? "Fulfilment" : "Merch shop"}</Badge>
            <h3 className="mt-4 text-2xl font-black">{mode === "fulfilment" ? "Fulfilment queue" : "Order management"}</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              {mode === "fulfilment"
                ? "Move paid orders through processing and fulfilled states as they are handled."
                : "Review PayPal-backed order totals and manage order lifecycle status."}
            </p>
          </div>
          {mode === "fulfilment" ? (
            <Truck className="h-7 w-7 text-bc-acid" aria-hidden="true" />
          ) : (
            <WalletCards className="h-7 w-7 text-bc-pink" aria-hidden="true" />
          )}
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

      <section className="rounded-md border border-bc-line bg-bc-panel">
        <div className="border-b border-bc-line p-4">
          <h3 className="text-xl font-black">{mode === "fulfilment" ? "Ready to fulfil" : "Recent orders"}</h3>
          <p className="mt-1 text-sm text-bc-muted">
            Order records include customer, status, PayPal order total, line items, and capture references.
          </p>
        </div>
        <div className="grid gap-4 p-4">
          {data.orders.map((order) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={order.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={statusTone(order.status)}>{order.status}</Badge>
                    <Badge tone="muted">#{order.id.slice(0, 8)}</Badge>
                  </div>
                  <h4 className="mt-3 text-lg font-black">{order.customerName}</h4>
                  <p className="mt-1 text-sm text-bc-muted">{order.customerEmail}</p>
                  <p className="mt-1 text-xs text-bc-muted">{formatDate(order.createdAt)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {order.paypalOrderId ? <Badge tone="muted">PayPal {order.paypalOrderId.slice(0, 10)}</Badge> : null}
                    {order.paypalCaptureId ? <Badge tone="acid">Captured</Badge> : null}
                    {order.paypalPayerEmail ? <Badge tone="cyan">{order.paypalPayerEmail}</Badge> : null}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black">{formatMoney(order.totalPence)}</p>
                  <p className="mt-1 text-xs text-bc-muted">PayPal order total</p>
                </div>
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
                          {item.sku} / Qty {item.quantity} / {formatMoney(item.unitPricePence)} each
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

              <div className="mt-4 rounded-md border border-bc-line bg-bc-panel p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black">Shipping address</p>
                    <div className="mt-2 space-y-1 text-bc-muted">
                      {shippingLines(order).length ? (
                        shippingLines(order).map((line) => <p key={line}>{line}</p>)
                      ) : (
                        <p>No shipping address captured.</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-bc-muted">
                    {order.shippingAddress.email ? <p>{order.shippingAddress.email}</p> : null}
                    {order.shippingAddress.phone ? <p className="mt-1">{order.shippingAddress.phone}</p> : null}
                  </div>
                </div>
              </div>

              <form action={formAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                <input name="orderId" type="hidden" value={order.id} />
                <label className="sr-only" htmlFor={`status-${order.id}`}>
                  Order status
                </label>
                <select
                  className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={order.status}
                  disabled={pending}
                  id={`status-${order.id}`}
                  name="status"
                >
                  {orderStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <Button disabled={pending} type="submit" variant="dark">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save status
                </Button>
              </form>
            </article>
          ))}

          {!data.orders.length ? (
            <article className="rounded-md border border-bc-line bg-bc-ink p-5">
              {mode === "fulfilment" ? (
                <CheckCircle2 className="h-7 w-7 text-bc-acid" aria-hidden="true" />
              ) : (
                <Clock3 className="h-7 w-7 text-bc-acid" aria-hidden="true" />
              )}
              <h3 className="mt-4 text-xl font-black">{mode === "fulfilment" ? "No fulfilment queue" : "No orders yet"}</h3>
              <p className="mt-2 text-sm text-bc-muted">
                {mode === "fulfilment"
                  ? "Paid and processing orders will appear here automatically."
                  : "PayPal checkout orders will appear here once purchases are connected."}
              </p>
            </article>
          ) : null}
        </div>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <PackageCheck className="h-7 w-7 text-bc-acid" aria-hidden="true" />
        <h3 className="mt-4 text-xl font-black">PayPal fulfilment trail</h3>
        <p className="mt-2 text-sm text-bc-muted">
          New shop checkouts create pending orders, redirect through PayPal approval, capture on return, and move paid orders into this
          queue.
        </p>
      </section>
    </div>
  );
}
