"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, Menu, Share2, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { BrandMark } from "@/components/branding/brand-mark";
import { HeaderAjaxCart } from "@/components/cart/header-ajax-cart";
import { MobileOnlineUserList } from "@/components/chat/mobile-online-user-list";
import { icons } from "@/components/navigation/icons";
import { RaveWarChallengeLauncher } from "@/components/rave-wars/rave-war-challenge-overlay";
import { publicNavigation, type NavigationItem } from "@/config/navigation";
import type { PublicChatPresenceUserRow } from "@/app/chat/state";
import type { RoleDisplayNameMap } from "@/lib/auth/role-display";
import { cn } from "@/lib/utils";

type PublicMobileMenuProps = {
  isSignedIn: boolean;
  items: NavigationItem[];
  logoUrl?: string | null;
  mobilePresenceUsers?: PublicChatPresenceUserRow[];
  roleDisplayLabels?: RoleDisplayNameMap;
  siteName: string;
};

function navigationForAuth(items: NavigationItem[], signedIn: boolean) {
  return items.filter((item) => {
    if (!signedIn && item.href.startsWith("/account")) {
      return false;
    }

    if (signedIn && (item.href.startsWith("/auth/login") || item.href.startsWith("/auth/register"))) {
      return false;
    }

    return true;
  });
}

export function PublicMobileMenu({ isSignedIn, items, logoUrl, mobilePresenceUsers = [], roleDisplayLabels, siteName }: PublicMobileMenuProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [presenceUsers, setPresenceUsers] = useState(mobilePresenceUsers);
  const visibleItems = navigationForAuth(items.length ? items : publicNavigation, isSignedIn);

  useEffect(() => {
    function handlePresenceUpdate(event: Event) {
      const detail = (event as CustomEvent<{ users?: PublicChatPresenceUserRow[] }>).detail;

      if (Array.isArray(detail?.users)) {
        setPresenceUsers(detail.users);
      }
    }

    window.addEventListener("bouncecore:chat-presence", handlePresenceUpdate);

    return () => {
      window.removeEventListener("bouncecore:chat-presence", handlePresenceUpdate);
    };
  }, []);

  function closeMenu() {
    setOpen(false);
  }

  function shareOnFacebook() {
    const url = typeof window === "undefined" ? "/" : window.location.href;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="lg:hidden">
      <button
        aria-expanded={open}
        aria-label="Open site menu"
        className="bc-icon-button bc-focus-ring inline-flex h-10 w-10 items-center justify-center rounded-md border border-bc-line bg-bc-panel text-white"
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
          <aside className="bc-mobile-menu-panel fixed bottom-0 right-0 top-0 z-10 flex h-dvh max-h-dvh w-[min(390px,92vw)] flex-col overflow-hidden border-l border-bc-line bg-bc-void shadow-2xl shadow-black/50">
            <div className="shrink-0 border-b border-bc-line bg-bc-ink p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <BrandMark className="h-9 w-9" iconClassName="h-4 w-4" logoUrl={logoUrl} siteName={siteName} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-bc-pink">Menu</p>
                    <h2 className="truncate text-xl font-black">{siteName}</h2>
                  </div>
                </div>
                <button
                  aria-label="Close site menu"
                  className="bc-icon-button bc-focus-ring inline-flex h-10 w-10 items-center justify-center rounded-md border border-bc-line bg-bc-panel text-white"
                  onClick={closeMenu}
                  type="button"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
              <div className="grid gap-1">
                {visibleItems.map((item) => {
                  const Icon = icons[item.icon];
                  const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.activePrefix ?? item.href));

                  return (
                    <Link
                      className={cn(
                        "bc-focus-ring flex min-h-12 items-center gap-3 rounded-md border border-bc-line/70 bg-bc-ink px-3 py-2 text-sm font-semibold text-white transition hover:border-bc-electric/60 hover:bg-bc-electric/10",
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
                <button
                  className="bc-focus-ring flex min-h-12 items-center gap-3 rounded-md border border-bc-line/70 bg-bc-ink px-3 py-2 text-left text-sm font-semibold text-white transition hover:border-bc-electric/60 hover:bg-bc-electric/10"
                  onClick={shareOnFacebook}
                  type="button"
                >
                  <Share2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="truncate">Share on Facebook</span>
                </button>
              </div>
              <RaveWarChallengeLauncher onNavigate={closeMenu} placement="mobile-menu" />
              <MobileOnlineUserList roleDisplayLabels={roleDisplayLabels} users={presenceUsers} />
            </nav>

            <div className="grid shrink-0 gap-2 border-t border-bc-line bg-bc-ink p-4">
              <HeaderAjaxCart compact />
              {isSignedIn ? (
                <LogoutButton label="Logout" size="md" />
              ) : (
                <>
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
                </>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
