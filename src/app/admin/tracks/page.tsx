import { AdminShell } from "@/components/layout/admin-shell";
import { AdminTracksPanel } from "@/app/admin/tracks/tracks-panel";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminMusicTracksData } from "@/lib/music/admin-music-service";

export const dynamic = "force-dynamic";

export default async function AdminTracksPage() {
  await requireUserPermission("music.manage");
  const data = await getAdminMusicTracksData();

  return (
    <AdminShell title="Tracks" description="Manage producer tracks, metadata, pricing, and catalogue approval state.">
      <AdminTracksPanel data={data} />
    </AdminShell>
  );
}
