import { AdminShell } from "@/components/layout/admin-shell";
import { AdminOrdersPanel } from "@/app/admin/orders/orders-panel";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminFulfilmentData } from "@/lib/shop/order-service";

export const dynamic = "force-dynamic";

export default async function AdminFulfilmentPage() {
  await requireUserPermission("shop.manage");
  const data = await getAdminFulfilmentData();

  return (
    <AdminShell title="Fulfilment" description="Track paid orders that need handling, packing, or completion.">
      <AdminOrdersPanel data={data} mode="fulfilment" />
    </AdminShell>
  );
}
