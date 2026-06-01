import { Disc3, Music, ShieldCheck, Wallet } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireUserPermission } from "@/lib/auth/guards";
import { getProducerWorkspaceData } from "@/lib/music/music-service";

export const dynamic = "force-dynamic";

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

export default async function ProducerPage() {
  const user = await requireUserPermission("producer.dashboard");
  const data = await getProducerWorkspaceData(user.id);

  return (
    <DashboardShell
      mode="producer"
      title="Producer overview"
      description="Producer workspace for tracks, uploads, approvals, licenses, sales, downloads, and public profile management."
    >
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.profile ? "acid" : "amber"}>{data.profile ? "Profile ready" : "Setup needed"}</Badge>
          <h3 className="mt-4 text-xl font-black">{data.profile?.name ?? "Producer profile"}</h3>
          <p className="mt-2 text-sm text-bc-muted">{data.profile?.slug ? `/${data.profile.slug}` : "Create a profile slug."}</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Tracks</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.totalTracks}</p>
          <p className="mt-2 text-sm text-bc-muted">Total digital tracks.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Approved</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.approvedTracks}</p>
          <p className="mt-2 text-sm text-bc-muted">Public music catalogue items.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Value</Badge>
          <p className="mt-4 text-3xl font-black">{formatMoney(data.stats.catalogueValuePence)}</p>
          <p className="mt-2 text-sm text-bc-muted">Combined catalogue list price.</p>
        </article>
      </div>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="acid">Music marketplace</Badge>
            <h3 className="mt-4 text-2xl font-black">Catalogue controls</h3>
            <p className="mt-2 max-w-3xl text-sm text-bc-muted">
              Manage your producer identity, add tracks, and move tracks through draft, pending, approved, and archived states.
            </p>
          </div>
          <Music className="h-7 w-7 text-bc-acid" aria-hidden="true" />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/producer/profile" variant="primary">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Producer profile
          </ButtonLink>
          <ButtonLink href="/producer/tracks" variant="ghost">
            <Disc3 className="h-4 w-4" aria-hidden="true" />
            My tracks
          </ButtonLink>
          <ButtonLink href="/music" variant="dark">
            <Wallet className="h-4 w-4" aria-hidden="true" />
            Public music
          </ButtonLink>
        </div>
      </section>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel">
        <div className="border-b border-bc-line p-4">
          <h3 className="text-xl font-black">Recent catalogue</h3>
          <p className="mt-1 text-sm text-bc-muted">Your current track records and listing states.</p>
        </div>
        <div className="grid gap-3 p-4">
          {data.tracks.slice(0, 6).map((track) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={track.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold">{track.title}</h4>
                  <p className="mt-1 text-sm text-bc-muted">
                    {track.genre ?? "No genre"} / {track.bpm ? `${track.bpm} BPM` : "No BPM"} / {formatMoney(track.pricePence)}
                  </p>
                </div>
                <Badge tone={track.status === "approved" ? "acid" : track.status === "pending" ? "amber" : "cyan"}>{track.status}</Badge>
              </div>
            </article>
          ))}
          {!data.tracks.length ? (
            <article className="rounded-md border border-bc-line bg-bc-ink p-5">
              <Disc3 className="h-7 w-7 text-bc-acid" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-black">No tracks yet</h3>
              <p className="mt-2 text-sm text-bc-muted">Add a track to begin building your producer catalogue.</p>
            </article>
          ) : null}
        </div>
      </section>
    </DashboardShell>
  );
}
