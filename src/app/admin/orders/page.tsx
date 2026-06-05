import { AdminShell } from "@/components/layout/admin-shell";
import { AdminOrdersPanel } from "@/app/admin/orders/orders-panel";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminOrdersData } from "@/lib/shop/order-service";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await requireUserPermission("shop.manage");
  const data = await getAdminOrdersData();

  return (
    <AdminShell title="Orders" description="Manage PayPal-backed merch and marketplace order status.">
      <AdminOrdersPanel data={data} />
    </AdminShell>
  );
}
