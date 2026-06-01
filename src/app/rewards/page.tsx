import { Gift, Sparkles, Star, Trophy } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getPublicRewardsData } from "@/lib/rewards/stars-service";

export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const data = await getPublicRewardsData();

  return (
    <PublicShell>
      <main className="mx-auto max-w-7xl px-4 py-10">
        <section className="rounded-md border border-bc-line bg-bc-panel p-6">
          <Badge tone="pink">Supporter perks</Badge>
          <h1 className="mt-4 text-4xl font-black">Rewards</h1>
          <p className="mt-3 max-w-3xl text-bc-muted">
            Stars wallets, supporter rankings, and reward currency totals from the Bouncecore rewards system.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="cyan">Wallets</Badge>
              <p className="mt-3 text-3xl font-black">{data.stats.wallets}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="acid">Stars</Badge>
              <p className="mt-3 text-3xl font-black">{data.stats.totalStars.toLocaleString("en-GB")}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="pink">Top balance</Badge>
              <p className="mt-3 text-3xl font-black">{data.stats.topBalance.toLocaleString("en-GB")}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="amber">Supporters</Badge>
              <p className="mt-3 text-3xl font-black">{data.stats.supporters}</p>
            </article>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-md border border-bc-line bg-bc-panel">
            <div className="border-b border-bc-line p-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-bc-acid" aria-hidden="true" />
                <h2 className="text-xl font-black">Stars leaderboard</h2>
              </div>
              <p className="mt-1 text-sm text-bc-muted">Top public wallet balances.</p>
            </div>
            <div className="grid gap-3 p-4">
              {data.leaderboard.map((wallet, index) => (
                <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={wallet.userId}>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-md border border-bc-line bg-bc-panel font-black">
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="font-black">{wallet.displayName}</h3>
                        <p className="mt-1 text-sm text-bc-muted">
                          {wallet.roles.includes("supporter") ? "Supporter" : "Member"}
                        </p>
                      </div>
                    </div>
                    <Badge tone="acid">{wallet.balance.toLocaleString("en-GB")} stars</Badge>
                  </div>
                </article>
              ))}
              {!data.leaderboard.length ? (
                <article className="rounded-md border border-bc-line bg-bc-ink p-5">
                  <Star className="h-7 w-7 text-bc-acid" aria-hidden="true" />
                  <h3 className="mt-4 text-xl font-black">No stars wallets yet</h3>
                  <p className="mt-2 text-sm text-bc-muted">Stars rankings will appear here as wallets are created.</p>
                </article>
              ) : null}
            </div>
          </div>

          <aside className="space-y-4">
            <article className="rounded-md border border-bc-line bg-bc-panel p-5">
              <Sparkles className="h-7 w-7 text-bc-pink" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-black">Your wallet</h2>
              <p className="mt-2 text-sm text-bc-muted">Signed-in members can view their stars balance and ranking from account rewards.</p>
              <ButtonLink className="mt-5" href="/account/rewards" variant="primary">
                <Star className="h-4 w-4" aria-hidden="true" />
                Account rewards
              </ButtonLink>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-panel p-5">
              <Gift className="h-7 w-7 text-bc-acid" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-black">Reward currency</h2>
              <p className="mt-2 text-sm text-bc-muted">
                Stars are ready for supporter perks, future donations, achievements, spin wheels, and prize claims.
              </p>
            </article>
          </aside>
        </section>
      </main>
    </PublicShell>
  );
}
