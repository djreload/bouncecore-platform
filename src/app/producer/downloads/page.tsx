import { Download, Link2, Music } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireUserPermission } from "@/lib/auth/guards";
import { getProducerDownloadsData } from "@/lib/music/music-service";

export const dynamic = "force-dynamic";

function statusTone(configured: boolean) {
  return configured ? ("acid" as const) : ("amber" as const);
}

export default async function ProducerDownloadsPage() {
  const user = await requireUserPermission("producer.dashboard");
  const data = await getProducerDownloadsData(user.id);

  return (
    <DashboardShell mode="producer" title="Downloads" description="Track delivery URLs and buyer download activity.">
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Tracks</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.totalTracks}</p>
          <p className="mt-2 text-sm text-bc-muted">Producer catalogue records.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Configured</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.configuredDownloads}</p>
          <p className="mt-2 text-sm text-bc-muted">Tracks with download URLs.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Missing</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.missingDownloads}</p>
          <p className="mt-2 text-sm text-bc-muted">Tracks pending delivery setup.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Clicks</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.totalDownloadCount}</p>
          <p className="mt-2 text-sm text-bc-muted">Buyer download redirects.</p>
        </article>
      </div>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel">
        <div className="border-b border-bc-line p-4">
          <h3 className="text-xl font-black">Delivery assets</h3>
          <p className="mt-1 text-sm text-bc-muted">Edit download and preview URLs from your track catalogue.</p>
        </div>
        <div className="grid gap-4 p-4">
          {data.tracks.map((track) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={track.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={statusTone(Boolean(track.downloadUrl))}>{track.downloadUrl ? "download ready" : "missing download"}</Badge>
                    <Badge tone="cyan">{track.licenseType}</Badge>
                    <Badge tone="muted">{track.status}</Badge>
                  </div>
                  <h4 className="mt-3 text-lg font-black">{track.title}</h4>
                  <p className="mt-1 text-sm text-bc-muted">
                    {track.genre ?? "No genre"} / {track.bpm ? `${track.bpm} BPM` : "No BPM"} / {track.musicalKey ?? "No key"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black">{track.downloadCount}</p>
                  <p className="mt-1 text-xs text-bc-muted">
                    {track.paidSales} paid sale{track.paidSales === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-md border border-bc-line bg-bc-panel p-3">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-bc-acid" aria-hidden="true" />
                    <p className="font-semibold">Preview URL</p>
                  </div>
                  <p className="mt-2 break-all text-bc-muted">{track.previewUrl ?? "Not configured"}</p>
                </div>
                <div className="rounded-md border border-bc-line bg-bc-panel p-3">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-bc-pink" aria-hidden="true" />
                    <p className="font-semibold">Download URL</p>
                  </div>
                  <p className="mt-2 break-all text-bc-muted">{track.downloadUrl ?? "Not configured"}</p>
                </div>
              </div>
              <div className="mt-4">
                <ButtonLink href="/producer/tracks" variant="ghost">
                  Edit track delivery
                </ButtonLink>
              </div>
            </article>
          ))}

          {!data.tracks.length ? (
            <article className="rounded-md border border-bc-line bg-bc-ink p-5">
              <Music className="h-7 w-7 text-bc-acid" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-black">No track assets yet</h3>
              <p className="mt-2 text-sm text-bc-muted">Create tracks before configuring download delivery.</p>
            </article>
          ) : null}
        </div>
      </section>
    </DashboardShell>
  );
}
