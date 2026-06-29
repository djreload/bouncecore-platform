import { AdminShell } from "@/components/layout/admin-shell";
import { AdminPaymentsPanel } from "@/app/admin/payments/payments-panel";
import { requireUserPermission } from "@/lib/auth/guards";
import { getPaymentReconciliationData } from "@/lib/payments/payment-reconciliation-service";
import { getPayPalIntegrationData } from "@/lib/payments/paypal-service";
import { getRecentPayPalWebhookEvents } from "@/lib/payments/paypal-webhook-service";
import { getAdminProducerPayoutsData } from "@/lib/payments/producer-payout-service";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  await requireUserPermission("payments.manage");
  const [data, payouts, webhookEvents, reconciliation] = await Promise.all([
    getPayPalIntegrationData(),
    getAdminProducerPayoutsData(),
    getRecentPayPalWebhookEvents(),
    getPaymentReconciliationData()
  ]);

  return (
    <AdminShell
      title="Payments"
      description="PayPal integration control for stars purchases, merch checkout, and producer payouts."
    >
      <AdminPaymentsPanel data={data} payouts={payouts} reconciliation={reconciliation} webhookEvents={webhookEvents} />
    </AdminShell>
  );
}
