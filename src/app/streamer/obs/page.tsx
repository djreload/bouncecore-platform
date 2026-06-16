import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ObsSetupPanel } from "@/app/streamer/obs/obs-setup-panel";
import { requireUserPermission } from "@/lib/auth/guards";
import { getPublicLiveState } from "@/lib/stream/stream-channel-service";
import { getOwnActiveStreamKey } from "@/lib/stream/stream-key-service";
import { getStreamProfiles } from "@/lib/stream/stream-profile-service";

export const dynamic = "force-dynamic";

export default async function StreamerObsPage() {
  const user = await requireUserPermission("stream.dashboard");
  const [liveState, streamKey, streamProfiles] = await Promise.all([
    getPublicLiveState(),
    getOwnActiveStreamKey(user.id),
    getStreamProfiles()
  ]);
  const ingestUrl = process.env.RTMP_INGEST_URL ?? "rtmps://bouncecore.example.com:1936/live/{streamKey}";
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "http://localhost:3000";
  const starOverlayUrl = `${appOrigin}/overlay/stars`;
  const activeProfile =
    liveState.channel?.streamProfile ?? streamProfiles.find((profile) => profile.isDefault) ?? streamProfiles[0] ?? null;

  return (
    <DashboardShell
      mode="streamer"
      title="OBS setup help"
      description="Connection values, readiness checks, and recommended output settings for sending your stream to Bouncecore."
    >
      <ObsSetupPanel
        channelSlug={liveState.channel?.slug ?? null}
        channelTitle={liveState.channel?.title ?? null}
        hasActiveKey={Boolean(streamKey && streamKey.status === "active" && !streamKey.revokedAt)}
        healthStatus={liveState.health.status}
        ingestConnected={liveState.health.ingestConnected}
        ingestUrl={ingestUrl}
        keyFingerprint={streamKey?.fingerprint ?? null}
        playbackUrl={liveState.playbackUrl}
        streamProfile={activeProfile}
        streamProfiles={streamProfiles}
        starOverlayUrl={starOverlayUrl}
      />
    </DashboardShell>
  );
}
