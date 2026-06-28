import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StreamKeyPanel } from "@/app/streamer/stream-key/stream-key-panel";
import { requireUserPermission } from "@/lib/auth/guards";
import { getConfiguredRtmpIngestUrl } from "@/lib/stream/stream-ingest-settings";
import { getOwnActiveStreamKey } from "@/lib/stream/stream-key-service";

export const dynamic = "force-dynamic";

export default async function StreamKeyPage() {
  const user = await requireUserPermission("stream.keys.manage.own");
  const streamKey = await getOwnActiveStreamKey(user.id);
  const ingestUrl = getConfiguredRtmpIngestUrl();

  return (
    <DashboardShell
      mode="streamer"
      title="My stream key"
      description="Secure self-service area for DJ/Streamer stream keys. Raw keys must only be shown in authenticated dashboard views."
    >
      <StreamKeyPanel initialKey={streamKey} ingestUrl={ingestUrl} />
    </DashboardShell>
  );
}
