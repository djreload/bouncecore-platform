"use client";

import { useActionState } from "react";
import { BadgeCheck, Gift, Save, Star, Trophy } from "lucide-react";
import { adminPrizeClaimsAction } from "@/app/admin/prize-claims/actions";
import {
  initialAdminPrizeClaimsActionState,
  type AdminPrizeClaimsActionState
} from "@/app/admin/prize-claims/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { roleBadgeTone, roleDisplayName } from "@/lib/auth/role-display";
import type { AdminPrizeClaimsData } from "@/lib/rewards/prize-service";

type AdminPrizeClaimsPanelProps = {
  data: AdminPrizeClaimsData;
};

const prizeTypeOptions = ["none", "merch", "music", "vip", "manual"] as const;
const claimStatusOptions = ["pending", "approved", "fulfilled", "rejected"] as const;

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not set";
}

function statusTone(status: string) {
  if (status === "fulfilled") {
    return "acid" as const;
  }

  if (status === "approved" || status === "pending") {
    return "amber" as const;
  }

  return "muted" as const;
}

function prizeTone(prizeType: string) {
  if (prizeType === "none") {
    return "muted" as const;
  }

  return "pink" as const;
}

export function AdminPrizeClaimsPanel({ data }: AdminPrizeClaimsPanelProps) {
  const [state, formAction, pending] = useActionState<AdminPrizeClaimsActionState, FormData>(
    adminPrizeClaimsAction,
    initialAdminPrizeClaimsActionState
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-5">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Total</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.total}</p>
          <p className="mt-2 text-sm text-bc-muted">Recent prize claims.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Pending</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.pending}</p>
          <p className="mt-2 text-sm text-bc-muted">Awaiting review.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Approved</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.approved}</p>
          <p className="mt-2 text-sm text-bc-muted">Ready to fulfil.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Fulfilled</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.fulfilled}</p>
          <p className="mt-2 text-sm text-bc-muted">Completed claims.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Open value</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.starLiability.toLocaleString("en-GB")}</p>
          <p className="mt-2 text-sm text-bc-muted">Legacy numeric prize quantity on open claims.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Claims</Badge>
            <h3 className="mt-4 text-2xl font-black">Prize claim control</h3>
            <p className="mt-2 max-w-3xl text-sm text-bc-muted">
              Fulfil prize claims with manual notes. Stars are handled separately through live chat support sends.
            </p>
          </div>
          <Trophy className="h-7 w-7 text-bc-pink" aria-hidden="true" />
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
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <Badge tone="cyan">Manual claim</Badge>
        <form action={formAction} className="mt-4 grid gap-4">
          <input name="intent" type="hidden" value="create" />
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_180px_160px]">
            <select className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white" name="userId">
              {data.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName} / {user.email}
                </option>
              ))}
            </select>
            <select className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white" name="wheelId">
              <option value="">No wheel</option>
              {data.wheels.map((wheel) => (
                <option key={wheel.id} value={wheel.id}>
                  {wheel.name}
                </option>
              ))}
            </select>
            <select className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white" name="segmentId">
              <option value="">No segment</option>
              {data.segments.map((segment) => (
                <option key={segment.id} value={segment.id}>
                  {segment.wheelName} / {segment.label}
                </option>
              ))}
            </select>
            <select className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white" name="prizeType">
              {prizeTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px_240px_auto]">
            <input
              className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              name="title"
              placeholder="Prize title"
              required
            />
            <input
              className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              defaultValue="0"
              min="0"
              name="starAmount"
              type="number"
            />
            <input
              className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              name="prizeValue"
              placeholder="Prize value/reference"
            />
            <Button disabled={pending || !data.users.length} type="submit" variant="primary">
              <Gift className="h-4 w-4" aria-hidden="true" />
              Create claim
            </Button>
          </div>
          <textarea
            className="min-h-24 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
            name="description"
            placeholder="Claim description"
          />
        </form>
      </section>

      <div className="grid gap-4">
        {data.claims.map((claim) => (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={claim.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={statusTone(claim.status)}>{claim.status}</Badge>
                  <Badge tone={prizeTone(claim.prizeType)}>{claim.prizeType}</Badge>
                  {claim.wheelSlug ? <Badge tone="cyan">/{claim.wheelSlug}</Badge> : null}
                  {claim.starsCreditedAt ? <Badge tone="acid">legacy credit recorded</Badge> : null}
                </div>
                <h3 className="mt-3 text-xl font-black">{claim.title}</h3>
                <p className="mt-1 text-sm text-bc-muted">
                  {claim.userDisplayName} / {claim.userEmail} / {formatDate(claim.createdAt)}
                </p>
              </div>
              <BadgeCheck className="h-6 w-6 text-bc-acid" aria-hidden="true" />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-md border border-bc-line bg-bc-ink p-4">
                <p className="whitespace-pre-wrap text-sm text-white">{claim.description ?? "No description supplied."}</p>
                <div className="mt-4 grid gap-2 text-xs text-bc-muted sm:grid-cols-2">
                  <p>Wheel: {claim.wheelName ?? "Manual"}</p>
                  <p>Segment: {claim.segmentLabel ?? "None"}</p>
                  <p>Prize value: {claim.prizeValue ?? "None"}</p>
                  <p>Resolved: {claim.resolvedByDisplayName ?? "Not resolved"}</p>
                  <p>Resolved at: {formatDate(claim.resolvedAt)}</p>
                  <p>Legacy credit: {formatDate(claim.starsCreditedAt)}</p>
                </div>
                {claim.starAmount > 0 ? (
                  <div className="mt-4 flex items-center gap-2 rounded-md border border-bc-line bg-bc-panel p-3">
                    <Star className="h-5 w-5 text-bc-acid" aria-hidden="true" />
                    <span className="font-black">{claim.starAmount.toLocaleString("en-GB")} quantity</span>
                  </div>
                ) : null}
              </div>

              <form action={formAction} className="grid gap-3 rounded-md border border-bc-line bg-bc-ink p-4">
                <input name="intent" type="hidden" value="status" />
                <input name="claimId" type="hidden" value={claim.id} />
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`status-${claim.id}`}>
                  Status
                </label>
                <select
                  className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={claim.status}
                  disabled={pending}
                  id={`status-${claim.id}`}
                  name="status"
                >
                  {claimStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`note-${claim.id}`}>
                  Fulfilment note
                </label>
                <textarea
                  className="min-h-28 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={claim.fulfilmentNote ?? ""}
                  disabled={pending}
                  id={`note-${claim.id}`}
                  name="fulfilmentNote"
                />
                <Button disabled={pending} type="submit" variant="primary">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save claim
                </Button>
              </form>
            </div>
          </article>
        ))}

        {!data.claims.length ? (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <Gift className="h-7 w-7 text-bc-electric" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-black">No prize claims yet</h3>
            <p className="mt-2 text-sm text-bc-muted">Manual and future wheel-generated prize claims will appear here.</p>
          </article>
        ) : null}
      </div>

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
