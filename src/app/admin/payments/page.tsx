import { AdminShell } from "@/components/layout/admin-shell";
import { AdminPaymentsPanel } from "@/app/admin/payments/payments-panel";
import { requireUserPermission } from "@/lib/auth/guards";
import { getPaymentReconciliationData } from "@/lib/payments/payment-reconciliation-service";
import { getPayPalIntegrationData } from "@/lib/payments/paypal-service";
import { normalizePayPalWebhookFilters } from "@/lib/payments/paypal-webhook-filter-core";
import { getRecentPayPalWebhookEvents } from "@/lib/payments/paypal-webhook-service";
import { getAdminProducerPayoutsData } from "@/lib/payments/producer-payout-service";

export const dynamic = "force-dynamic";

type AdminPaymentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPaymentsPage({ searchParams }: AdminPaymentsPageProps) {
  await requireUserPermission("payments.manage");
  const params = await searchParams;
  const webhookFilters = normalizePayPalWebhookFilters({
    eventType: firstSearchParam(params.webhookEventType),
    limit: firstSearchParam(params.webhookLimit),
    query: firstSearchParam(params.webhookQuery),
    status: firstSearchParam(params.webhookStatus)
  });
  const [data, payouts, webhookEvents, reconciliation] = await Promise.all([
    getPayPalIntegrationData(),
    getAdminProducerPayoutsData(),
    getRecentPayPalWebhookEvents(webhookFilters),
    getPaymentReconciliationData()
  ]);

  return (
    <AdminShell
      title="Payments"
      description="PayPal integration control for stars purchases, merch checkout, and producer payouts."
    >
      <AdminPaymentsPanel
        data={data}
        payouts={payouts}
        reconciliation={reconciliation}
        webhookEvents={webhookEvents}
        webhookFilters={webhookFilters}
      />
    </AdminShell>
  );
}
