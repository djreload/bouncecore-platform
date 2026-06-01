import { notFound } from "next/navigation";
import { Disc3, Music, ShoppingBag } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getPublicProducerProfileBySlug } from "@/lib/music/music-service";

export const dynamic = "force-dynamic";

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

export default async function PublicProducerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const producer = await getPublicProducerProfileBySlug(slug);

  if (!producer) {
    notFound();
  }

  const catalogueValue = producer.tracks.reduce((total, track) => total + track.pricePence, 0);

  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <section className="rounded-md border border-bc-line bg-bc-panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <Badge tone={producer.approvedTracks ? "acid" : "muted"}>
                {producer.approvedTracks ? "Catalogue live" : "Producer profile"}
              </Badge>
              <h1 className="mt-4 text-4xl font-black">{producer.name}</h1>
              <p className="mt-3 max-w-3xl text-bc-muted">{producer.bio ?? "This producer has not added a public bio yet."}</p>
            </div>
            <Music className="h-10 w-10 text-bc-acid" aria-hidden="true" />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="cyan">Approved tracks</Badge>
              <p className="mt-3 text-3xl font-black">{producer.approvedTracks}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="pink">Catalogue value</Badge>
              <p className="mt-3 text-3xl font-black">{formatMoney(catalogueValue)}</p>
            </article>
          </div>
        </section>

        <section className="mt-6 rounded-md border border-bc-line bg-bc-panel">
          <div className="border-b border-bc-line p-4">
            <h2 className="text-xl font-black">Approved tracks</h2>
            <p className="mt-1 text-sm text-bc-muted">Public catalogue tracks from this producer.</p>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            {producer.tracks.map((track) => (
              <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={track.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge tone="acid">Approved</Badge>
                    <h3 className="mt-3 text-lg font-black">{track.title}</h3>
                  </div>
                  <Disc3 className="h-5 w-5 text-bc-acid" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm text-bc-muted">
                  {track.genre ?? "No genre"} / {track.bpm ? `${track.bpm} BPM` : "No BPM"} / {track.musicalKey ?? "No key"}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <Badge tone="muted">{formatMoney(track.pricePence)}</Badge>
                  <ButtonLink href="/shop" size="sm" variant="ghost">
                    <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                    Store
                  </ButtonLink>
                </div>
              </article>
            ))}

            {!producer.tracks.length ? (
              <article className="rounded-md border border-bc-line bg-bc-ink p-5 md:col-span-2">
                <Disc3 className="h-7 w-7 text-bc-acid" aria-hidden="true" />
                <h3 className="mt-4 text-xl font-black">No approved tracks yet</h3>
                <p className="mt-2 text-sm text-bc-muted">Approved releases from this producer will appear here.</p>
              </article>
            ) : null}
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
