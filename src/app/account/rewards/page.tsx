import { Gift, ShoppingBag, Sparkles, Star, Trophy } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireSignedInUser } from "@/lib/auth/guards";
import { getAccountRewardsData } from "@/lib/rewards/stars-service";

export const dynamic = "force-dynamic";

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

export default async function AccountRewardsPage() {
  const user = await requireSignedInUser();
  const data = await getAccountRewardsData(user.id);

  return (
    <DashboardShell title="Rewards" description="Your stars wallet, supporter status, purchase signals, and rewards ranking.">
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Stars</Badge>
          <p className="mt-4 text-3xl font-black">{data.wallet.balance.toLocaleString("en-GB")}</p>
          <p className="mt-2 text-sm text-bc-muted">Current wallet balance.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Rank</Badge>
          <p className="mt-4 text-3xl font-black">{data.rank ? `#${data.rank}` : "New"}</p>
          <p className="mt-2 text-sm text-bc-muted">Stars leaderboard position.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.supporter ? "amber" : "muted"}>{data.supporter ? "Supporter" : "Member"}</Badge>
          <p className="mt-4 text-3xl font-black">{data.supporter ? "VIP" : "Base"}</p>
          <p className="mt-2 text-sm text-bc-muted">Current rewards access.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Orders</Badge>
          <p className="mt-4 text-3xl font-black">{data.orderStats.orders}</p>
          <p className="mt-2 text-sm text-bc-muted">{formatMoney(data.orderStats.spendPence)} spend tracked.</p>
        </article>
      </div>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge tone="pink">Stars wallet</Badge>
              <h3 className="mt-4 text-2xl font-black">{user.displayName}</h3>
              <p className="mt-2 max-w-2xl text-sm text-bc-muted">
                Your wallet is active and updates when admins grant stars or future rewards flows add currency.
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
        </article>

        <aside className="space-y-5">
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <Gift className="h-7 w-7 text-bc-acid" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-black">Reward perks</h3>
            <p className="mt-2 text-sm text-bc-muted">
              Stars are ready for future supporter perks, spin wheels, prize claims, and achievement rewards.
            </p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <ShoppingBag className="h-7 w-7 text-bc-pink" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-black">Shop signals</h3>
            <p className="mt-2 text-sm text-bc-muted">Orders and spend are already connected for future rewards rules.</p>
            <ButtonLink className="mt-5" href="/rewards" variant="ghost">
              <Trophy className="h-4 w-4" aria-hidden="true" />
              Public rankings
            </ButtonLink>
          </article>
        </aside>
      </section>
    </DashboardShell>
  );
}
