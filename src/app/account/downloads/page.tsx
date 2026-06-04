import { Download, Music, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireSignedInUser } from "@/lib/auth/guards";
import { getAccountDownloadsData } from "@/lib/music/music-service";

export const dynamic = "force-dynamic";

type AccountDownloadsPageProps = {
  searchParams?: Promise<{
    download?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AccountDownloadsPage({ searchParams }: AccountDownloadsPageProps) {
  const user = await requireSignedInUser();
  const params = searchParams ? await searchParams : {};
  const data = await getAccountDownloadsData(user.id);
  const downloadStatus = firstParam(params.download);

  return (
    <DashboardShell title="Downloads" description="Owned music downloads, purchase licenses, and delivery history.">
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Owned</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.ownedTracks}</p>
          <p className="mt-2 text-sm text-bc-muted">Paid music tracks.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Ready</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.downloadableTracks}</p>
          <p className="mt-2 text-sm text-bc-muted">Tracks with download delivery.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Spend</Badge>
          <p className="mt-4 text-3xl font-black">{formatMoney(data.stats.totalSpendPence)}</p>
          <p className="mt-2 text-sm text-bc-muted">Paid music purchases.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Downloads</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.totalDownloads}</p>
          <p className="mt-2 text-sm text-bc-muted">Recorded delivery clicks.</p>
        </article>
      </div>

      {downloadStatus === "missing" ? (
        <div className="mt-5 rounded-md border border-bc-pink/30 bg-bc-pink/10 p-3 text-sm text-bc-pink">
          This purchase is owned, but no download URL is configured yet.
        </div>
      ) : null}

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel">
        <div className="border-b border-bc-line p-4">
          <h3 className="text-xl font-black">Music downloads</h3>
          <p className="mt-1 text-sm text-bc-muted">Paid PayPal music purchases appear here after capture.</p>
        </div>
        <div className="grid gap-4 p-4">
          {data.downloads.map((download) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={download.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={download.downloadUrl ? "acid" : "amber"}>{download.downloadUrl ? "download ready" : "pending file"}</Badge>
                    <Badge tone="cyan">{download.licenseType}</Badge>
                    <Badge tone="muted">#{download.id.slice(0, 8)}</Badge>
                  </div>
                  <h4 className="mt-3 text-lg font-black">{download.trackTitle}</h4>
                  <p className="mt-1 text-sm text-bc-muted">by {download.producerName}</p>
                  <p className="mt-1 text-xs text-bc-muted">
                    {download.genre ?? "No genre"} / {download.bpm ? `${download.bpm} BPM` : "No BPM"} / {download.musicalKey ?? "No key"}
                  </p>
                </div>
                <ButtonLink href={`/account/downloads/${download.id}`} variant={download.downloadUrl ? "primary" : "ghost"}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download
                </ButtonLink>
              </div>
              <div className="mt-4 grid gap-3 rounded-md border border-bc-line bg-bc-panel p-3 text-sm md:grid-cols-3">
                <div>
                  <p className="text-bc-muted">Purchased</p>
                  <p className="mt-1 font-semibold">{formatDate(download.completedAt)}</p>
                </div>
                <div>
                  <p className="text-bc-muted">Last download</p>
                  <p className="mt-1 font-semibold">{formatDate(download.lastDownloadedAt)}</p>
                </div>
                <div>
                  <p className="text-bc-muted">Download count</p>
                  <p className="mt-1 font-semibold">{download.downloadCount}</p>
                </div>
              </div>
              <div className="mt-3 rounded-md border border-bc-line bg-bc-panel p-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-bc-acid" aria-hidden="true" />
                  <p className="text-sm font-semibold">License</p>
                </div>
                <p className="mt-2 text-sm text-bc-muted">
                  {download.licenseSummary ??
                    "Personal listening and DJ set use. Redistribution, resale, and re-uploading are not included unless agreed separately."}
                </p>
              </div>
            </article>
          ))}

          {!data.downloads.length ? (
            <article className="rounded-md border border-bc-line bg-bc-ink p-5">
              <Music className="h-7 w-7 text-bc-acid" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-black">No music downloads yet</h3>
              <p className="mt-2 text-sm text-bc-muted">Purchased tracks will appear here after PayPal checkout completes.</p>
              <div className="mt-4">
                <ButtonLink href="/music" variant="primary">
                  Browse music
                </ButtonLink>
              </div>
            </article>
          ) : null}
        </div>
      </section>
    </DashboardShell>
  );
}
