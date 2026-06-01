import { Disc3, Music, UserRound } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getPublicProducerProfiles } from "@/lib/music/music-service";

export const dynamic = "force-dynamic";

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

export default async function ProducersPage() {
  const producers = await getPublicProducerProfiles();
  const approvedTracks = producers.reduce((total, producer) => total + producer.approvedTracks, 0);

  return (
    <PublicShell>
      <main className="mx-auto max-w-7xl px-4 py-10">
        <section className="rounded-md border border-bc-line bg-bc-panel p-6">
          <Badge tone="acid">Producer profiles</Badge>
          <h1 className="mt-4 text-4xl font-black">Producers</h1>
          <p className="mt-3 max-w-3xl text-bc-muted">
            Producer profiles connected to approved tracks, release metadata, pricing, and public catalogue pages.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="cyan">Profiles</Badge>
              <p className="mt-3 text-3xl font-black">{producers.length}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="acid">Approved tracks</Badge>
              <p className="mt-3 text-3xl font-black">{approvedTracks}</p>
            </article>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {producers.map((producer) => {
            const catalogueValue = producer.tracks.reduce((total, track) => total + track.pricePence, 0);

            return (
              <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={producer.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge tone={producer.approvedTracks ? "acid" : "muted"}>
                      {producer.approvedTracks ? "Catalogue live" : "Profile only"}
                    </Badge>
                    <h2 className="mt-4 text-2xl font-black">{producer.name}</h2>
                  </div>
                  <Music className="h-7 w-7 text-bc-acid" aria-hidden="true" />
                </div>
                <p className="mt-4 text-sm text-bc-muted">{producer.bio ?? "This producer has not added a bio yet."}</p>
                <div className="mt-5 grid gap-3 text-sm">
                  <div className="flex items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink p-3">
                    <span className="text-bc-muted">Approved tracks</span>
                    <span className="font-semibold">{producer.approvedTracks}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink p-3">
                    <span className="text-bc-muted">Catalogue value</span>
                    <span className="font-semibold">{formatMoney(catalogueValue)}</span>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <ButtonLink href={`/producers/${producer.slug}`} variant="primary">
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                    View producer
                  </ButtonLink>
                  <ButtonLink href="/music" variant="ghost">
                    <Disc3 className="h-4 w-4" aria-hidden="true" />
                    Music
                  </ButtonLink>
                </div>
              </article>
            );
          })}

          {!producers.length ? (
            <article className="rounded-md border border-bc-line bg-bc-panel p-5 md:col-span-2 xl:col-span-3">
              <Music className="h-7 w-7 text-bc-acid" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-black">No producer profiles yet</h2>
              <p className="mt-2 text-sm text-bc-muted">Producer profiles appear here once creators set them up.</p>
            </article>
          ) : null}
        </section>
      </main>
    </PublicShell>
  );
}
