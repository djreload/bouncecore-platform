import { Radio } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { getStreamProvider } from "@/lib/stream/stream-provider";

export default async function LivePage() {
  const provider = getStreamProvider();
  const [status, playbackUrl, viewerCount, health] = await Promise.all([
    provider.getStreamStatus(),
    provider.getPlaybackUrl(),
    provider.getViewerCount(),
    provider.getStreamHealth()
  ]);

  return (
    <PublicShell>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-5">
          <p className="text-sm text-bc-muted">Home / Live</p>
          <h1 className="mt-1 text-4xl font-black">Bouncecore Live</h1>
          <p className="mt-2 max-w-3xl text-bc-muted">
            Public playback shell wired to the replaceable stream provider. This page never exposes private stream keys.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="bc-scanlines grid aspect-video place-items-center overflow-hidden rounded-md border border-bc-line bg-bc-ink">
            <div className="relative z-10 text-center">
              <Radio className="mx-auto h-12 w-12 text-bc-electric" aria-hidden="true" />
              <h2 className="mt-4 text-2xl font-black">Player placeholder</h2>
              <p className="mt-2 text-sm text-bc-muted">{playbackUrl ?? "Playback URL not configured yet."}</p>
            </div>
          </section>
          <aside className="space-y-4">
            <div className="rounded-md border border-bc-line bg-bc-panel p-5">
              <Badge tone={status === "live" ? "acid" : "muted"}>{status.toUpperCase()}</Badge>
              <h2 className="mt-4 text-xl font-black">Stream status</h2>
              <p className="mt-2 text-sm text-bc-muted">{viewerCount} viewers via mock provider.</p>
            </div>
            <div className="rounded-md border border-bc-line bg-bc-panel p-5">
              <Badge tone="cyan">{health.status.toUpperCase()}</Badge>
              <h2 className="mt-4 text-xl font-black">Stream health</h2>
              <p className="mt-2 text-sm text-bc-muted">
                Ingest connected: {health.ingestConnected ? "yes" : "no"}. Checked {health.checkedAt}.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </PublicShell>
  );
}
