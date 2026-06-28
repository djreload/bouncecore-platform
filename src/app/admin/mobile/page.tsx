import { AdminMobilePanel } from "@/app/admin/mobile/mobile-panel";
import { AdminShell } from "@/components/layout/admin-shell";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminMobileConfigData } from "@/lib/admin/mobile-service";

export const dynamic = "force-dynamic";

type AdminMobilePageProps = {
  searchParams?: Promise<{ repair?: string }>;
};

function repairFilter(value: string | undefined) {
  return value === "update-url" ? value : null;
}

export default async function AdminMobilePage({ searchParams }: AdminMobilePageProps) {
  await requireUserPermission("mobile.manage");
  const params = searchParams ? await searchParams : {};
  const data = await getAdminMobileConfigData();

  return (
    <AdminShell title="App config" description="Database-backed mobile API feature flags, theme settings, and launch controls.">
      <AdminMobilePanel data={data} repairFilter={repairFilter(params.repair)} />
    </AdminShell>
  );
}
