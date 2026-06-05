import { CreditCard, Send, Wallet } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireUserPermission } from "@/lib/auth/guards";
import { getProducerSalesData, getProducerWorkspaceData } from "@/lib/music/music-service";
import { getPayPalIntegrationData } from "@/lib/payments/paypal-service";

export const dynamic = "force-dynamic";

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusTone(status: string) {
  if (status === "paid") {
    return "acid" as const;
  }

  if (status === "pending") {
    return "amber" as const;
  }

  if (status === "cancelled") {
    return "muted" as const;
  }

  return "cyan" as const;
}

function payoutTone(status: string | null) {
  if (!status) {
    return "amber" as const;
  }

  if (status === "success") {
    return "acid" as const;
  }

  if (["failed", "returned", "blocked"].includes(status)) {
    return "pink" as const;
  }

  return "cyan" as const;
}

export default async function ProducerSalesPage() {
  const user = await requireUserPermission("producer.dashboard");
  const [data, sales, paypal] = await Promise.all([
    getProducerWorkspaceData(user.id),
    getProducerSalesData(user.id),
    getPayPalIntegrationData()
  ]);
  const approvedValue = data.tracks
    .filter((track) => track.status === "approved")
    .reduce((total, track) => total + track.pricePence, 0);

  return (
    <DashboardShell
      mode="producer"
      title="Sales"
      description="Producer catalogue value, payout readiness, and PayPal payout routing."
    >
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Approved</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.approvedTracks}</p>
          <p className="mt-2 text-sm text-bc-muted">Tracks eligible for public sales.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Payable</Badge>
          <p className="mt-4 text-3xl font-black">{formatMoney(sales.stats.payablePence)}</p>
          <p className="mt-2 text-sm text-bc-muted">Not yet queued for PayPal payout.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Sales</Badge>
          <p className="mt-4 text-3xl font-black">{sales.stats.paidSales}</p>
          <p className="mt-2 text-sm text-bc-muted">{formatMoney(sales.stats.grossPence)} gross paid sales.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={paypal.settings.producerPayoutsEnabled ? "acid" : "amber"}>Payouts</Badge>
          <p className="mt-4 text-3xl font-black">{paypal.settings.producerPayoutsEnabled ? "On" : "Off"}</p>
          <p className="mt-2 text-sm text-bc-muted">PayPal {paypal.settings.mode} mode.</p>
        </article>
      </div>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="acid">PayPal Payouts</Badge>
            <h3 className="mt-4 text-2xl font-black">Producer payout routing</h3>
            <p className="mt-2 max-w-3xl text-sm text-bc-muted">
              Paid music purchases create producer earnings records. PayPal Payouts settle those earnings when your payout email is set
              on your producer profile.
            </p>
          </div>
          <Send className="h-7 w-7 text-bc-acid" aria-hidden="true" />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <CreditCard className="h-5 w-5 text-bc-electric" aria-hidden="true" />
            <h4 className="mt-3 font-black">Payment source</h4>
            <p className="mt-2 text-sm text-bc-muted">Music purchases use PayPal checkout.</p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <Wallet className="h-5 w-5 text-bc-pink" aria-hidden="true" />
            <h4 className="mt-3 font-black">Earnings</h4>
            <p className="mt-2 text-sm text-bc-muted">
              {formatMoney(sales.stats.producerEarningsPence)} earned after platform fees.
            </p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <Send className="h-5 w-5 text-bc-acid" aria-hidden="true" />
            <h4 className="mt-3 font-black">PayPal payouts</h4>
            <p className="mt-2 text-sm text-bc-muted">
              {formatMoney(sales.stats.payoutPendingPence)} queued / {formatMoney(sales.stats.payoutPaidPence)} paid.
            </p>
          </article>
        </div>
        <div className="mt-5">
          <ButtonLink href="/producer/profile" variant={data.profile?.paypalPayoutEmail ? "ghost" : "primary"}>
            {data.profile?.paypalPayoutEmail ? "Edit payout email" : "Add payout email"}
          </ButtonLink>
        </div>
      </section>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel">
        <div className="border-b border-bc-line p-4">
          <h3 className="text-xl font-black">Music sales</h3>
          <p className="mt-1 text-sm text-bc-muted">
            Paid track purchases create payout-ready earnings records for PayPal payout batches.
          </p>
          <p className="mt-1 text-xs text-bc-muted">Approved catalogue list value: {formatMoney(approvedValue)}</p>
        </div>
        <div className="grid gap-4 p-4">
          {sales.sales.map((sale) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={sale.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={statusTone(sale.status)}>{sale.status}</Badge>
                    <Badge tone="muted">#{sale.id.slice(0, 8)}</Badge>
                    {sale.paypalCaptureId ? <Badge tone="acid">Captured</Badge> : null}
                  </div>
                  <h4 className="mt-3 text-lg font-black">{sale.trackTitle}</h4>
                  <p className="mt-1 text-sm text-bc-muted">
                    {sale.buyerName} / {sale.buyerEmail}
                  </p>
                  <p className="mt-1 text-xs text-bc-muted">{formatDate(sale.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black">{formatMoney(sale.producerEarningsPence)}</p>
                  <p className="mt-1 text-xs text-bc-muted">Producer earnings</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="cyan">Gross {formatMoney(sale.pricePence)}</Badge>
                <Badge tone="muted">Fee {formatMoney(sale.platformFeePence)}</Badge>
                <Badge tone={payoutTone(sale.payoutStatus)}>{sale.payoutStatus ?? "not queued"}</Badge>
                {sale.payoutSenderBatchId ? <Badge tone="muted">Batch {sale.payoutSenderBatchId.slice(0, 18)}</Badge> : null}
                {sale.payoutRecipientEmail ? <Badge tone="cyan">{sale.payoutRecipientEmail}</Badge> : null}
                {sale.paypalOrderId ? <Badge tone="muted">PayPal {sale.paypalOrderId.slice(0, 10)}</Badge> : null}
              </div>
            </article>
          ))}
          {!sales.sales.length ? (
            <article className="rounded-md border border-bc-line bg-bc-ink p-5">
              <Wallet className="h-7 w-7 text-bc-pink" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-black">No music sales yet</h3>
              <p className="mt-2 text-sm text-bc-muted">PayPal track purchases will appear here after checkout starts.</p>
            </article>
          ) : null}
        </div>
      </section>
    </DashboardShell>
  );
}
