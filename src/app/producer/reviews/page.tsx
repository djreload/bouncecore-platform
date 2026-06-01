import { Archive, CheckCircle2, Clock3, Disc3, Pencil } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireUserPermission } from "@/lib/auth/guards";
import { getProducerWorkspaceData } from "@/lib/music/music-service";

export const dynamic = "force-dynamic";

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

function statusTone(status: string) {
  if (status === "approved") {
    return "acid" as const;
  }

  if (status === "pending") {
    return "amber" as const;
  }

  if (status === "archived") {
    return "muted" as const;
  }

  return "cyan" as const;
}

function statusIcon(status: string) {
  if (status === "approved") {
    return CheckCircle2;
  }

  if (status === "pending") {
    return Clock3;
  }

  if (status === "archived") {
    return Archive;
  }

  return Pencil;
}

export default async function ProducerReviewsPage() {
  const user = await requireUserPermission("producer.dashboard");
  const data = await getProducerWorkspaceData(user.id);

  return (
    <DashboardShell
      mode="producer"
      title="Review status"
      description="Track review state for draft, pending, approved, and archived producer catalogue items."
    >
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Draft</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.draftTracks}</p>
          <p className="mt-2 text-sm text-bc-muted">Tracks not yet submitted.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Pending</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.pendingTracks}</p>
          <p className="mt-2 text-sm text-bc-muted">Awaiting admin review.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Approved</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.approvedTracks}</p>
          <p className="mt-2 text-sm text-bc-muted">Visible in public music.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="muted">Archived</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.archivedTracks}</p>
          <p className="mt-2 text-sm text-bc-muted">Hidden from marketplace.</p>
        </article>
      </div>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="amber">Approval flow</Badge>
            <h3 className="mt-4 text-2xl font-black">Track review queue</h3>
            <p className="mt-2 max-w-3xl text-sm text-bc-muted">
              Set a track to pending from My tracks to send it into the admin approval queue. Approved tracks appear on the public
              music catalogue.
            </p>
          </div>
          <Disc3 className="h-7 w-7 text-bc-acid" aria-hidden="true" />
        </div>
        <div className="mt-5">
          <ButtonLink href="/producer/tracks" variant="primary">
            Manage tracks
          </ButtonLink>
        </div>
      </section>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel">
        <div className="border-b border-bc-line p-4">
          <h3 className="text-xl font-black">Catalogue review states</h3>
          <p className="mt-1 text-sm text-bc-muted">Current status for each of your producer tracks.</p>
        </div>
        <div className="grid gap-3 p-4">
          {data.tracks.map((track) => {
            const Icon = statusIcon(track.status);

            return (
              <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={track.id}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-bc-acid" aria-hidden="true" />
                    <div>
                      <h4 className="font-black">{track.title}</h4>
                      <p className="mt-1 text-sm text-bc-muted">
                        {track.genre ?? "No genre"} / {formatMoney(track.pricePence)}
                      </p>
                    </div>
                  </div>
                  <Badge tone={statusTone(track.status)}>{track.status}</Badge>
                </div>
              </article>
            );
          })}

          {!data.tracks.length ? (
            <article className="rounded-md border border-bc-line bg-bc-ink p-5">
              <Disc3 className="h-7 w-7 text-bc-acid" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-black">No review items yet</h3>
              <p className="mt-2 text-sm text-bc-muted">Create a track to begin the producer review flow.</p>
            </article>
          ) : null}
        </div>
      </section>
    </DashboardShell>
  );
}
