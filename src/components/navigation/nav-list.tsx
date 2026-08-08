"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { icons } from "@/components/navigation/icons";
import { findActiveNavigationItem, type NavigationItem } from "@/config/navigation";
import { cn } from "@/lib/utils";

type NavListProps = {
  activeHref?: string;
  items: NavigationItem[];
  compact?: boolean;
  onNavigate?: () => void;
  orientation?: "horizontal" | "vertical";
};

export function NavList({ activeHref, items, compact = false, onNavigate, orientation = "vertical" }: NavListProps) {
  const pathname = usePathname();
  const resolvedActiveHref = activeHref ?? findActiveNavigationItem(items, pathname)?.href;

  return (
    <nav className={cn(orientation === "horizontal" ? "flex flex-nowrap items-center gap-1" : "space-y-1")}>
      {items.map((item) => {
        const Icon = icons[item.icon];
        const active = resolvedActiveHref === item.href;

        return (
          <Link
            className={cn(
              "bc-nav-link bc-focus-ring flex items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm text-bc-muted transition hover:border-bc-line hover:bg-white/5 hover:text-white",
              active && "bc-nav-link-active border-bc-electric/45 bg-bc-electric/10 text-white shadow-[0_0_24px_rgba(0,213,255,0.16)]",
              compact && "h-10 w-10 justify-center px-0",
              orientation === "horizontal" && "h-10 gap-1.5 px-2 text-[13px]"
            )}
            href={item.href}
            key={item.href}
            onClick={onNavigate}
            title={compact ? item.label : undefined}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            {!compact && <span className="truncate">{item.label}</span>}
            {!compact && item.badge ? (
              <span className="ml-auto rounded bg-bc-pink/15 px-1.5 py-0.5 text-[11px] font-semibold text-bc-pink">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
