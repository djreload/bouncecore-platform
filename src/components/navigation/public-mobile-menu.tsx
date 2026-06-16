"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, Menu, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { icons } from "@/components/navigation/icons";
import type { NavigationItem } from "@/config/navigation";
import { cn } from "@/lib/utils";

type PublicMobileMenuProps = {
  items: NavigationItem[];
  siteName: string;
};

export function PublicMobileMenu({ items, siteName }: PublicMobileMenuProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <div className="lg:hidden">
      <button
        aria-expanded={open}
        aria-label="Open site menu"
        className="bc-focus-ring inline-flex h-10 w-10 items-center justify-center rounded-md border border-bc-line bg-bc-panel text-white"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            aria-label="Close site menu overlay"
            className="absolute inset-0 bg-black/75"
            onClick={closeMenu}
            type="button"
          />
          <aside className="relative z-10 ml-auto grid h-full w-[min(360px,calc(100vw-2rem))] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-l border-bc-line bg-bc-void shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between gap-3 border-b border-bc-line p-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-bc-pink">Menu</p>
                <h2 className="truncate text-xl font-black">{siteName}</h2>
              </div>
              <button
                aria-label="Close site menu"
                className="bc-focus-ring inline-flex h-10 w-10 items-center justify-center rounded-md border border-bc-line bg-bc-panel text-white"
                onClick={closeMenu}
                type="button"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <nav className="overflow-y-auto p-3">
              <div className="grid gap-1">
                {items.map((item) => {
                  const Icon = icons[item.icon];
                  const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.activePrefix ?? item.href));

                  return (
                    <Link
                      className={cn(
                        "bc-focus-ring flex min-h-12 items-center gap-3 rounded-md border border-transparent bg-bc-ink/70 px-3 py-2 text-sm font-semibold text-white transition hover:border-bc-line hover:bg-white/5",
                        active && "border-bc-electric/45 bg-bc-electric/10 text-white shadow-[0_0_24px_rgba(0,213,255,0.16)]"
                      )}
                      href={item.href}
                      key={item.href}
                      onClick={closeMenu}
                    >
                      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="ml-auto rounded bg-bc-pink/15 px-1.5 py-0.5 text-[11px] font-semibold text-bc-pink">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </nav>

            <div className="grid gap-2 border-t border-bc-line bg-bc-ink p-4">
              <Link
                className="bc-focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-bc-line bg-bc-panel px-3 text-sm font-semibold text-white"
                href="/auth/login"
                onClick={closeMenu}
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Login
              </Link>
              <Link
                className="bc-focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-bc-pink px-3 text-sm font-semibold text-white shadow-[0_0_28px_rgba(255,43,214,0.28)]"
                href="/auth/register"
                onClick={closeMenu}
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Register
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
