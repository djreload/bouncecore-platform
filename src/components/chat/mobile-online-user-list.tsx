"use client";

import Image from "next/image";
import Link from "next/link";
import { MessageSquare, Target, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PublicChatPresenceUserRow } from "@/app/chat/state";
import { roleBadgeTone, roleDisplayName, visibleRoleBadges, type RoleDisplayNameMap } from "@/lib/auth/role-display";
import { cn } from "@/lib/utils";

type MobileOnlineUserListProps = {
  currentUserId?: string | null;
  onNavigate?: () => void;
  roleDisplayLabels?: RoleDisplayNameMap;
  users: PublicChatPresenceUserRow[];
};

function authorInitial(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

function presenceStatusTone(status: PublicChatPresenceUserRow["status"]) {
  return status === "online" ? "bg-bc-acid shadow-[0_0_10px_rgba(163,255,18,0.72)]" : "bg-bc-amber shadow-[0_0_10px_rgba(255,176,32,0.55)]";
}

function presenceStatusLabel(status: PublicChatPresenceUserRow["status"]) {
  return status === "online" ? "Online" : "Away";
}

function formatPresenceLastActive(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(
    new Date(value)
  );
}

export function MobileOnlineUserList({ currentUserId = null, onNavigate, roleDisplayLabels, users }: MobileOnlineUserListProps) {
  const onlineCount = users.filter((user) => user.status === "online").length;

  if (!users.length) {
    return null;
  }

  return (
    <section className="mt-3 rounded-md border border-bc-line/70 bg-bc-ink p-3" data-mobile-online-users>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <UsersRound className="h-4 w-4 shrink-0 text-bc-electric" aria-hidden="true" />
          <h3 className="truncate text-sm font-black">Online users</h3>
        </div>
        <span className="shrink-0 text-xs font-semibold text-bc-muted">
          {onlineCount} online / {Math.max(0, users.length - onlineCount)} away
        </span>
      </div>
      <div className="mt-3 grid max-h-[38dvh] gap-2 overflow-y-auto overscroll-contain pr-1">
        {users.map((user) => (
          <article className="rounded-md border border-bc-line bg-bc-panel p-2" key={user.id}>
            <div className="flex min-w-0 items-center gap-2">
              <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md border border-bc-line bg-bc-ink text-xs font-black text-bc-electric">
                {user.avatarUrl ? (
                  <Image alt="" className="h-full w-full object-cover" height={36} src={user.avatarUrl} unoptimized width={36} />
                ) : (
                  authorInitial(user.displayName)
                )}
                <span
                  aria-label={presenceStatusLabel(user.status)}
                  className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bc-ink", presenceStatusTone(user.status))}
                  title={presenceStatusLabel(user.status)}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">{user.displayName}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold">
                  <span className="text-bc-muted">
                    {presenceStatusLabel(user.status)} / {formatPresenceLastActive(user.lastActiveAt)}
                  </span>
                  <span className="inline-flex items-center gap-1 font-black text-red-400" title="Throw hits this livestream">
                    <Target className="h-3 w-3" aria-hidden="true" />
                    {user.throwHitCount.toLocaleString("en-GB")}
                  </span>
                </div>
              </div>
            </div>
            {visibleRoleBadges(user.roles).length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {visibleRoleBadges(user.roles).slice(0, 3).map((role) => (
                  <Badge className="py-0 text-[10px]" key={role} tone={roleBadgeTone(role)}>
                    {roleDisplayName(role, roleDisplayLabels)}
                  </Badge>
                ))}
              </div>
            ) : null}
            {currentUserId && user.id !== currentUserId ? (
              <Link
                className="bc-focus-ring mt-2 inline-flex min-h-8 w-full items-center justify-center gap-1.5 rounded-md border border-bc-line bg-bc-ink px-2 text-xs font-semibold text-white transition hover:border-bc-electric/60 hover:text-bc-electric"
                href={`/account/messages?user=${encodeURIComponent(user.id)}`}
                onClick={onNavigate}
              >
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                Message
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
