import { AdminShell } from "@/components/layout/admin-shell";
import { AdminStreamControlPanel } from "@/app/admin/stream/stream-control-panel";
import type { AdminStreamChannelRow, AdminStreamProfileRow } from "@/app/admin/stream/state";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminStreamControlData } from "@/lib/stream/stream-channel-service";

export const dynamic = "force-dynamic";

export default async function AdminStreamPage() {
  await requireUserPermission("stream.dashboard");
  const { channels, provider, streamProfiles } = await getAdminStreamControlData();
  const channelRows: AdminStreamChannelRow[] = channels.map((channel) => ({
    id: channel.id,
    slug: channel.slug,
    title: channel.title,
    status: channel.status,
    playbackUrl: channel.playbackUrl,
    offlineImageUrl: channel.offlineImageUrl,
    streamProfile: channel.streamProfile,
    streamKeys: channel.streamKeys,
    sessions: channel.sessions,
    events: channel.events
  }));
  const profileRows: AdminStreamProfileRow[] = streamProfiles;

  return (
    <AdminShell
      title="Stream dashboard"
      description="Database-backed live channel control, public playback status, and stream-provider boundary visibility."
    >
      <AdminStreamControlPanel channels={channelRows} provider={provider} streamProfiles={profileRows} />
    </AdminShell>
  );
}
