"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  findActiveNavigationItem,
  groupNavigation,
  navigationGroupDescriptions,
  type NavigationItem
} from "@/config/navigation";
import { NavList } from "@/components/navigation/nav-list";
import { cn } from "@/lib/utils";

type GroupedNavProps = {
  items: NavigationItem[];
};

export function GroupedNav({ items }: GroupedNavProps) {
  const pathname = usePathname();
  const groups = useMemo(() => groupNavigation(items), [items]);
  const entries = Object.entries(groups);
  const activeItem = findActiveNavigationItem(items, pathname);
  const activeGroup = activeItem?.group ?? entries[0]?.[0] ?? "Main";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({});

  function toggleGroup(group: string) {
    setGroupOpen((current) => ({
      ...current,
      [group]: !(current[group] ?? group === activeGroup)
    }));
  }

  function navigationGroups(onNavigate?: () => void) {
    return entries.map(([group, groupItems]) => {
      const open = groupOpen[group] ?? group === activeGroup;
      const description = navigationGroupDescriptions[group];

      return (
        <section className="overflow-hidden rounded-md border border-bc-line bg-bc-panel/45" key={group}>
          <button
            aria-expanded={open}
            className="bc-focus-ring flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
            onClick={() => toggleGroup(group)}
            type="button"
          >
            <span className="min-w-0">
              <span className="block text-xs font-black uppercase text-white">{group}</span>
              {description ? <span className="mt-1 block text-[11px] leading-4 text-bc-muted">{description}</span> : null}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn("h-4 w-4 shrink-0 text-bc-electric transition-transform", open && "rotate-180")}
            />
          </button>
          {open ? (
            <div className="border-t border-bc-line p-1.5">
              <NavList activeHref={activeItem?.href} items={groupItems} onNavigate={onNavigate} />
            </div>
          ) : null}
        </section>
      );
    });
  }

  return (
    <>
      <div className="lg:hidden">
        <button
          aria-expanded={mobileOpen}
          className="bc-focus-ring flex w-full items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-panel px-3 py-3 text-left"
          onClick={() => setMobileOpen((open) => !open)}
          type="button"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Menu className="h-4 w-4 shrink-0 text-bc-electric" aria-hidden="true" />
            <span className="truncate text-sm font-black">{activeItem?.label ?? "Choose a section"}</span>
          </span>
          {mobileOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        </button>
        {mobileOpen ? (
          <div className="mt-2 grid max-h-[62dvh] gap-2 overflow-y-auto overscroll-contain pr-1">
            {navigationGroups(() => setMobileOpen(false))}
          </div>
        ) : null}
      </div>
      <div className="hidden gap-2 lg:grid">{navigationGroups()}</div>
    </>
  );
}
