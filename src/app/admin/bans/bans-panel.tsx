"use client";

import { useActionState } from "react";
import { Ban, Clock, ShieldOff, UserX } from "lucide-react";
import { adminBansAction } from "@/app/admin/bans/actions";
import { initialAdminBansActionState, type AdminBansActionState } from "@/app/admin/bans/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { roleBadgeTone, roleDisplayName } from "@/lib/auth/role-display";
import type { AdminBansData } from "@/lib/chat/moderation-service";

type AdminBansPanelProps = {
  data: AdminBansData;
};

const banDurationOptions = ["1h", "24h", "7d", "30d", "permanent"] as const;

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Permanent";
}

function banTone(active: boolean, revokedAt: string | null) {
  if (active) {
    return "pink" as const;
  }

  if (revokedAt) {
    return "muted" as const;
  }

  return "amber" as const;
}

export function AdminBansPanel({ data }: AdminBansPanelProps) {
  const [state, formAction, pending] = useActionState<AdminBansActionState, FormData>(
    adminBansAction,
    initialAdminBansActionState
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-5">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Total</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.total}</p>
          <p className="mt-2 text-sm text-bc-muted">Recent chat bans.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Active</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.active}</p>
          <p className="mt-2 text-sm text-bc-muted">Currently enforced.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Expired</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.expired}</p>
          <p className="mt-2 text-sm text-bc-muted">Time elapsed.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="muted">Revoked</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.revoked}</p>
          <p className="mt-2 text-sm text-bc-muted">Manually lifted.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Permanent</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.permanent}</p>
          <p className="mt-2 text-sm text-bc-muted">No expiry.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Create ban</Badge>
            <h3 className="mt-4 text-2xl font-black">Restrict chat access</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Chat bans block message and GIF posting, but do not disable login, purchases, downloads, or account access.
            </p>
          </div>
          <UserX className="h-7 w-7 text-bc-pink" aria-hidden="true" />
        </div>

        {state.message ? (
          <div
            className={`mt-5 rounded-md border p-3 text-sm ${
              state.status === "error"
                ? "border-bc-pink/30 bg-bc-pink/10 text-bc-pink"
                : "border-bc-acid/30 bg-bc-acid/10 text-bc-acid"
            }`}
          >
            {state.message}
          </div>
        ) : null}

        <form action={formAction} className="mt-5 grid gap-4">
          <input name="intent" type="hidden" value="create" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="ban-user">
                User
              </label>
              <select
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                disabled={pending}
                id="ban-user"
                name="userId"
              >
                {data.users.map((user) => (
                  <option disabled={user.status === "banned" || user.status === "suspended"} key={user.id} value={user.id}>
                    {user.displayName} / {user.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="ban-room">
                Scope
              </label>
              <select
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                disabled={pending}
                id="ban-room"
                name="roomId"
              >
                <option value="">Global chat</option>
                {data.rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    #{room.slug}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="ban-duration">
                Duration
              </label>
              <select
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue="24h"
                disabled={pending}
                id="ban-duration"
                name="duration"
              >
                {banDurationOptions.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="ban-reason">
              Reason
            </label>
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              disabled={pending}
              id="ban-reason"
              maxLength={160}
              name="reason"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="ban-notes">
              Internal notes
            </label>
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              disabled={pending}
              id="ban-notes"
              name="notes"
            />
          </div>
          <div>
            <Button disabled={pending || !data.users.length} type="submit" variant="pink">
              <Ban className="h-4 w-4" aria-hidden="true" />
              Create chat ban
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-bc-line p-4">
          <h3 className="text-xl font-black">Ban ledger</h3>
          <Badge tone="muted">{data.bans.length} rows</Badge>
        </div>
        <div className="grid gap-4 p-4">
          {data.bans.map((ban) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={ban.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={banTone(ban.active, ban.revokedAt)}>{ban.active ? "active" : ban.revokedAt ? "revoked" : "expired"}</Badge>
                    <Badge tone="muted">{ban.roomSlug ? `#${ban.roomSlug}` : "global"}</Badge>
                    {!ban.expiresAt ? <Badge tone="pink">permanent</Badge> : null}
                  </div>
                  <h4 className="mt-3 text-lg font-black">{ban.userDisplayName}</h4>
                  <p className="mt-1 text-sm text-bc-muted">{ban.userEmail}</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-white">{ban.reason}</p>
                  {ban.notes ? <p className="mt-2 text-sm text-bc-muted">Notes: {ban.notes}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-bc-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      Expires {formatDate(ban.expiresAt)}
                    </span>
                    <span>Created {formatDate(ban.createdAt)}</span>
                    {ban.createdByDisplayName ? <span>By {ban.createdByDisplayName}</span> : null}
                    {ban.revokedByDisplayName ? <span>Revoked by {ban.revokedByDisplayName}</span> : null}
                  </div>
                </div>
                <form action={formAction}>
                  <input name="intent" type="hidden" value="revoke" />
                  <input name="banId" type="hidden" value={ban.id} />
                  <Button disabled={pending || !ban.active} size="sm" type="submit" variant="ghost">
                    <ShieldOff className="h-4 w-4" aria-hidden="true" />
                    Revoke
                  </Button>
                </form>
              </div>
            </article>
          ))}

          {!data.bans.length ? (
            <article className="rounded-md border border-bc-line bg-bc-ink p-5">
              <Ban className="h-7 w-7 text-bc-electric" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-black">No chat bans yet</h3>
              <p className="mt-2 text-sm text-bc-muted">Moderation chat bans will appear here.</p>
            </article>
          ) : null}
        </div>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <Badge tone="cyan">Eligible users</Badge>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.users.slice(0, 12).map((user) => (
            <div className="rounded-md border border-bc-line bg-bc-ink p-3" key={user.id}>
              <p className="font-semibold">{user.displayName}</p>
              <p className="mt-1 text-xs text-bc-muted">{user.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {user.roles.map((role) => (
                  <Badge key={role} tone={roleBadgeTone(role)}>
                    {roleDisplayName(role)}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
