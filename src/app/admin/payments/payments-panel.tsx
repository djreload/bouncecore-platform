"use client";

import { useActionState } from "react";
import { AlertTriangle, BadgeCheck, CreditCard, KeyRound, Radar, RefreshCw, Save, Send, WalletCards, Webhook } from "lucide-react";
import { adminPaymentsAction } from "@/app/admin/payments/actions";
import { initialAdminPaymentsActionState, type AdminPaymentsActionState } from "@/app/admin/payments/state";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { repairPaidMusicDeliveryConfirmationText } from "@/lib/music/music-delivery-recovery-core";
import { cancelStaleCheckoutsConfirmationText, stalePendingCleanupDefaultHours } from "@/lib/payments/payment-reconciliation-core";
import type { PaymentReconciliationData } from "@/lib/payments/payment-reconciliation-service";
import type { PaymentSmokeData } from "@/lib/payments/payment-smoke-service";
import type { PayPalIntegrationData } from "@/lib/payments/paypal-service";
import type { SquareIntegrationData } from "@/lib/payments/square-service";
import { paypalWebhookDetailHref } from "@/lib/payments/paypal-webhook-detail-core";
import {
  paypalWebhookLimitOptions,
  paypalWebhookStatusFilterOptions,
  type PayPalWebhookFilters
} from "@/lib/payments/paypal-webhook-filter-core";
import { canRetryPayPalWebhookStatus } from "@/lib/payments/paypal-webhook-retry-core";
import type { PayPalWebhookEventSummary } from "@/lib/payments/paypal-webhook-service";
import type { AdminProducerPayoutsData } from "@/lib/payments/producer-payout-service";

type AdminPaymentsPanelProps = {
  data: PayPalIntegrationData;
  square: SquareIntegrationData;
  payouts: AdminProducerPayoutsData;
  reconciliation: PaymentReconciliationData;
  smoke: PaymentSmokeData;
  webhookEvents: PayPalWebhookEventSummary[];
  webhookFilters: PayPalWebhookFilters;
};

const paypalModeOptions = ["sandbox", "live"] as const;
const squareModeOptions = ["sandbox", "live"] as const;
const commonWebhookStatuses = [...paypalWebhookStatusFilterOptions] as string[];

function checkTone(status: string) {
  return status === "ready" ? ("acid" as const) : ("amber" as const);
}

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function payoutStatusTone(status: string) {
  if (status === "success") {
    return "acid" as const;
  }

  if (["failed", "denied", "canceled", "blocked", "returned"].includes(status)) {
    return "pink" as const;
  }

  if (["pending", "processing", "unclaimed", "onhold"].includes(status)) {
    return "cyan" as const;
  }

  return "muted" as const;
}

function webhookStatusTone(status: string) {
  if (status === "recorded" || status === "verified") {
    return "acid" as const;
  }

  if (status === "duplicate") {
    return "cyan" as const;
  }

  return "amber" as const;
}

function riskTone(level: string) {
  if (level === "critical") {
    return "pink" as const;
  }

  if (level === "warning") {
    return "amber" as const;
  }

  return "acid" as const;
}

function smokeVerificationTone(state: string) {
  if (state === "verified") {
    return "acid" as const;
  }

  if (state === "pending") {
    return "amber" as const;
  }

  return "pink" as const;
}

function checkoutTypeLabel(type: string) {
  switch (type) {
    case "music-cart":
      return "Music basket";
    case "music":
      return "Music";
    case "shop":
      return "Shop";
    case "stars":
      return "Stars";
    default:
      return type;
  }
}

function stalePendingTotal(reconciliation: PaymentReconciliationData) {
  return (
    reconciliation.stats.staleMusicCheckouts +
    reconciliation.stats.staleMusicPurchases +
    reconciliation.stats.staleShopOrders +
    reconciliation.stats.staleStarPurchases
  );
}

export function AdminPaymentsPanel({ data, square, payouts, reconciliation, smoke, webhookEvents, webhookFilters }: AdminPaymentsPanelProps) {
  const [state, formAction, pending] = useActionState<AdminPaymentsActionState, FormData>(
    adminPaymentsAction,
    initialAdminPaymentsActionState
  );
  const includeCurrentWebhookStatus = webhookFilters.status && !commonWebhookStatuses.includes(webhookFilters.status);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Provider</Badge>
          <p className="mt-4 text-3xl font-black">PayPal + Square</p>
          <p className="mt-2 text-sm text-bc-muted">Music payouts stay PayPal.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Mode</Badge>
          <p className="mt-4 text-3xl font-black capitalize">{data.settings.mode}</p>
          <p className="mt-2 text-sm text-bc-muted">PayPal / Square {square.settings.mode}</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.secretConfigured ? "acid" : "amber"}>Secret</Badge>
          <p className="mt-4 text-3xl font-black">{data.secretConfigured ? "Ready" : "Missing"}</p>
          <p className="mt-2 text-sm text-bc-muted">Stored server-side only.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Coverage</Badge>
          <p className="mt-4 text-3xl font-black">
            {data.useCases.filter((item) => item.enabled).length + square.useCases.filter((item) => item.enabled).length}/
            {data.useCases.length + square.useCases.length}
          </p>
          <p className="mt-2 text-sm text-bc-muted">Stars, shop, music, payouts.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">PayPal integration</Badge>
            <h3 className="mt-4 text-2xl font-black">Payment routing</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Bouncecore routes stars purchases, merch checkout, and producer payouts through PayPal.
            </p>
          </div>
          <WalletCards className="h-7 w-7 text-bc-pink" aria-hidden="true" />
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

        <form action={formAction} className="mt-5 grid gap-4">
          <input name="intent" type="hidden" value="paypal-settings" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="paypal-mode">
                Mode
              </label>
              <select
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.settings.mode}
                disabled={pending}
                id="paypal-mode"
                name="mode"
              >
                {paypalModeOptions.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="paypal-client-id">
                Client ID
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.settings.clientId}
                disabled={pending}
                id="paypal-client-id"
                name="clientId"
                placeholder="PayPal REST app client ID"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="paypal-client-secret">
                Client secret
              </label>
              <input
                autoComplete="off"
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                disabled={pending}
                id="paypal-client-secret"
                name="clientSecret"
                placeholder={data.secretConfigured ? "Stored - leave blank to keep" : "PayPal REST app client secret"}
                type="password"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="paypal-webhook-id">
                Webhook ID
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.settings.webhookId}
                disabled={pending}
                id="paypal-webhook-id"
                name="webhookId"
                placeholder="PayPal webhook ID"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="paypal-merchant-id">
                Merchant ID
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.settings.merchantId}
                disabled={pending}
                id="paypal-merchant-id"
                name="merchantId"
                placeholder="PayPal merchant ID"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="paypal-merchant-email">
              Merchant email
            </label>
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              defaultValue={data.settings.merchantEmail}
              disabled={pending}
              id="paypal-merchant-email"
              name="merchantEmail"
              placeholder="payments@example.com"
              type="email"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex items-center gap-3 rounded-md border border-bc-line bg-bc-ink p-3 text-sm">
              <input defaultChecked={data.settings.starsEnabled} disabled={pending} name="starsEnabled" type="checkbox" />
              Stars purchases use PayPal
            </label>
            <label className="flex items-center gap-3 rounded-md border border-bc-line bg-bc-ink p-3 text-sm">
              <input defaultChecked={data.settings.shopEnabled} disabled={pending} name="shopEnabled" type="checkbox" />
              Shop checkout uses PayPal
            </label>
            <label className="flex items-center gap-3 rounded-md border border-bc-line bg-bc-ink p-3 text-sm">
              <input
                defaultChecked={data.settings.producerPayoutsEnabled}
                disabled={pending}
                name="producerPayoutsEnabled"
                type="checkbox"
              />
              Producer payouts use PayPal
            </label>
          </div>
          <div className="rounded-md border border-bc-line bg-bc-ink p-4 text-sm text-bc-muted">
            <KeyRound className="mb-3 h-5 w-5 text-bc-acid" aria-hidden="true" />
            PayPal secrets are stored server-side only. Leave the secret field blank to keep the current value.
          </div>
          <div>
            <Button disabled={pending} type="submit" variant="primary">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save PayPal settings
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="cyan">Square integration</Badge>
            <h3 className="mt-4 text-2xl font-black">Square hosted checkout</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Square can be offered for stars and merch. Producer music purchases and producer payouts remain on PayPal.
            </p>
          </div>
          <CreditCard className="h-7 w-7 text-bc-electric" aria-hidden="true" />
        </div>

        <form action={formAction} className="mt-5 grid gap-4">
          <input name="intent" type="hidden" value="square-settings" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="square-mode">
                Mode
              </label>
              <select
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={square.settings.mode}
                disabled={pending}
                id="square-mode"
                name="squareMode"
              >
                {squareModeOptions.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-bc-muted">Use sandbox for tests and live for production.</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="square-application-id">
                Application ID
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={square.settings.applicationId}
                disabled={pending}
                id="square-application-id"
                name="squareApplicationId"
                placeholder="Square application ID"
              />
              <p className="mt-1 text-xs text-bc-muted">From the Square developer application.</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="square-location-id">
                Location ID
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={square.settings.locationId}
                disabled={pending}
                id="square-location-id"
                name="squareLocationId"
                placeholder="Square location ID"
              />
              <p className="mt-1 text-xs text-bc-muted">Used when creating hosted checkout orders.</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="square-access-token">
                Access token
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                disabled={pending}
                id="square-access-token"
                name="squareAccessToken"
                placeholder={square.accessTokenConfigured ? "Stored - leave blank to keep" : "Square access token"}
                type="password"
              />
              <p className="mt-1 text-xs text-bc-muted">Stored server-side only. Blank keeps the current token.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="square-webhook-url">
                Webhook notification URL
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={square.settings.webhookNotificationUrl}
                disabled={pending}
                id="square-webhook-url"
                name="squareWebhookNotificationUrl"
                placeholder="https://example.com/api/payments/square/webhook"
              />
              <p className="mt-1 text-xs text-bc-muted">Must exactly match the Square webhook subscription URL.</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="square-webhook-key">
                Webhook signature key
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                disabled={pending}
                id="square-webhook-key"
                name="squareWebhookSignatureKey"
                placeholder={square.webhookSignatureKeyConfigured ? "Stored - leave blank to keep" : "Square webhook signature key"}
                type="password"
              />
              <p className="mt-1 text-xs text-bc-muted">Used to verify Square webhook payloads. Blank keeps the current key.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-md border border-bc-line bg-bc-ink p-3 text-sm">
              <input defaultChecked={square.settings.starsEnabled} disabled={pending} name="squareStarsEnabled" type="checkbox" />
              Stars purchases can use Square
            </label>
            <label className="flex items-center gap-3 rounded-md border border-bc-line bg-bc-ink p-3 text-sm">
              <input defaultChecked={square.settings.shopEnabled} disabled={pending} name="squareShopEnabled" type="checkbox" />
              Shop checkout can use Square
            </label>
          </div>
          <div>
            <Button disabled={pending} type="submit" variant="primary">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save Square settings
            </Button>
          </div>
        </form>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-bc-acid" aria-hidden="true" />
            <h3 className="text-xl font-black">Readiness</h3>
          </div>
          <div className="mt-4 grid gap-3">
            {data.checks.map((item) => (
              <div className="rounded-md border border-bc-line bg-bc-ink p-3" key={item.label}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold">{item.label}</p>
                  <Badge tone={checkTone(item.status)}>{item.value}</Badge>
                </div>
                <p className="mt-2 text-sm text-bc-muted">{item.detail}</p>
              </div>
            ))}
            {square.checks.map((item) => (
              <div className="rounded-md border border-bc-line bg-bc-ink p-3" key={item.label}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold">{item.label}</p>
                  <Badge tone={checkTone(item.status)}>{item.value}</Badge>
                </div>
                <p className="mt-2 text-sm text-bc-muted">{item.detail}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-bc-pink" aria-hidden="true" />
            <h3 className="text-xl font-black">PayPal surfaces</h3>
          </div>
          <div className="mt-4 grid gap-3">
            {data.useCases.map((item) => (
              <div className="rounded-md border border-bc-line bg-bc-ink p-3" key={item.label}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold">{item.label}</p>
                  <Badge tone={item.enabled ? "acid" : "muted"}>{item.enabled ? "Enabled" : "Disabled"}</Badge>
                </div>
                <p className="mt-2 text-sm text-bc-muted">{item.rail}</p>
                <p className="mt-1 text-xs text-bc-muted">{item.surface}</p>
              </div>
            ))}
            {square.useCases.map((item) => (
              <div className="rounded-md border border-bc-line bg-bc-ink p-3" key={`square-${item.label}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold">Square {item.label}</p>
                  <Badge tone={item.enabled ? "acid" : "muted"}>{item.enabled ? "Enabled" : "Disabled"}</Badge>
                </div>
                <p className="mt-2 text-sm text-bc-muted">{item.rail}</p>
                <p className="mt-1 text-xs text-bc-muted">{item.surface}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="cyan">Smoke tests</Badge>
            <h3 className="mt-4 text-xl font-black">PayPal checkout proof</h3>
            <p className="mt-2 max-w-3xl text-sm text-bc-muted">
              Starts real PayPal sandbox orders through the same stars, music, and shop checkout routes used by customers. Complete
              PayPal approval in the opened tab, then check the linked result page.
            </p>
          </div>
          <Badge tone={smoke.mode === "sandbox" ? "acid" : "amber"}>{smoke.mode}</Badge>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {smoke.scenarios.map((scenario) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={scenario.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge tone={scenario.ready ? "acid" : "amber"}>{scenario.ready ? "Ready" : "Blocked"}</Badge>
                  <h4 className="mt-3 font-black">{scenario.title}</h4>
                </div>
                {scenario.amountPence !== null ? <Badge tone="cyan">{formatMoney(scenario.amountPence)}</Badge> : null}
              </div>
              <p className="mt-3 text-sm text-bc-muted">{scenario.description}</p>
              {scenario.targetLabel ? <p className="mt-3 text-sm font-semibold text-white">{scenario.targetLabel}</p> : null}
              <p className="mt-2 text-xs leading-5 text-bc-muted">{scenario.expectedResult}</p>

              {scenario.ready ? (
                <form action={scenario.action} className="mt-4 flex flex-wrap gap-2" method="post" target="_blank">
                  {scenario.fields.map((field) => (
                    <input key={`${scenario.id}:${field.name}`} name={field.name} type="hidden" value={field.value} />
                  ))}
                  <Button size="sm" type="submit" variant="primary">
                    <CreditCard className="h-4 w-4" aria-hidden="true" />
                    Start checkout
                  </Button>
                  <ButtonLink href={scenario.resultHref} size="sm" variant="ghost">
                    Result page
                  </ButtonLink>
                </form>
              ) : (
                <div className="mt-4 rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
                  {scenario.reason}
                </div>
              )}
            </article>
          ))}
        </div>

        <div className="mt-5 rounded-md border border-bc-line bg-bc-ink">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
            <div>
              <h4 className="font-black">Recent checkout verifier</h4>
              <p className="mt-1 text-sm text-bc-muted">
                Shows recent checkouts for this admin user and whether the local capture/update path completed.
              </p>
            </div>
            <Badge tone="muted">{smoke.recentResults.length} shown</Badge>
          </div>
          <div className="grid gap-3 p-4">
            {smoke.recentResults.map((result) => (
              <article className="rounded-md border border-bc-line bg-bc-panel p-3" key={`${result.scenarioId}:${result.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={smokeVerificationTone(result.verification.state)}>{result.verification.label}</Badge>
                      <Badge tone="muted">{result.status}</Badge>
                      {result.paypalCaptureId ? <Badge tone="acid">Captured</Badge> : null}
                    </div>
                    <h5 className="mt-3 font-black">{result.title}</h5>
                    <p className="mt-1 text-sm text-bc-muted">{result.targetLabel}</p>
                    <p className="mt-2 text-xs leading-5 text-bc-muted">{result.verification.detail}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black">{formatMoney(result.amountPence)}</p>
                    <p className="mt-1 text-xs text-bc-muted">{formatDateTime(result.createdAt)}</p>
                    {result.paypalOrderId ? <p className="mt-1 text-xs text-bc-muted">PayPal {result.paypalOrderId.slice(0, 10)}</p> : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ButtonLink href={result.resultHref} size="sm" variant="ghost">
                    Result page
                  </ButtonLink>
                  {result.paypalCaptureId ? <Badge tone="muted">Capture {result.paypalCaptureId.slice(0, 10)}</Badge> : null}
                </div>
              </article>
            ))}
            {!smoke.recentResults.length ? (
              <div className="rounded-md border border-bc-line bg-bc-panel p-4 text-sm text-bc-muted">
                No recent stars, music, or shop checkout records exist for this admin user yet.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="amber">Reconciliation</Badge>
            <h3 className="mt-4 text-xl font-black">Payment risk ledger</h3>
            <p className="mt-2 max-w-3xl text-sm text-bc-muted">
              Cross-checks pending PayPal records, webhook processing, delivery URLs, and capture references across stars, music, and
              shop checkout.
            </p>
          </div>
          <Radar className="h-7 w-7 text-amber-300" aria-hidden="true" />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {reconciliation.risks.map((item) => (
            <a className="rounded-md border border-bc-line bg-bc-ink p-4 transition hover:border-bc-electric" href={item.href} key={item.label}>
              <Badge tone={riskTone(item.level)}>{item.level}</Badge>
              <p className="mt-3 text-2xl font-black">{item.value}</p>
              <p className="mt-2 text-sm font-semibold">{item.label}</p>
              <p className="mt-2 text-xs text-bc-muted">{item.detail}</p>
            </a>
          ))}
        </div>

        <div className="mt-5 rounded-md border border-bc-line bg-bc-ink">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
            <div>
              <h4 className="font-black">Oldest stale pending checkouts</h4>
              <p className="mt-1 text-sm text-bc-muted">
                Pending records older than {reconciliation.staleAfterMinutes} minutes. These usually mean abandoned approval,
                blocked capture, or missed webhook/return completion.
              </p>
            </div>
            <Badge tone="muted">Checked {formatDateTime(reconciliation.checkedAt)}</Badge>
          </div>
          <div className="grid gap-3 p-4">
            {reconciliation.recentStalePending.map((item) => (
              <a className="rounded-md border border-bc-line bg-bc-panel p-3 transition hover:border-bc-electric" href={item.href} key={`${item.type}:${item.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="amber">{checkoutTypeLabel(item.type)}</Badge>
                      <Badge tone="muted">{item.status}</Badge>
                      {item.paypalOrderId ? <Badge tone="cyan">PayPal {item.paypalOrderId.slice(0, 10)}</Badge> : null}
                    </div>
                    <p className="mt-3 font-black">{item.label}</p>
                    <p className="mt-1 text-xs text-bc-muted">
                      {item.customerName} / {item.customerEmail} / {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                  <p className="font-black">{formatMoney(item.amountPence)}</p>
                </div>
              </a>
            ))}
            {!reconciliation.recentStalePending.length ? (
              <div className="rounded-md border border-bc-line bg-bc-panel p-4 text-sm text-bc-muted">
                No stale pending PayPal checkout records are currently visible.
              </div>
            ) : null}
          </div>
        </div>

        <form action={formAction} className="mt-5 rounded-md border border-bc-line bg-bc-ink p-4">
          <input name="intent" type="hidden" value="stale-pending-cancel" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge tone="pink">Manual cleanup</Badge>
              <h4 className="mt-3 font-black">Cancel abandoned pending checkouts</h4>
              <p className="mt-2 max-w-3xl text-sm text-bc-muted">
                Cancels local pending stars, shop, and music checkout records older than the selected age. Use this after checking PayPal
                webhooks and only for records that are clearly abandoned.
              </p>
            </div>
            <Badge tone={stalePendingTotal(reconciliation) ? "amber" : "acid"}>
              {stalePendingTotal(reconciliation).toLocaleString("en-GB")} stale
            </Badge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[180px_minmax(220px,1fr)_auto]">
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="stale-cleanup-hours">
                Older than hours
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                defaultValue={stalePendingCleanupDefaultHours}
                disabled={pending}
                id="stale-cleanup-hours"
                max={168}
                min={1}
                name="olderThanHours"
                required
                type="number"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="stale-cleanup-confirmation">
                Confirmation
              </label>
              <input
                autoComplete="off"
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                disabled={pending}
                id="stale-cleanup-confirmation"
                name="confirmation"
                placeholder={cancelStaleCheckoutsConfirmationText}
                required
              />
              <p className="mt-1 text-xs text-bc-muted">
                Type <span className="font-semibold text-white">{cancelStaleCheckoutsConfirmationText}</span> exactly.
              </p>
            </div>
            <div className="flex items-end">
              <Button disabled={pending} type="submit" variant="pink">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Cancel stale
              </Button>
            </div>
          </div>
        </form>

        <form action={formAction} className="mt-5 rounded-md border border-bc-line bg-bc-ink p-4">
          <input name="intent" type="hidden" value="music-delivery-repair" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge tone="cyan">Delivery repair</Badge>
              <h4 className="mt-3 font-black">Backfill paid music delivery snapshots</h4>
              <p className="mt-2 max-w-3xl text-sm text-bc-muted">
                Copies the current track download and license data onto paid purchases missing their stored delivery snapshot. Purchases
                where the track itself has no delivery URL must be fixed on the tracks page first.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={reconciliation.stats.paidMusicPurchasesMissingSnapshotDelivery ? "amber" : "acid"}>
                {reconciliation.stats.paidMusicPurchasesMissingSnapshotDelivery.toLocaleString("en-GB")} repairable
              </Badge>
              <Badge tone={reconciliation.stats.paidMusicPurchasesMissingDelivery ? "pink" : "muted"}>
                {reconciliation.stats.paidMusicPurchasesMissingDelivery.toLocaleString("en-GB")} missing track URL
              </Badge>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(220px,1fr)_auto]">
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="music-delivery-repair-confirmation">
                Confirmation
              </label>
              <input
                autoComplete="off"
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                disabled={pending}
                id="music-delivery-repair-confirmation"
                name="confirmation"
                placeholder={repairPaidMusicDeliveryConfirmationText}
                required
              />
              <p className="mt-1 text-xs text-bc-muted">
                Type <span className="font-semibold text-white">{repairPaidMusicDeliveryConfirmationText}</span> exactly.
              </p>
            </div>
            <div className="flex items-end">
              <Button disabled={pending || !reconciliation.stats.paidMusicPurchasesMissingSnapshotDelivery} type="submit" variant="primary">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Repair delivery
              </Button>
            </div>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="cyan">Webhooks</Badge>
            <h3 className="mt-4 text-xl font-black">Verified PayPal events</h3>
            <p className="mt-2 max-w-3xl text-sm text-bc-muted">
              Configure PayPal to POST events to <span className="font-semibold text-white">/api/payments/paypal/webhook</span>.
              Verified events are recorded once by PayPal event ID before any future reconciliation is added.
            </p>
          </div>
          <div className="grid justify-items-end gap-2">
            <Webhook className="h-7 w-7 text-bc-electric" aria-hidden="true" />
            <Badge tone={webhookFilters.hasFilters ? "amber" : "muted"}>{webhookEvents.length} shown</Badge>
          </div>
        </div>

        <form className="mt-5 rounded-md border border-bc-line bg-bc-ink p-4" method="get">
          <div className="grid gap-3 xl:grid-cols-[minmax(220px,1fr)_220px_220px_120px_auto]">
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="webhook-query">
                Search
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                defaultValue={webhookFilters.query}
                id="webhook-query"
                name="webhookQuery"
                placeholder="Event, resource, order, purchase, payout ID"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="webhook-status">
                Status
              </label>
              <select
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                defaultValue={webhookFilters.status}
                id="webhook-status"
                name="webhookStatus"
              >
                <option value="">All statuses</option>
                {includeCurrentWebhookStatus ? <option value={webhookFilters.status}>{webhookFilters.status}</option> : null}
                {commonWebhookStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="webhook-event-type">
                Event type
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                defaultValue={webhookFilters.eventType}
                id="webhook-event-type"
                name="webhookEventType"
                placeholder="PAYMENT.CAPTURE"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="webhook-limit">
                Limit
              </label>
              <select
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                defaultValue={webhookFilters.limit}
                id="webhook-limit"
                name="webhookLimit"
              >
                {paypalWebhookLimitOptions.map((limit) => (
                  <option key={limit} value={limit}>
                    {limit}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" variant="primary">
                Filter
              </Button>
              {webhookFilters.hasFilters ? (
                <ButtonLink href="/admin/payments" variant="ghost">
                  Clear
                </ButtonLink>
              ) : null}
            </div>
          </div>
          <p className="mt-3 text-xs text-bc-muted">
            Search checks PayPal event IDs, resource IDs, transmission IDs, event types, statuses, and common payload IDs used for local
            orders, purchases, and payouts.
          </p>
        </form>

        <div className="mt-5 grid gap-3">
          {webhookEvents.map((event) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={event.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={webhookStatusTone(event.verificationStatus)}>{event.verificationStatus}</Badge>
                    <Badge tone={webhookStatusTone(event.processingStatus)}>{event.processingStatus}</Badge>
                  </div>
                  <h4 className="mt-3 font-black">{event.eventType}</h4>
                  <p className="mt-1 text-xs text-bc-muted">{event.paypalEventId}</p>
                </div>
                <div className="grid justify-items-end gap-2">
                  <p className="text-right text-xs text-bc-muted">{formatDateTime(event.createdAt)}</p>
                  <ButtonLink href={paypalWebhookDetailHref(event.id)} size="sm" variant="ghost">
                    Details
                  </ButtonLink>
                  {canRetryPayPalWebhookStatus(event.processingStatus) ? (
                    <form action={formAction}>
                      <input name="intent" type="hidden" value="paypal-webhook-retry" />
                      <input name="webhookEventId" type="hidden" value={event.id} />
                      <Button disabled={pending} size="sm" type="submit" variant="ghost">
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        Retry
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-bc-muted">
                {event.resourceType ? <Badge tone="muted">{event.resourceType}</Badge> : null}
                {event.resourceId ? <Badge tone="muted">{event.resourceId}</Badge> : null}
                {event.transmissionId ? <Badge tone="muted">Transmission {event.transmissionId}</Badge> : null}
              </div>
              {event.errorMessage ? <p className="mt-3 text-sm text-bc-pink">{event.errorMessage}</p> : null}
            </article>
          ))}
          {!webhookEvents.length ? (
            <div className="rounded-md border border-bc-line bg-bc-ink p-5 text-sm text-bc-muted">
              {webhookFilters.hasFilters
                ? "No PayPal webhook events matched these filters."
                : "No verified PayPal webhook events have been received yet."}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="acid">Producer payouts</Badge>
            <h3 className="mt-4 text-xl font-black">PayPal payout batches</h3>
            <p className="mt-2 max-w-3xl text-sm text-bc-muted">
              Eligible paid music sales are batched into PayPal Payouts items and tracked locally by sender batch and item IDs.
            </p>
          </div>
          <Send className="h-7 w-7 text-bc-acid" aria-hidden="true" />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <Badge tone="pink">Eligible</Badge>
            <p className="mt-3 text-2xl font-black">{formatMoney(payouts.stats.eligiblePence)}</p>
            <p className="mt-1 text-xs text-bc-muted">{payouts.stats.eligibleItemCount} paid sale items.</p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <Badge tone="cyan">Recipients</Badge>
            <p className="mt-3 text-2xl font-black">{payouts.eligibleRecipients.length}</p>
            <p className="mt-1 text-xs text-bc-muted">Producers with PayPal payout email.</p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <Badge tone={payouts.missingRecipientCount ? "amber" : "acid"}>Missing setup</Badge>
            <p className="mt-3 text-2xl font-black">{payouts.missingRecipientCount}</p>
            <p className="mt-1 text-xs text-bc-muted">{formatMoney(payouts.stats.missingRecipientPence)} blocked.</p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <Badge tone={payouts.readiness.ready ? "acid" : "amber"}>API</Badge>
            <p className="mt-3 text-2xl font-black">{payouts.readiness.ready ? "Ready" : "Blocked"}</p>
            <p className="mt-1 text-xs text-bc-muted">{payouts.readiness.reason ?? "PayPal Payouts API can be called."}</p>
          </article>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-black">Eligible recipients</h4>
                <p className="mt-1 text-sm text-bc-muted">Grouped preview before PayPal receives the batch.</p>
              </div>
              <Badge tone="muted">{payouts.eligibleSales.length} preview rows</Badge>
            </div>
            <div className="mt-4 grid gap-3">
              {payouts.eligibleRecipients.map((recipient) => (
                <div className="rounded-md border border-bc-line bg-bc-panel p-3" key={`${recipient.producerId}:${recipient.paypalPayoutEmail}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{recipient.producerName}</p>
                      <p className="mt-1 text-xs text-bc-muted">{recipient.paypalPayoutEmail}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black">{formatMoney(recipient.amountPence)}</p>
                      <p className="mt-1 text-xs text-bc-muted">
                        {recipient.saleCount} sale{recipient.saleCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {!payouts.eligibleRecipients.length ? (
                <div className="rounded-md border border-bc-line bg-bc-panel p-4 text-sm text-bc-muted">
                  No producer sales are currently eligible for payout.
                </div>
              ) : null}
            </div>
          </div>

          <aside className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-bc-pink" aria-hidden="true" />
              <div>
                <h4 className="font-black">Create payout batch</h4>
                <p className="mt-1 text-sm text-bc-muted">
                  This sends eligible producer earnings to PayPal using the configured {data.settings.mode} credentials.
                </p>
              </div>
            </div>
            <form action={formAction} className="mt-4 grid gap-3">
              <input name="intent" type="hidden" value="producer-payout-create" />
              <label className="flex items-start gap-3 rounded-md border border-bc-line bg-bc-panel p-3 text-sm">
                <input disabled={pending || !payouts.readiness.ready || !payouts.stats.eligibleItemCount} name="confirmPayout" type="checkbox" />
                <span>I confirm this should create a PayPal payout batch for the eligible sales shown here.</span>
              </label>
              <Button disabled={pending || !payouts.readiness.ready || !payouts.stats.eligibleItemCount} type="submit" variant="pink">
                <Send className="h-4 w-4" aria-hidden="true" />
                Create PayPal payout batch
              </Button>
            </form>
          </aside>
        </div>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge tone="cyan">Payout ledger</Badge>
            <h3 className="mt-4 text-xl font-black">Recent payout batches</h3>
          </div>
          <RefreshCw className="h-6 w-6 text-bc-electric" aria-hidden="true" />
        </div>
        <div className="mt-5 grid gap-4">
          {payouts.recentBatches.map((batch) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={batch.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={payoutStatusTone(batch.status)}>{batch.status}</Badge>
                    <Badge tone="muted">{batch.senderBatchId}</Badge>
                    {batch.paypalPayoutBatchId ? <Badge tone="cyan">PayPal {batch.paypalPayoutBatchId}</Badge> : null}
                  </div>
                  <h4 className="mt-3 text-lg font-black">{formatMoney(batch.totalPence)}</h4>
                  <p className="mt-1 text-sm text-bc-muted">
                    {batch.itemCount} item{batch.itemCount === 1 ? "" : "s"}
                    {batch.paypalBatchStatus ? ` / PayPal ${batch.paypalBatchStatus}` : ""}
                  </p>
                  {batch.errorMessage ? <p className="mt-2 text-sm text-bc-pink">{batch.errorMessage}</p> : null}
                </div>
                <form action={formAction}>
                  <input name="intent" type="hidden" value="producer-payout-sync" />
                  <input name="batchId" type="hidden" value={batch.id} />
                  <Button disabled={pending || !batch.paypalPayoutBatchId} size="sm" type="submit" variant="ghost">
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Sync status
                  </Button>
                </form>
              </div>
              <div className="mt-4 grid gap-2">
                {batch.items.map((item) => (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-panel p-3" key={item.id}>
                    <div>
                      <p className="font-semibold">{item.trackTitle}</p>
                      <p className="mt-1 text-xs text-bc-muted">
                        {item.producerName} / {item.recipientEmail}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={payoutStatusTone(item.status)}>{item.status}</Badge>
                      <Badge tone="muted">{formatMoney(item.amountPence)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
          {!payouts.recentBatches.length ? (
            <div className="rounded-md border border-bc-line bg-bc-ink p-5 text-sm text-bc-muted">
              PayPal producer payout batches will appear here after the first batch is created.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
