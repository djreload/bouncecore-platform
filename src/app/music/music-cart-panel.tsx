"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LogIn, ShoppingCart, Trash2, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { musicCartStorageKey } from "@/lib/cart/storage-keys";

export type MusicCartTrack = {
  artworkUrl: string | null;
  id: string;
  owned: boolean;
  pricePence: number;
  producerName: string;
  title: string;
};

type MusicCartContextValue = {
  addTrack: (trackId: string) => void;
  cartTracks: MusicCartTrack[];
  isInCart: (trackId: string) => boolean;
  openCart: () => void;
  removeTrack: (trackId: string) => void;
};

const MusicCartContext = createContext<MusicCartContextValue | null>(null);

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

function storedCartIds(tracksById: Map<string, MusicCartTrack>) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(musicCartStorageKey) ?? "[]") as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((trackId): trackId is string => {
      const track = typeof trackId === "string" ? tracksById.get(trackId) : null;

      return Boolean(track && !track.owned);
    });
  } catch {
    return [];
  }
}

function useMusicCart() {
  const context = useContext(MusicCartContext);

  if (!context) {
    throw new Error("Music cart controls must be rendered inside MusicCartProvider.");
  }

  return context;
}

export function MusicCartProvider({
  checkoutReady,
  checkoutReason,
  children,
  signedIn,
  tracks
}: {
  checkoutReady: boolean;
  checkoutReason: string | null;
  children: ReactNode;
  signedIn: boolean;
  tracks: MusicCartTrack[];
}) {
  const tracksById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
  const [cartIds, setCartIds] = useState<string[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setCartIds(storedCartIds(tracksById)));

    return () => window.cancelAnimationFrame(frame);
  }, [tracksById]);

  useEffect(() => {
    window.localStorage.setItem(musicCartStorageKey, JSON.stringify(cartIds));
  }, [cartIds]);

  const cartTracks = useMemo(
    () => cartIds.map((trackId) => tracksById.get(trackId)).filter((track): track is MusicCartTrack => Boolean(track)),
    [cartIds, tracksById]
  );
  const totalPence = cartTracks.reduce((total, track) => total + track.pricePence, 0);
  const value: MusicCartContextValue = {
    addTrack: (trackId) => {
      const track = tracksById.get(trackId);

      if (!track || track.owned) {
        return;
      }

      setCartIds((current) => (current.includes(trackId) ? current : [...current, trackId]));
      setCartOpen(true);
    },
    cartTracks,
    isInCart: (trackId) => cartIds.includes(trackId),
    openCart: () => setCartOpen(true),
    removeTrack: (trackId) => setCartIds((current) => current.filter((id) => id !== trackId))
  };

  return (
    <MusicCartContext.Provider value={value}>
      {children}

      {cartTracks.length ? (
        <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-md">
          {!cartOpen ? (
            <Button className="w-full justify-between" onClick={() => setCartOpen(true)} type="button" variant="primary">
              <span className="inline-flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                Basket
              </span>
              <span>{cartTracks.length} / {formatMoney(totalPence)}</span>
            </Button>
          ) : (
            <section className="rounded-md border border-bc-line bg-bc-panel shadow-[0_22px_80px_rgba(0,0,0,0.55)]">
              <div className="flex items-center justify-between gap-3 border-b border-bc-line p-4">
                <div>
                  <h2 className="font-black">Music basket</h2>
                  <p className="mt-1 text-sm text-bc-muted">{cartTracks.length} tracks / {formatMoney(totalPence)}</p>
                </div>
                <button
                  aria-label="Close music basket"
                  className="bc-focus-ring grid h-9 w-9 place-items-center rounded-md border border-bc-line bg-bc-ink text-white"
                  onClick={() => setCartOpen(false)}
                  type="button"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto p-3">
                {cartTracks.map((track) => (
                  <div className="flex items-center gap-3 border-b border-bc-line py-3 last:border-b-0" key={track.id}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{track.title}</p>
                      <p className="mt-1 text-xs text-bc-muted">by {track.producerName}</p>
                    </div>
                    <p className="text-sm font-black">{formatMoney(track.pricePence)}</p>
                    <button
                      aria-label={`Remove ${track.title} from basket`}
                      className="bc-focus-ring grid h-9 w-9 place-items-center rounded-md border border-bc-line bg-bc-ink text-bc-muted hover:text-white"
                      onClick={() => setCartIds((current) => current.filter((id) => id !== track.id))}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="border-t border-bc-line p-4">
                {!signedIn ? (
                  <ButtonLink className="w-full" href="/auth/login?error=auth-required" variant="primary">
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    Login to checkout
                  </ButtonLink>
                ) : (
                  <form action="/music/cart/checkout" method="post">
                    {cartTracks.map((track) => (
                      <input key={track.id} name="trackId" type="hidden" value={track.id} />
                    ))}
                    <Button className="w-full" disabled={!checkoutReady} type="submit" variant="primary">
                      <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                      Checkout with PayPal
                    </Button>
                    {!checkoutReady ? <p className="mt-2 text-xs text-bc-muted">{checkoutReason}</p> : null}
                  </form>
                )}
              </div>
            </section>
          )}
        </div>
      ) : null}
    </MusicCartContext.Provider>
  );
}

export function MusicCartButton({ disabled, size = "sm", trackId }: { disabled?: boolean; size?: "sm" | "md"; trackId: string }) {
  const { addTrack, isInCart, openCart } = useMusicCart();
  const added = isInCart(trackId);

  if (added) {
    return (
      <Button onClick={openCart} size={size} type="button" variant="ghost">
        <ShoppingCart className="h-4 w-4" aria-hidden="true" />
        In basket
      </Button>
    );
  }

  return (
    <Button disabled={disabled} onClick={() => addTrack(trackId)} size={size} type="button" variant="primary">
      <ShoppingCart className="h-4 w-4" aria-hidden="true" />
      Add to cart
    </Button>
  );
}
