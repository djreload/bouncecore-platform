import { AdminPrizeClaimsPanel } from "@/app/admin/prize-claims/prize-claims-panel";
import { AdminShell } from "@/components/layout/admin-shell";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminPrizeClaimsData } from "@/lib/rewards/prize-service";

export const dynamic = "force-dynamic";

export default async function AdminPrizeClaimsPage() {
  await requireUserPermission("rewards.manage");
  const data = await getAdminPrizeClaimsData();

  return (
    <AdminShell title="Prize claims" description="Review, fulfil, reject, and manually create reward prize claims.">
      <AdminPrizeClaimsPanel data={data} />
    </AdminShell>
  );
}
