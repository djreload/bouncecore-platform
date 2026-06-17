/* eslint-disable @next/next/no-img-element */
import { CreditCard, Disc3, Download, Music, Play, SlidersHorizontal, Trophy } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getTopDownloadedMusicTracks } from "@/lib/music/music-ranking";
import { getPublicMusicTracks, getPurchasedMusicTrackIds, type PublicMusicTrack } from "@/lib/music/music-service";
import { getPayPalIntegrationData, getPayPalMusicReadiness } from "@/lib/payments/paypal-service";
import { MusicCartButton, MusicCartProvider, type MusicCartTrack } from "./music-cart-panel";

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

function formatDownloads(count: number) {
  return `${count.toLocaleString("en-GB")} ${count === 1 ? "download" : "downloads"}`;
}

function TrackArtwork({ size = "large", track }: { size?: "large" | "small"; track: PublicMusicTrack }) {
  const sizeClass = size === "small" ? "h-14 w-14" : "h-24 w-24";

  return (
    <div className={`${sizeClass} shrink-0 overflow-hidden rounded-md border border-bc-line bg-bc-ink`}>
      {track.artworkUrl ? (
        <img alt={track.title} className="h-full w-full object-cover" src={track.artworkUrl} />
      ) : (
        <div className="grid h-full place-items-center">
          <Disc3 className={size === "small" ? "h-6 w-6 text-bc-acid" : "h-10 w-10 text-bc-acid"} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

export default async function MusicPage({ searchParams }: MusicPageProps) {
  const params = searchParams ? await searchParams : {};
  const [tracks, paypal, currentUser] = await Promise.all([getPublicMusicTracks(), getPayPalIntegrationData(), getCurrentUser()]);
  const purchasedTrackIds = currentUser ? await getPurchasedMusicTrackIds(currentUser.id) : new Set<string>();
  const checkoutReadiness = getPayPalMusicReadiness(paypal.settings, paypal.secretConfigured);
  const checkoutMessage = checkoutMessages[firstParam(params.checkout) ?? ""];
  const topTracks = getTopDownloadedMusicTracks(tracks, 20);
  const genres = new Set(tracks.flatMap((track) => (track.genre ? [track.genre] : []))).size;
  const averagePrice = tracks.length ? tracks.reduce((total, track) => total + track.pricePence, 0) / tracks.length : 0;
  const totalDownloads = tracks.reduce((total, track) => total + track.successfulDownloads, 0);
  const signedIn = Boolean(currentUser);
  const cartTracks: MusicCartTrack[] = tracks.map((track) => ({
    artworkUrl: track.artworkUrl,
    id: track.id,
    owned: purchasedTrackIds.has(track.id),
    pricePence: track.pricePence,
    producerName: track.producerName,
    title: track.title
  }));

  return (
    <PublicShell>
      <MusicCartProvider
        checkoutReady={checkoutReadiness.ready}
        checkoutReason={checkoutReadiness.reason}
        signedIn={signedIn}
        tracks={cartTracks}
      >
        <main className="mx-auto max-w-[1500px] px-4 py-10">
        <section className="rounded-md border border-bc-line bg-bc-panel p-6">
          <Badge tone="acid">Marketplace</Badge>
          <h1 className="mt-4 text-4xl font-black">Bouncecore Music</h1>
          <p className="mt-3 max-w-3xl text-bc-muted">
            Approved producer tracks, oldest releases first, with the most downloaded tracks ranked in the sidebar.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
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
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="pink">Downloads</Badge>
              <p className="mt-3 text-3xl font-black">{totalDownloads.toLocaleString("en-GB")}</p>
            </article>
          </div>
          {checkoutMessage ? (
            <div className={`mt-5 rounded-md border p-3 text-sm ${messageClass(checkoutMessage.tone)}`}>
              {checkoutMessage.message}
            </div>
          ) : null}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="overflow-hidden rounded-md border border-bc-line bg-bc-panel">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
              <div>
                <h2 className="text-xl font-black">Catalogue</h2>
                <p className="mt-1 text-sm text-bc-muted">Oldest to newest approved tracks.</p>
              </div>
              <Badge tone="acid">{tracks.length} listed</Badge>
            </div>

            <div className="divide-y divide-bc-line">
              {tracks.map((track) => {
                const owned = purchasedTrackIds.has(track.id);

                return (
                  <article className="grid gap-4 p-4 md:grid-cols-[6rem_minmax(0,1fr)_14rem] md:items-center" key={track.id}>
                    <TrackArtwork track={track} />

                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="acid">Approved</Badge>
                        {owned ? <Badge tone="cyan">Owned</Badge> : null}
                        <Badge tone="muted">Added {formatDate(track.createdAt)}</Badge>
                      </div>
                      <h2 className="mt-3 text-2xl font-black">{track.title}</h2>
                      <p className="mt-1 text-sm text-bc-muted">by {track.producerName}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-md border border-bc-line bg-bc-ink px-2.5 py-1 text-bc-muted">{track.genre ?? "Unlisted genre"}</span>
                        <span className="rounded-md border border-bc-line bg-bc-ink px-2.5 py-1 text-bc-muted">
                          {track.bpm ? `${track.bpm} BPM` : "No BPM"} / {track.musicalKey ?? "No key"}
                        </span>
                        <span className="rounded-md border border-bc-line bg-bc-ink px-2.5 py-1 text-bc-muted">
                          {formatDownloads(track.successfulDownloads)}
                        </span>
                      </div>

                      {track.previewUrl ? (
                        <div className="mt-4 rounded-md border border-bc-line bg-bc-ink p-3">
                          <p className="mb-2 text-xs font-semibold uppercase text-bc-muted">Sample audio</p>
                          <audio className="w-full" controls preload="none" src={track.previewUrl}>
                            <a href={track.previewUrl}>Preview track</a>
                          </audio>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-3 md:items-end">
                      <div className="md:text-right">
                        <p className="text-2xl font-black">{formatMoney(track.pricePence)}</p>
                        <p className="mt-1 text-xs text-bc-muted">{formatDownloads(track.successfulDownloads)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <ButtonLink href={`/producers/${track.producerSlug}`} size="sm" variant="ghost">
                          <Music className="h-4 w-4" aria-hidden="true" />
                          Producer
                        </ButtonLink>
                        {track.previewUrl ? (
                          <ButtonLink href={track.previewUrl} size="sm" target="_blank" variant="ghost">
                            <Play className="h-4 w-4" aria-hidden="true" />
                            Preview
                          </ButtonLink>
                        ) : null}
                        {owned ? (
                          <ButtonLink href="/account/downloads" size="sm" variant="primary">
                            <Download className="h-4 w-4" aria-hidden="true" />
                            Downloads
                          </ButtonLink>
                        ) : (
                          <MusicCartButton disabled={track.pricePence <= 0} size="sm" trackId={track.id} />
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}

              {!tracks.length ? (
                <article className="p-5">
                  <SlidersHorizontal className="h-7 w-7 text-bc-acid" aria-hidden="true" />
                  <h2 className="mt-4 text-xl font-black">No approved tracks yet</h2>
                  <p className="mt-2 text-sm text-bc-muted">Approved producer tracks will appear here automatically.</p>
                </article>
              ) : null}
            </div>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <section className="overflow-hidden rounded-md border border-bc-line bg-bc-panel">
              <div className="border-b border-bc-line p-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-bc-acid" aria-hidden="true" />
                  <h2 className="text-xl font-black">Top 20</h2>
                </div>
                <p className="mt-1 text-sm text-bc-muted">Ranked by successful downloads.</p>
              </div>

              <ol className="divide-y divide-bc-line">
                {topTracks.map((track, index) => {
                  const owned = purchasedTrackIds.has(track.id);
                  const rank = index + 1;

                  return (
                    <li className={`p-3 ${index < 5 ? "bc-music-top-five" : ""}`} key={track.id}>
                      <div className="flex gap-3">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-bc-line bg-bc-ink text-xs font-black text-bc-acid">
                          #{rank}
                        </div>
                        <TrackArtwork size="small" track={track} />
                        <div className="min-w-0 flex-1">
                          <p className="font-black leading-snug">{track.title}</p>
                          <p className="mt-1 text-xs text-bc-muted">by {track.producerName}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge tone={rank <= 5 ? "acid" : "muted"}>{formatDownloads(track.successfulDownloads)}</Badge>
                            <Badge tone="cyan">{formatMoney(track.pricePence)}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        {owned ? (
                          <ButtonLink href="/account/downloads" size="sm" variant="primary">
                            <Download className="h-4 w-4" aria-hidden="true" />
                            Downloads
                          </ButtonLink>
                        ) : (
                          <MusicCartButton disabled={track.pricePence <= 0} size="sm" trackId={track.id} />
                        )}
                      </div>
                    </li>
                  );
                })}

                {!topTracks.length ? (
                  <li className="p-4 text-sm text-bc-muted">No approved tracks yet.</li>
                ) : null}
              </ol>
            </section>
          </aside>
        </div>

        <section className="mt-6 rounded-md border border-bc-line bg-bc-panel p-5">
          <CreditCard className="h-7 w-7 text-bc-acid" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-black">PayPal music payments</h2>
          <p className="mt-2 max-w-3xl text-sm text-bc-muted">
            Music purchases use PayPal {paypal.settings.mode} checkout and create producer earnings records for PayPal Payouts.{" "}
            {checkoutReadiness.ready ? "Checkout is ready for approved tracks." : checkoutReadiness.reason}
          </p>
        </section>
        </main>
      </MusicCartProvider>
    </PublicShell>
  );
}
