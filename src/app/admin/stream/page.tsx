import { AdminShell } from "@/components/layout/admin-shell";
import { AdminStreamControlPanel } from "@/app/admin/stream/stream-control-panel";
import type {
  AdminRestreamSettingsRow,
  AdminStreamChannelRow,
  AdminStreamPlaybackSettingsRow,
  AdminStreamProfileRow,
  AdminYouTubeOAuthCredentialsRow
} from "@/app/admin/stream/state";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminStreamControlData } from "@/lib/stream/stream-channel-service";

export const dynamic = "force-dynamic";

type AdminStreamPageProps = {
  searchParams?: Promise<{ message?: string; repair?: string; youtube?: string }>;
};

function repairFilter(value: string | undefined) {
  return value === "missing-offline-image" ? value : null;
}

function youtubeNotice(status: string | undefined, message: string | undefined) {
  if (!status) {
    return null;
  }

  return {
    message:
      message ||
      (status === "connected"
        ? "YouTube channel connected. Public auto-start is ready for this destination."
        : "YouTube channel connection could not be completed."),
    status: status === "connected" ? ("success" as const) : ("error" as const)
  };
}

export default async function AdminStreamPage({ searchParams }: AdminStreamPageProps) {
  await requireUserPermission("stream.dashboard");
  const params = searchParams ? await searchParams : {};
  const { channels, playbackSettings, provider, restreamSettings, streamProfiles, youtubeOAuthCredentials } =
    await getAdminStreamControlData();
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
  const restreamSettingsRows: AdminRestreamSettingsRow[] = restreamSettings;
  const playbackSettingsRow: AdminStreamPlaybackSettingsRow = playbackSettings;
  const youtubeOAuthCredentialsRow: AdminYouTubeOAuthCredentialsRow = youtubeOAuthCredentials;

  return (
    <AdminShell
      title="Stream dashboard"
      description="Database-backed live channel control, public playback status, and stream-provider boundary visibility."
    >
      <AdminStreamControlPanel
        channels={channelRows}
        playbackSettings={playbackSettingsRow}
        provider={provider}
        repairFilter={repairFilter(params.repair)}
        restreamSettings={restreamSettingsRows}
        streamProfiles={profileRows}
        youtubeNotice={youtubeNotice(params.youtube, params.message)}
        youtubeOAuthCredentials={youtubeOAuthCredentialsRow}
      />
    </AdminShell>
  );
}
