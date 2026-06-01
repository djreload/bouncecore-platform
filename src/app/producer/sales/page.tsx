import { CreditCard, Send, Wallet } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireUserPermission } from "@/lib/auth/guards";
import { getProducerWorkspaceData } from "@/lib/music/music-service";
import { getPayPalIntegrationData } from "@/lib/payments/paypal-service";

export const dynamic = "force-dynamic";

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

export default async function ProducerSalesPage() {
  const user = await requireUserPermission("producer.dashboard");
  const [data, paypal] = await Promise.all([getProducerWorkspaceData(user.id), getPayPalIntegrationData()]);
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
          <Badge tone="pink">Catalogue</Badge>
          <p className="mt-4 text-3xl font-black">{formatMoney(approvedValue)}</p>
          <p className="mt-2 text-sm text-bc-muted">Approved track list value.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Provider</Badge>
          <p className="mt-4 text-3xl font-black">PayPal</p>
          <p className="mt-2 text-sm text-bc-muted">Producer payout rail.</p>
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
              Bouncecore will settle producer earnings through PayPal Payouts once track purchases, entitlements, and payout
              recipient onboarding are connected.
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
            <h4 className="mt-3 font-black">Payout method</h4>
            <p className="mt-2 text-sm text-bc-muted">Producer payouts use PayPal Payouts API.</p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <Send className="h-5 w-5 text-bc-acid" aria-hidden="true" />
            <h4 className="mt-3 font-black">Admin setup</h4>
            <p className="mt-2 text-sm text-bc-muted">Admins manage PayPal readiness in the payments control room.</p>
          </article>
        </div>
        <div className="mt-5">
          <ButtonLink href="/producer/tracks" variant="ghost">
            Manage tracks
          </ButtonLink>
        </div>
      </section>
    </DashboardShell>
  );
}
