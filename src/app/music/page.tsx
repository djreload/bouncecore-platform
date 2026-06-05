/* eslint-disable @next/next/no-img-element */
import { CreditCard, Disc3, Download, LogIn, Music, Play, SlidersHorizontal } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicMusicTracks, getPurchasedMusicTrackIds } from "@/lib/music/music-service";
import { getPayPalIntegrationData, getPayPalMusicReadiness } from "@/lib/payments/paypal-service";

export const dynamic = "force-dynamic";

type MusicPageProps = {
  searchParams?: Promise<{
    checkout?: string | string[];
  }>;
};

const checkoutMessages: Record<string, { message: string; tone: "acid" | "amber" | "pink" }> = {
  cancelled: {
    message: "PayPal music checkout was cancelled.",
    tone: "amber"
  },
  "capture-error": {
    message: "PayPal approved the music purchase, but the capture could not be completed.",
    tone: "pink"
  },
  error: {
    message: "Music checkout could not start for that track.",
    tone: "pink"
  },
  "paypal-not-ready": {
    message: "PayPal music checkout needs client ID and server secret configuration before purchases can start.",
    tone: "pink"
  },
  success: {
    message: "PayPal music checkout complete. The track is now attached to your account.",
    tone: "acid"
  }
};

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function messageClass(tone: "acid" | "amber" | "pink") {
  if (tone === "acid") {
    return "border-bc-acid/30 bg-bc-acid/10 text-bc-acid";
  }

  if (tone === "amber") {
    return "border-amber-300/30 bg-amber-300/10 text-amber-200";
  }

  return "border-bc-pink/30 bg-bc-pink/10 text-bc-pink";
}

export default async function MusicPage({ searchParams }: MusicPageProps) {
  const params = searchParams ? await searchParams : {};
  const [tracks, paypal, currentUser] = await Promise.all([getPublicMusicTracks(), getPayPalIntegrationData(), getCurrentUser()]);
  const purchasedTrackIds = currentUser ? await getPurchasedMusicTrackIds(currentUser.id) : new Set<string>();
  const checkoutReadiness = getPayPalMusicReadiness(paypal.settings, paypal.secretConfigured);
  const checkoutMessage = checkoutMessages[firstParam(params.checkout) ?? ""];
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
          {checkoutMessage ? (
            <div className={`mt-5 rounded-md border p-3 text-sm ${messageClass(checkoutMessage.tone)}`}>
              {checkoutMessage.message}
            </div>
          ) : null}
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tracks.map((track) => {
            const owned = purchasedTrackIds.has(track.id);

            return (
              <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={track.id}>
                <div className="mb-5 aspect-square overflow-hidden rounded-md border border-bc-line bg-bc-ink">
                  {track.artworkUrl ? (
                    <img alt={track.title} className="h-full w-full object-cover" src={track.artworkUrl} />
                  ) : (
                    <div className="grid h-full place-items-center">
                      <Disc3 className="h-12 w-12 text-bc-acid" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="acid">Approved</Badge>
                      {owned ? <Badge tone="cyan">Owned</Badge> : null}
                    </div>
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

                {track.previewUrl ? (
                  <div className="mt-5 rounded-md border border-bc-line bg-bc-ink p-3">
                    <p className="mb-2 text-xs font-semibold uppercase text-bc-muted">Sample audio</p>
                    <audio className="w-full" controls preload="none" src={track.previewUrl}>
                      <a href={track.previewUrl}>Preview track</a>
                    </audio>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  <ButtonLink href={`/producers/${track.producerSlug}`} variant="ghost">
                    <Music className="h-4 w-4" aria-hidden="true" />
                    Producer
                  </ButtonLink>
                  {track.previewUrl ? (
                    <ButtonLink href={track.previewUrl} target="_blank" variant="ghost">
                      <Play className="h-4 w-4" aria-hidden="true" />
                      Preview file
                    </ButtonLink>
                  ) : null}
                  {owned ? (
                    <ButtonLink href="/account/downloads" variant="primary">
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Downloads
                    </ButtonLink>
                  ) : null}
                  {!currentUser ? (
                    <ButtonLink href="/auth/login?error=auth-required" variant="primary">
                      <LogIn className="h-4 w-4" aria-hidden="true" />
                      Login to buy
                    </ButtonLink>
                  ) : owned ? null : (
                    <form action="/music/checkout" method="post">
                      <input name="trackId" type="hidden" value={track.id} />
                      <Button disabled={owned || !checkoutReadiness.ready || track.pricePence <= 0} type="submit" variant="primary">
                        <CreditCard className="h-4 w-4" aria-hidden="true" />
                        {owned ? "Purchased" : "PayPal checkout"}
                      </Button>
                    </form>
                  )}
                </div>
              </article>
            );
          })}

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
            Music purchases use PayPal {paypal.settings.mode} checkout and create producer earnings records for future PayPal Payouts.{" "}
            {checkoutReadiness.ready ? "Checkout is ready for approved tracks." : checkoutReadiness.reason}
          </p>
        </section>
      </main>
    </PublicShell>
  );
}
