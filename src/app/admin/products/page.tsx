import { AdminShell } from "@/components/layout/admin-shell";
import { AdminProductsPanel } from "@/app/admin/products/products-panel";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminShopData } from "@/lib/shop/shop-service";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  await requireUserPermission("shop.manage");
  const data = await getAdminShopData();

  return (
    <AdminShell
      title="Products"
      description="Manage merch shop products, variants, pricing, stock, and public listing state."
    >
      <AdminProductsPanel products={data.products} stats={data.stats} />
    </AdminShell>
  );
}
