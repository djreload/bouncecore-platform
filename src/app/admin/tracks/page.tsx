import { AdminShell } from "@/components/layout/admin-shell";
import { AdminTracksPanel } from "@/app/admin/tracks/tracks-panel";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminMusicTracksData } from "@/lib/music/admin-music-service";

export const dynamic = "force-dynamic";

type AdminTracksPageProps = {
  searchParams?: Promise<{
    repair?: string;
  }>;
};

function repairFilter(value: string | undefined) {
  return value === "missing-delivery" || value === "missing-artwork" ? value : null;
}

export default async function AdminTracksPage({ searchParams }: AdminTracksPageProps) {
  await requireUserPermission("music.manage");
  const params = searchParams ? await searchParams : {};
  const data = await getAdminMusicTracksData();

  return (
    <AdminShell title="Tracks" description="Manage producer tracks, metadata, pricing, and catalogue approval state.">
      <AdminTracksPanel data={data} repairFilter={repairFilter(params.repair)} />
    </AdminShell>
  );
}
