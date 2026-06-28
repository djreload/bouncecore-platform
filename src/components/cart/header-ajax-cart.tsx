"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Music, ShoppingBag, ShoppingCart, X } from "lucide-react";
import {
  cartUpdatedEventName,
  readGlobalCartSummary
} from "@/lib/cart/cart-events";
import type { GlobalCartSummary } from "@/lib/cart/cart-core";

type HeaderAjaxCartProps = {
  compact?: boolean;
};

function emptySummary(): GlobalCartSummary {
  return {
    musicCount: 0,
    shopCount: 0,
    totalCount: 0
  };
}

export function HeaderAjaxCart({ compact = false }: HeaderAjaxCartProps) {
  const [summary, setSummary] = useState<GlobalCartSummary>(emptySummary);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const refresh = () => setSummary(readGlobalCartSummary());
    const frame = window.requestAnimationFrame(refresh);

    function onStorage(event: StorageEvent) {
      if (!event.key || event.key.startsWith("bouncecore.")) {
        refresh();
      }
    }

    window.addEventListener(cartUpdatedEventName, refresh);
    window.addEventListener("storage", onStorage);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(cartUpdatedEventName, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-label={`Open basket, ${summary.totalCount} item${summary.totalCount === 1 ? "" : "s"}`}
        className={`bc-focus-ring inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-bc-line bg-white/5 px-3 text-xs font-semibold text-white transition hover:border-bc-electric/60 hover:bg-bc-electric/10 ${
          compact ? "w-full" : ""
        }`}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <ShoppingCart className="h-4 w-4 text-bc-electric" aria-hidden="true" />
        <span>{compact ? "Basket" : "Cart"}</span>
        <span className="grid min-w-5 place-items-center rounded bg-bc-pink px-1.5 py-0.5 text-[11px] font-black text-white">
          {summary.totalCount}
        </span>
      </button>

      {open ? (
        <section className="absolute right-0 top-[calc(100%+0.5rem)] z-[75] w-[min(22rem,calc(100vw-2rem))] rounded-md border border-bc-line bg-bc-panel p-3 text-sm shadow-[0_22px_70px_rgba(0,0,0,0.55)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-black">Basket</h2>
            <button
              aria-label="Close basket menu"
              className="bc-focus-ring grid h-8 w-8 place-items-center rounded-md border border-bc-line bg-bc-ink text-white"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-3 grid gap-2">
            <Link
              className="bc-focus-ring flex min-h-12 items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink px-3 hover:border-bc-electric/60"
              href="/shop"
              onClick={() => setOpen(false)}
            >
              <span className="inline-flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-bc-pink" aria-hidden="true" />
                Shop basket
              </span>
              <span className="font-black">{summary.shopCount}</span>
            </Link>
            <Link
              className="bc-focus-ring flex min-h-12 items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink px-3 hover:border-bc-electric/60"
              href="/music"
              onClick={() => setOpen(false)}
            >
              <span className="inline-flex items-center gap-2">
                <Music className="h-4 w-4 text-bc-acid" aria-hidden="true" />
                Music basket
              </span>
              <span className="font-black">{summary.musicCount}</span>
            </Link>
          </div>

          <p className="mt-3 text-xs leading-5 text-bc-muted">
            Basket totals update without reloading as items are added from the shop or music marketplace.
          </p>
        </section>
      ) : null}
    </div>
  );
}
