import { PerformanceResourceMonitor } from "@/app/account/performance/performance-resource-monitor";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireSignedInUser } from "@/lib/auth/guards";
import { getUserPerformancePreferences } from "@/lib/account/performance-preferences-service";

export const dynamic = "force-dynamic";

export default async function AccountPerformancePage() {
  const user = await requireSignedInUser();
  const { preferences } = await getUserPerformancePreferences(user.id);

  return (
    <DashboardShell
      title="Resource monitor"
      description="Live browser resource readings and per-account controls for battery use, heat, media, motion, and realtime activity."
    >
      <PerformanceResourceMonitor initialPreferences={preferences} />
    </DashboardShell>
  );
}
