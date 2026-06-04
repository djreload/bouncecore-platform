import { AdminShell } from "@/components/layout/admin-shell";
import { AdminStarsPanel } from "@/app/admin/stars/stars-panel";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminStarsData } from "@/lib/rewards/stars-service";

export const dynamic = "force-dynamic";

export default async function AdminStarsPage() {
  await requireUserPermission("payments.manage");
  const data = await getAdminStarsData();

  return (
    <AdminShell
      title="Stars"
      description="Manage stars wallets, PayPal star purchases, live support balances, and manual corrections."
    >
      <AdminStarsPanel data={data} />
    </AdminShell>
  );
}
