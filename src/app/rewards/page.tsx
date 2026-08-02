import { Crown, CreditCard, Gift, Sparkles, Star, Trophy } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getPayPalIntegrationData, getPayPalStarsReadiness } from "@/lib/payments/paypal-service";
import { starPackages } from "@/lib/rewards/stars-service";
import { getLiveStarSupportData } from "@/lib/stars/star-send-service";

export const dynamic = "force-dynamic";

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

type StarLeaderboardProps = {
  description: string;
  emptyDescription: string;
  rows: Array<{
    displayName: string;
    stars: number;
    userId: string;
  }>;
  title: string;
  variant: "weekly" | "all-time";
};

function StarLeaderboard({ description, emptyDescription, rows, title, variant }: StarLeaderboardProps) {
  const Icon = variant === "weekly" ? Trophy : Crown;

  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-bc-line bg-bc-panel">
      <div className="border-b border-bc-line p-4">
        <div className="flex items-center gap-2">
          <Icon className={variant === "weekly" ? "h-5 w-5 text-bc-acid" : "h-5 w-5 text-bc-pink"} aria-hidden="true" />
          <h2 className="text-xl font-black">{title}</h2>
        </div>
        <p className="mt-1 text-sm text-bc-muted">{description}</p>
      </div>
      {rows.length ? (
        <ol className="divide-y divide-bc-line">
          {rows.map((row, index) => (
            <li className="flex min-w-0 items-center justify-between gap-3 px-4 py-3" key={row.userId}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-bc-line bg-bc-ink text-sm font-black">
                  {index + 1}
                </span>
                <span className="truncate font-black">{row.displayName}</span>
              </div>
              <Badge className="shrink-0" tone={variant === "weekly" ? "acid" : "pink"}>
                {row.stars.toLocaleString("en-GB")} stars
              </Badge>
            </li>
          ))}
        </ol>
      ) : (
        <div className="p-5">
          <Star className="h-7 w-7 text-bc-acid" aria-hidden="true" />
          <h3 className="mt-4 text-lg font-black">No stars sent yet</h3>
          <p className="mt-2 text-sm text-bc-muted">{emptyDescription}</p>
        </div>
      )}
    </section>
  );
}

export default async function RewardsPage() {
  const [data, paypal] = await Promise.all([getLiveStarSupportData(), getPayPalIntegrationData()]);
  const starsReadiness = getPayPalStarsReadiness(paypal.settings, paypal.secretConfigured);

  return (
    <PublicShell>
      <main className="mx-auto max-w-7xl px-4 py-10">
        <section className="rounded-md border border-bc-line bg-bc-panel p-6">
          <Badge tone="pink">Live support</Badge>
          <h1 className="mt-4 text-4xl font-black">Star Support</h1>
          <p className="mt-3 max-w-3xl text-bc-muted">
            Stars are bought through PayPal and sent in live chat as a fun way to support Bouncecore during livestreams.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="cyan">Leaderboard</Badge>
              <p className="mt-3 text-3xl font-black">Weekly</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="acid">Stars sent</Badge>
              <p className="mt-3 text-3xl font-black">{data.totalStarsSent.toLocaleString("en-GB")}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="pink">Sends</Badge>
              <p className="mt-3 text-3xl font-black">{data.sendCount}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="amber">Leaders</Badge>
              <p className="mt-3 text-3xl font-black">{data.leaderboard.length}</p>
            </article>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2">
            <StarLeaderboard
              description="Top viewers by stars sent in live chat this week."
              emptyDescription="Weekly rankings appear when viewers send stars in live chat."
              rows={data.leaderboard}
              title="Weekly stars leaderboard"
              variant="weekly"
            />
            <StarLeaderboard
              description="Top viewers across every recorded live chat star send."
              emptyDescription="The all-time ranking starts with the first live chat star send."
              rows={data.allTimeLeaderboard}
              title="All Time stars leaderboard"
              variant="all-time"
            />
          </div>

          <aside className="space-y-4">
            <article className="rounded-md border border-bc-line bg-bc-panel p-5">
              <Sparkles className="h-7 w-7 text-bc-pink" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-black">Your wallet</h2>
              <p className="mt-2 text-sm text-bc-muted">Signed-in members can buy stars and send them from live chat.</p>
              <ButtonLink className="mt-5" href="/account/rewards" variant="primary">
                <Star className="h-4 w-4" aria-hidden="true" />
                My stars
              </ButtonLink>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-panel p-5">
              <Gift className="h-7 w-7 text-bc-acid" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-black">Stream alerts</h2>
              <p className="mt-2 text-sm text-bc-muted">
                Sent stars appear in live chat and trigger a stream overlay alert above the live player.
              </p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-panel p-5">
              <CreditCard className="h-7 w-7 text-bc-electric" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-black">PayPal stars</h2>
              <p className="mt-2 text-sm text-bc-muted">
                Stars purchases use PayPal {paypal.settings.mode} checkout from your stars page.
              </p>
              <div className="mt-4 grid gap-2">
                {starPackages.map((pack) => (
                  <div className="rounded-md border border-bc-line bg-bc-ink p-3 text-sm" key={pack.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span>
                        <span className="block font-semibold">{pack.label}</span>
                        <span className="mt-1 block text-xs text-bc-muted">{pack.stars.toLocaleString("en-GB")} stars</span>
                      </span>
                      <span className="text-bc-muted">{formatMoney(pack.pricePence)}</span>
                    </div>
                  </div>
                ))}
              </div>
              {!starsReadiness.ready ? (
                <p className="mt-3 text-sm text-bc-muted">{starsReadiness.reason}</p>
              ) : null}
              <ButtonLink className="mt-5" href="/account/rewards" variant="ghost">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                Buy stars
              </ButtonLink>
            </article>
          </aside>
        </section>
      </main>
    </PublicShell>
  );
}
