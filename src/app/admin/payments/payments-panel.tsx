"use client";

import { useActionState } from "react";
import { BadgeCheck, CreditCard, KeyRound, Save, Send, WalletCards } from "lucide-react";
import { adminPaymentsAction } from "@/app/admin/payments/actions";
import { initialAdminPaymentsActionState, type AdminPaymentsActionState } from "@/app/admin/payments/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PayPalIntegrationData } from "@/lib/payments/paypal-service";

type AdminPaymentsPanelProps = {
  data: PayPalIntegrationData;
};

const paypalModeOptions = ["sandbox", "live"] as const;

function checkTone(status: string) {
  return status === "ready" ? ("acid" as const) : ("amber" as const);
}

export function AdminPaymentsPanel({ data }: AdminPaymentsPanelProps) {
  const [state, formAction, pending] = useActionState<AdminPaymentsActionState, FormData>(
    adminPaymentsAction,
    initialAdminPaymentsActionState
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Provider</Badge>
          <p className="mt-4 text-3xl font-black">PayPal</p>
          <p className="mt-2 text-sm text-bc-muted">Required payment rail.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Mode</Badge>
          <p className="mt-4 text-3xl font-black capitalize">{data.settings.mode}</p>
          <p className="mt-2 text-sm text-bc-muted">{data.apiBaseUrl}</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.secretConfigured ? "acid" : "amber"}>Secret</Badge>
          <p className="mt-4 text-3xl font-black">{data.secretConfigured ? "Ready" : "Missing"}</p>
          <p className="mt-2 text-sm text-bc-muted">Server env only.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Coverage</Badge>
          <p className="mt-4 text-3xl font-black">{data.useCases.filter((item) => item.enabled).length}/3</p>
          <p className="mt-2 text-sm text-bc-muted">Stars, shop, payouts.</p>
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
            Store `PAYPAL_CLIENT_SECRET` only in the server environment. It is intentionally not editable here.
          </div>
          <div>
            <Button disabled={pending} type="submit" variant="primary">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save PayPal settings
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
          </div>
        </article>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="acid">Producer payouts</Badge>
            <h3 className="mt-4 text-xl font-black">PayPal Payouts API</h3>
            <p className="mt-2 max-w-3xl text-sm text-bc-muted">
              Producer sales balances will be settled through PayPal payouts once track purchases and entitlements are connected.
            </p>
          </div>
          <Send className="h-7 w-7 text-bc-acid" aria-hidden="true" />
        </div>
      </section>
    </div>
  );
}
