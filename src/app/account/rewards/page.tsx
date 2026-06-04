import { CreditCard, Gift, ShoppingBag, Sparkles, Star, Trophy } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { requireSignedInUser } from "@/lib/auth/guards";
import { getPayPalIntegrationData, getPayPalStarsReadiness } from "@/lib/payments/paypal-service";
import { getAccountRewardsData, starPackages } from "@/lib/rewards/stars-service";

export const dynamic = "force-dynamic";

type AccountRewardsPageProps = {
  searchParams?: Promise<{
    checkout?: string | string[];
  }>;
};

const checkoutMessages: Record<string, { message: string; tone: "acid" | "amber" | "pink" }> = {
  cancelled: {
    message: "PayPal stars checkout was cancelled.",
    tone: "amber"
  },
  "capture-error": {
    message: "PayPal approved the stars purchase, but the capture could not be completed.",
    tone: "pink"
  },
  error: {
    message: "Stars checkout could not start for that package.",
    tone: "pink"
  },
  "paypal-not-ready": {
    message: "PayPal stars checkout needs client ID and server secret configuration before purchases can start.",
    tone: "pink"
  },
  success: {
    message: "PayPal stars checkout complete. Your wallet has been credited.",
    tone: "acid"
  }
};

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
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

export default async function AccountRewardsPage({ searchParams }: AccountRewardsPageProps) {
  const params = searchParams ? await searchParams : {};
  const user = await requireSignedInUser();
  const [data, paypal] = await Promise.all([getAccountRewardsData(user.id), getPayPalIntegrationData()]);
  const checkoutReadiness = getPayPalStarsReadiness(paypal.settings, paypal.secretConfigured);
  const checkoutMessage = checkoutMessages[firstParam(params.checkout) ?? ""];

  return (
    <DashboardShell title="Stars" description="Buy stars through PayPal, send them in live chat, and compete on live stream support leaderboards.">
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Stars</Badge>
          <p className="mt-4 text-3xl font-black">{data.wallet.balance.toLocaleString("en-GB")}</p>
          <p className="mt-2 text-sm text-bc-muted">Current wallet balance.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Sent</Badge>
          <p className="mt-4 text-3xl font-black">{data.sentStats.sentStars.toLocaleString("en-GB")}</p>
          <p className="mt-2 text-sm text-bc-muted">{data.sentStats.sendCount} live chat star sends.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.supporter ? "amber" : "muted"}>{data.supporter ? "Supporter" : "Member"}</Badge>
          <p className="mt-4 text-3xl font-black">{data.supporter ? "VIP" : "Base"}</p>
          <p className="mt-2 text-sm text-bc-muted">Current supporter status.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Purchases</Badge>
          <p className="mt-4 text-3xl font-black">{data.purchaseStats.paidPurchases}</p>
          <p className="mt-2 text-sm text-bc-muted">{data.purchaseStats.purchasedStars.toLocaleString("en-GB")} stars bought.</p>
        </article>
      </div>

      {checkoutMessage ? (
        <div className={`mt-5 rounded-md border p-3 text-sm ${messageClass(checkoutMessage.tone)}`}>
          {checkoutMessage.message}
        </div>
      ) : null}

      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge tone="pink">Stars wallet</Badge>
              <h3 className="mt-4 text-2xl font-black">{user.displayName}</h3>
              <p className="mt-2 max-w-2xl text-sm text-bc-muted">
                Stars are a fun way to support the site during livestreams. Send them in live chat to trigger stream alerts.
              </p>
            </div>
            <Sparkles className="h-7 w-7 text-bc-pink" aria-hidden="true" />
          </div>

          <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Star className="h-5 w-5 text-bc-acid" aria-hidden="true" />
              <p className="mt-3 text-bc-muted">Balance</p>
              <p className="mt-1 text-xl font-black">{data.wallet.balance.toLocaleString("en-GB")} stars</p>
            </div>
            <div className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Trophy className="h-5 w-5 text-bc-acid" aria-hidden="true" />
              <p className="mt-3 text-bc-muted">Last update</p>
              <p className="mt-1 text-xl font-black">{formatDate(data.wallet.updatedAt)}</p>
            </div>
          </div>

          <section className="mt-5 rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Badge tone="acid">PayPal stars</Badge>
                <h4 className="mt-3 text-xl font-black">Buy stars</h4>
                <p className="mt-2 text-sm text-bc-muted">
                  Stars purchases use PayPal {paypal.settings.mode} checkout and credit this wallet after capture.
                </p>
              </div>
              <CreditCard className="h-6 w-6 text-bc-acid" aria-hidden="true" />
            </div>
            {!checkoutReadiness.ready ? (
              <div className="mt-4 rounded-md border border-bc-pink/30 bg-bc-pink/10 p-3 text-sm text-bc-pink">
                {checkoutReadiness.reason}
              </div>
            ) : null}
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {starPackages.map((pack) => (
                <form action="/account/rewards/stars/checkout" className="rounded-md border border-bc-line bg-bc-panel p-4" key={pack.id} method="post">
                  <input name="packageId" type="hidden" value={pack.id} />
                  <Badge tone="cyan">{pack.label}</Badge>
                  <p className="mt-3 text-2xl font-black">{pack.stars.toLocaleString("en-GB")}</p>
                  <p className="mt-1 text-sm text-bc-muted">{formatMoney(pack.pricePence)}</p>
                  <Button className="mt-4 w-full" disabled={!checkoutReadiness.ready} size="sm" type="submit" variant="primary">
                    <CreditCard className="h-4 w-4" aria-hidden="true" />
                    PayPal checkout
                  </Button>
                </form>
              ))}
            </div>
          </section>
        </article>

        <aside className="space-y-5">
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <Gift className="h-7 w-7 text-bc-acid" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-black">Live support</h3>
            <p className="mt-2 text-sm text-bc-muted">
              Stars are for livestream support, chat competition, and stream overlay alerts. They are not reward currency.
            </p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <ShoppingBag className="h-7 w-7 text-bc-pink" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-black">Shop signals</h3>
            <p className="mt-2 text-sm text-bc-muted">
              {data.orderStats.orders} shop orders and {formatMoney(data.orderStats.spendPence)} spend are tracked separately from stars.
            </p>
            <ButtonLink className="mt-5" href="/rewards" variant="ghost">
              <Trophy className="h-4 w-4" aria-hidden="true" />
              Star support board
            </ButtonLink>
          </article>
        </aside>
      </section>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel">
        <div className="border-b border-bc-line p-4">
          <h3 className="text-xl font-black">Stars purchase history</h3>
          <p className="mt-1 text-sm text-bc-muted">PayPal stars purchases show status, package, capture reference, and wallet credit.</p>
        </div>
        <div className="grid gap-4 p-4">
          {data.purchases.map((purchase) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={purchase.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={statusTone(purchase.status)}>{purchase.status}</Badge>
                    <Badge tone="muted">#{purchase.id.slice(0, 8)}</Badge>
                    {purchase.paypalCaptureId ? <Badge tone="acid">Captured</Badge> : null}
                  </div>
                  <h4 className="mt-3 text-lg font-black">{purchase.packageLabel}</h4>
                  <p className="mt-1 text-sm text-bc-muted">
                    {purchase.stars.toLocaleString("en-GB")} stars / {formatMoney(purchase.totalPence)}
                  </p>
                  <p className="mt-1 text-xs text-bc-muted">{formatDate(purchase.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black">{purchase.stars.toLocaleString("en-GB")}</p>
                  <p className="mt-1 text-xs text-bc-muted">Wallet credit</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {purchase.paypalOrderId ? <Badge tone="muted">PayPal {purchase.paypalOrderId.slice(0, 10)}</Badge> : null}
                {purchase.paypalPayerEmail ? <Badge tone="cyan">{purchase.paypalPayerEmail}</Badge> : null}
              </div>
            </article>
          ))}
          {!data.purchases.length ? (
            <article className="rounded-md border border-bc-line bg-bc-ink p-5">
              <Star className="h-7 w-7 text-bc-acid" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-black">No stars purchases yet</h3>
              <p className="mt-2 text-sm text-bc-muted">PayPal stars purchases will appear here after checkout starts.</p>
            </article>
          ) : null}
        </div>
      </section>
    </DashboardShell>
  );
}
