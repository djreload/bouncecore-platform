"use client";

import { useActionState } from "react";
import { BadgeCheck, CircleDollarSign, CreditCard, Plus, Save, Sparkles, Star, WandSparkles } from "lucide-react";
import { adminStarsAction } from "@/app/admin/stars/actions";
import { initialAdminStarsActionState, type AdminStarsActionState } from "@/app/admin/stars/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminStarsData } from "@/lib/rewards/stars-service";
import { starAlertEffectModes, starAlertScopes } from "@/lib/stars/star-alert-settings";

type AdminStarsPanelProps = {
  data: AdminStarsData;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

function roleTone(role: string) {
  if (role === "owner") {
    return "pink" as const;
  }

  if (role === "admin") {
    return "acid" as const;
  }

  if (role === "supporter") {
    return "amber" as const;
  }

  return "muted" as const;
}

function purchaseStatusTone(status: string) {
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

function alertScopeLabel(scope: string) {
  return scope === "public_site" ? "Public site" : "Live and OBS only";
}

function alertEffectLabel(effect: string) {
  if (effect === "amount_based") {
    return "Amount based";
  }

  if (effect === "floating_stars") {
    return "Floating stars";
  }

  return effect;
}

export function AdminStarsPanel({ data }: AdminStarsPanelProps) {
  const [state, formAction, pending] = useActionState<AdminStarsActionState, FormData>(
    adminStarsAction,
    initialAdminStarsActionState
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Wallets</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.wallets}</p>
          <p className="mt-2 text-sm text-bc-muted">Created stars wallets.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Stars</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.totalStars.toLocaleString("en-GB")}</p>
          <p className="mt-2 text-sm text-bc-muted">Total stars available to send.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Top balance</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.topBalance.toLocaleString("en-GB")}</p>
          <p className="mt-2 text-sm text-bc-muted">Highest available wallet balance.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Supporters</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.supporters}</p>
          <p className="mt-2 text-sm text-bc-muted">Users with supporter access.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Payments & money</Badge>
            <h3 className="mt-4 text-2xl font-black">Stars wallets</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Create, set, and adjust star balances for live chat support sends.
            </p>
          </div>
          <Sparkles className="h-7 w-7 text-bc-pink" aria-hidden="true" />
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

        <form action={formAction} className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
          <input name="intent" type="hidden" value="ensure-wallet" />
          <select className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white" name="userId">
            {data.users.map((user) => (
              <option key={user.userId} value={user.userId}>
                {user.displayName} - {user.email}
              </option>
            ))}
          </select>
          <Button disabled={pending || !data.users.length} type="submit" variant="primary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Ensure wallet
          </Button>
        </form>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="acid">Live alerts</Badge>
            <h3 className="mt-4 text-2xl font-black">Star alert animation</h3>
          </div>
          <WandSparkles className="h-7 w-7 text-bc-acid" aria-hidden="true" />
        </div>

        <form action={formAction} className="mt-5 grid gap-4">
          <input name="intent" type="hidden" value="alert-settings" />
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex items-center gap-3 rounded-md border border-bc-line bg-bc-ink p-3 text-sm">
              <input defaultChecked={data.alertSettings.enabled} disabled={pending} name="enabled" type="checkbox" />
              Enable animated star alerts
            </label>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="star-alert-scope">
                Scope
              </label>
              <select
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.alertSettings.scope}
                disabled={pending}
                id="star-alert-scope"
                name="scope"
              >
                {starAlertScopes.map((scope) => (
                  <option key={scope} value={scope}>
                    {alertScopeLabel(scope)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="star-alert-effect">
                Effect
              </label>
              <select
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.alertSettings.effectMode}
                disabled={pending}
                id="star-alert-effect"
                name="effectMode"
              >
                {starAlertEffectModes.map((effect) => (
                  <option className="capitalize" key={effect} value={effect}>
                    {alertEffectLabel(effect)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto]">
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="star-alert-duration">
                Duration seconds
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={Math.round(data.alertSettings.durationMs / 1000)}
                disabled={pending}
                id="star-alert-duration"
                max="10"
                min="2"
                name="durationSeconds"
                type="number"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="star-alert-confetti">
                Confetti threshold
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.alertSettings.confettiMinimumStars}
                disabled={pending}
                id="star-alert-confetti"
                min="1"
                name="confettiMinimumStars"
                type="number"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="star-alert-fireworks">
                Fireworks threshold
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.alertSettings.fireworksMinimumStars}
                disabled={pending}
                id="star-alert-fireworks"
                min="1"
                name="fireworksMinimumStars"
                type="number"
              />
            </div>
            <div className="flex items-end">
              <Button className="w-full" disabled={pending} type="submit" variant="primary">
                <Save className="h-4 w-4" aria-hidden="true" />
                Save alerts
              </Button>
            </div>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel">
        <div className="border-b border-bc-line p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-black">Star purchases</h3>
              <p className="mt-1 text-sm text-bc-muted">
                Captured stars purchases credit wallets automatically and leave a payment audit trail.
              </p>
            </div>
            <CreditCard className="h-6 w-6 text-bc-electric" aria-hidden="true" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <article className="rounded-md border border-bc-line bg-bc-ink p-3">
              <Badge tone="acid">Paid</Badge>
              <p className="mt-3 text-2xl font-black">{data.purchaseStats.paidPurchases}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-3">
              <Badge tone="amber">Pending</Badge>
              <p className="mt-3 text-2xl font-black">{data.purchaseStats.pendingPurchases}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-3">
              <Badge tone="pink">Stars bought</Badge>
              <p className="mt-3 text-2xl font-black">{data.purchaseStats.purchasedStars.toLocaleString("en-GB")}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-3">
              <Badge tone="cyan">Revenue</Badge>
              <p className="mt-3 text-2xl font-black">{formatMoney(data.purchaseStats.spendPence)}</p>
            </article>
          </div>
        </div>
        <div className="grid gap-4 p-4">
          {data.recentPurchases.map((purchase) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={purchase.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                      <Badge tone={purchaseStatusTone(purchase.status)}>{purchase.status}</Badge>
                      <Badge tone="muted">#{purchase.id.slice(0, 8)}</Badge>
                      <Badge tone="cyan">{purchase.paymentProvider}</Badge>
                      {purchase.paypalCaptureId ? <Badge tone="acid">Captured</Badge> : null}
                      {purchase.squarePaymentId ? <Badge tone="acid">Captured</Badge> : null}
                  </div>
                  <h4 className="mt-3 text-lg font-black">{purchase.customerName}</h4>
                  <p className="mt-1 text-sm text-bc-muted">{purchase.customerEmail}</p>
                  <p className="mt-1 text-xs text-bc-muted">
                    {purchase.packageLabel} / {formatDate(purchase.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black">{purchase.stars.toLocaleString("en-GB")}</p>
                  <p className="mt-1 text-xs text-bc-muted">{formatMoney(purchase.totalPence)}</p>
                </div>
              </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {purchase.paypalOrderId ? <Badge tone="muted">PayPal {purchase.paypalOrderId.slice(0, 10)}</Badge> : null}
                  {purchase.paypalPayerEmail ? <Badge tone="cyan">{purchase.paypalPayerEmail}</Badge> : null}
                  {purchase.squareOrderId ? <Badge tone="muted">Square {purchase.squareOrderId.slice(0, 10)}</Badge> : null}
                  {purchase.squareBuyerEmail ? <Badge tone="cyan">{purchase.squareBuyerEmail}</Badge> : null}
                </div>
            </article>
          ))}
          {!data.recentPurchases.length ? (
            <article className="rounded-md border border-bc-line bg-bc-ink p-5">
              <CreditCard className="h-7 w-7 text-bc-electric" aria-hidden="true" />
                <h3 className="mt-4 text-xl font-black">No star purchases yet</h3>
              <p className="mt-2 text-sm text-bc-muted">Captured stars purchases will appear here automatically.</p>
            </article>
          ) : null}
        </div>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel">
        <div className="border-b border-bc-line p-4">
          <h3 className="text-xl font-black">User balances</h3>
          <p className="mt-1 text-sm text-bc-muted">Balances are clamped at zero when adjustments would go negative.</p>
        </div>
        <div className="grid gap-4 p-4">
          {data.users.map((user) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={user.userId}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={user.hasWallet ? "acid" : "muted"}>{user.hasWallet ? "Wallet" : "No wallet"}</Badge>
                    <Badge tone={user.status === "active" ? "cyan" : "amber"}>{user.status}</Badge>
                    {user.roles.map((role) => (
                      <Badge key={role} tone={roleTone(role)}>
                        {role}
                      </Badge>
                    ))}
                  </div>
                  <h4 className="mt-3 text-lg font-black">{user.displayName}</h4>
                  <p className="mt-1 text-sm text-bc-muted">{user.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black">{user.balance.toLocaleString("en-GB")}</p>
                  <p className="mt-1 text-xs text-bc-muted">Updated {formatDate(user.updatedAt)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr_auto]">
                <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input name="intent" type="hidden" value="set-balance" />
                  <input name="userId" type="hidden" value={user.userId} />
                  <label className="sr-only" htmlFor={`balance-${user.userId}`}>
                    Star balance
                  </label>
                  <input
                    className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={user.balance}
                    id={`balance-${user.userId}`}
                    min="0"
                    name="balance"
                    step="1"
                    type="number"
                  />
                  <Button disabled={pending} type="submit" variant="dark">
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Set
                  </Button>
                </form>

                <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input name="intent" type="hidden" value="adjust-balance" />
                  <input name="userId" type="hidden" value={user.userId} />
                  <label className="sr-only" htmlFor={`delta-${user.userId}`}>
                    Star adjustment
                  </label>
                  <input
                    className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue="100"
                    id={`delta-${user.userId}`}
                    name="delta"
                    step="1"
                    type="number"
                  />
                  <Button disabled={pending} type="submit" variant="ghost">
                    <CircleDollarSign className="h-4 w-4" aria-hidden="true" />
                    Adjust
                  </Button>
                </form>

                <form action={formAction} className="flex">
                  <input name="intent" type="hidden" value="ensure-wallet" />
                  <input name="userId" type="hidden" value={user.userId} />
                  <Button className="w-full" disabled={pending || user.hasWallet} type="submit" variant="primary">
                    <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                    Ensure
                  </Button>
                </form>
              </div>
            </article>
          ))}
          {!data.users.length ? (
            <article className="rounded-md border border-bc-line bg-bc-ink p-5">
              <Star className="h-7 w-7 text-bc-acid" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-black">No eligible users</h3>
              <p className="mt-2 text-sm text-bc-muted">Active and pending users will appear here for wallet management.</p>
            </article>
          ) : null}
        </div>
      </section>
    </div>
  );
}
