import { CreditCard, Disc3, Music, ShoppingBag, SlidersHorizontal } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getPublicMusicTracks } from "@/lib/music/music-service";
import { getPayPalIntegrationData } from "@/lib/payments/paypal-service";

export const dynamic = "force-dynamic";

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

export default async function MusicPage() {
  const [tracks, paypal] = await Promise.all([getPublicMusicTracks(), getPayPalIntegrationData()]);
  const genres = new Set(tracks.flatMap((track) => (track.genre ? [track.genre] : []))).size;
  const averagePrice = tracks.length ? tracks.reduce((total, track) => total + track.pricePence, 0) / tracks.length : 0;

  return (
    <PublicShell>
      <main className="mx-auto max-w-7xl px-4 py-10">
        <section className="rounded-md border border-bc-line bg-bc-panel p-6">
          <Badge tone="acid">Marketplace</Badge>
          <h1 className="mt-4 text-4xl font-black">Bouncecore Music</h1>
          <p className="mt-3 max-w-3xl text-bc-muted">
            Approved producer tracks, catalogue metadata, pricing, and producer links from the Bouncecore music database.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="cyan">Tracks</Badge>
              <p className="mt-3 text-3xl font-black">{tracks.length}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="pink">Genres</Badge>
              <p className="mt-3 text-3xl font-black">{genres}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="acid">Average</Badge>
              <p className="mt-3 text-3xl font-black">{formatMoney(averagePrice)}</p>
            </article>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tracks.map((track) => (
            <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={track.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge tone="acid">Approved</Badge>
                  <h2 className="mt-4 text-2xl font-black">{track.title}</h2>
                  <p className="mt-2 text-sm text-bc-muted">by {track.producerName}</p>
                </div>
                <Disc3 className="h-7 w-7 text-bc-acid" aria-hidden="true" />
              </div>

              <div className="mt-5 grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink p-3">
                  <span className="text-bc-muted">Genre</span>
                  <span className="font-semibold">{track.genre ?? "Unlisted"}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink p-3">
                  <span className="text-bc-muted">BPM / Key</span>
                  <span className="font-semibold">
                    {track.bpm ? `${track.bpm} BPM` : "No BPM"} / {track.musicalKey ?? "No key"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink p-3">
                  <span className="text-bc-muted">Price</span>
                  <span className="font-semibold">{formatMoney(track.pricePence)}</span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <ButtonLink href={`/producers/${track.producerSlug}`} variant="ghost">
                  <Music className="h-4 w-4" aria-hidden="true" />
                  Producer
                </ButtonLink>
                <ButtonLink href="/shop" variant="dark">
                  <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                  Store
                </ButtonLink>
              </div>
            </article>
          ))}

          {!tracks.length ? (
            <article className="rounded-md border border-bc-line bg-bc-panel p-5 md:col-span-2 xl:col-span-3">
              <SlidersHorizontal className="h-7 w-7 text-bc-acid" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-black">No approved tracks yet</h2>
              <p className="mt-2 text-sm text-bc-muted">Approved producer tracks will appear here automatically.</p>
            </article>
          ) : null}
        </section>

        <section className="mt-6 rounded-md border border-bc-line bg-bc-panel p-5">
          <CreditCard className="h-7 w-7 text-bc-acid" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-black">PayPal music payments</h2>
          <p className="mt-2 max-w-3xl text-sm text-bc-muted">
            Music purchases will use PayPal checkout, with producer payouts routed through PayPal Payouts in {paypal.settings.mode} mode.
          </p>
        </section>
      </main>
    </PublicShell>
  );
}
