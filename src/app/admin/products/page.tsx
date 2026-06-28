import { AdminShell } from "@/components/layout/admin-shell";
import { AdminProductsPanel } from "@/app/admin/products/products-panel";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminShopData } from "@/lib/shop/shop-service";

export const dynamic = "force-dynamic";

type AdminProductsPageProps = {
  searchParams?: Promise<{
    repair?: string;
  }>;
};

function repairFilter(value: string | undefined) {
  return value === "missing-images" || value === "missing-variants" ? value : null;
}

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  await requireUserPermission("shop.manage");
  const params = searchParams ? await searchParams : {};
  const data = await getAdminShopData();

  return (
    <AdminShell
      title="Products"
      description="Manage merch shop products, variants, pricing, stock, and public listing state."
    >
      <AdminProductsPanel products={data.products} repairFilter={repairFilter(params.repair)} stats={data.stats} />
    </AdminShell>
  );
}
