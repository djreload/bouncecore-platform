"use client";

import { useActionState } from "react";
import { Archive, CheckCircle2, Disc3, Save, ShieldCheck, Undo2 } from "lucide-react";
import { adminTracksAction } from "@/app/admin/tracks/actions";
import { initialAdminTracksActionState, type AdminTracksActionState } from "@/app/admin/tracks/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminMusicData, AdminMusicTrackRow } from "@/lib/music/admin-music-service";

type AdminTracksPanelProps = {
  data: AdminMusicData;
  mode?: "catalogue" | "approvals";
};

const trackStatusOptions = ["draft", "pending", "approved", "archived"] as const;

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

function priceInputValue(pence: number) {
  return (pence / 100).toFixed(2);
}

function statusTone(status: string) {
  if (status === "approved") {
    return "acid" as const;
  }

  if (status === "pending") {
    return "amber" as const;
  }

  if (status === "archived") {
    return "muted" as const;
  }

  return "cyan" as const;
}

function TrackFields({ pending, track }: { pending: boolean; track: AdminMusicTrackRow }) {
  return (
    <>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`title-${track.id}`}>
          Title
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={track.title}
          disabled={pending}
          id={`title-${track.id}`}
          maxLength={120}
          name="title"
          required
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`slug-${track.id}`}>
          Slug
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={track.slug}
          disabled={pending}
          id={`slug-${track.id}`}
          maxLength={58}
          name="slug"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`genre-${track.id}`}>
          Genre
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={track.genre ?? ""}
          disabled={pending}
          id={`genre-${track.id}`}
          maxLength={60}
          name="genre"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`price-${track.id}`}>
          Price
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={priceInputValue(track.pricePence)}
          disabled={pending}
          id={`price-${track.id}`}
          min="0"
          name="pricePounds"
          step="0.01"
          type="number"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`bpm-${track.id}`}>
          BPM
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={track.bpm ?? ""}
          disabled={pending}
          id={`bpm-${track.id}`}
          max="260"
          min="40"
          name="bpm"
          type="number"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`key-${track.id}`}>
          Musical key
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={track.musicalKey ?? ""}
          disabled={pending}
          id={`key-${track.id}`}
          maxLength={20}
          name="musicalKey"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`status-${track.id}`}>
          Status
        </label>
        <select
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={track.status}
          disabled={pending}
          id={`status-${track.id}`}
          name="status"
        >
          {trackStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

function StatusButton({
  action,
  disabled,
  status,
  trackId
}: {
  action: (formData: FormData) => void;
  disabled: boolean;
  status: "draft" | "pending" | "approved" | "archived";
  trackId: string;
}) {
  const icons = {
    approved: CheckCircle2,
    archived: Archive,
    draft: Undo2,
    pending: ShieldCheck
  };
  const Icon = icons[status];

  return (
    <form action={action}>
      <input name="intent" type="hidden" value="set-status" />
      <input name="trackId" type="hidden" value={trackId} />
      <input name="status" type="hidden" value={status} />
      <Button disabled={disabled} size="sm" type="submit" variant={status === "approved" ? "primary" : status === "archived" ? "pink" : "ghost"}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        {status}
      </Button>
    </form>
  );
}

export function AdminTracksPanel({ data, mode = "catalogue" }: AdminTracksPanelProps) {
  const [state, formAction, pending] = useActionState<AdminTracksActionState, FormData>(
    adminTracksAction,
    initialAdminTracksActionState
  );
  const tracks = mode === "approvals" ? data.tracks.filter((track) => track.status === "pending") : data.tracks;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Tracks</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.totalTracks}</p>
          <p className="mt-2 text-sm text-bc-muted">Tracks in this view.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Pending</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.pendingTracks}</p>
          <p className="mt-2 text-sm text-bc-muted">Awaiting admin review.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Approved</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.approvedTracks}</p>
          <p className="mt-2 text-sm text-bc-muted">Public catalogue tracks.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Value</Badge>
          <p className="mt-4 text-3xl font-black">{formatMoney(data.stats.approvedValuePence)}</p>
          <p className="mt-2 text-sm text-bc-muted">Approved list value.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone={mode === "approvals" ? "amber" : "acid"}>{mode === "approvals" ? "Approval queue" : "Music marketplace"}</Badge>
            <h3 className="mt-4 text-2xl font-black">{mode === "approvals" ? "Producer approvals" : "Track catalogue"}</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              {mode === "approvals"
                ? "Review pending producer submissions and decide whether they go live, return to draft, or archive."
                : "Edit track metadata, pricing, and approval state across the full producer catalogue."}
            </p>
          </div>
          <Disc3 className="h-7 w-7 text-bc-acid" aria-hidden="true" />
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

      <div className="grid gap-4">
        {tracks.map((track) => (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={track.id}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={statusTone(track.status)}>{track.status}</Badge>
                  <Badge tone="muted">{formatMoney(track.pricePence)}</Badge>
                </div>
                <h4 className="mt-3 text-xl font-black">{track.title}</h4>
                <p className="mt-1 text-sm text-bc-muted">
                  {track.producerName} / {track.producerEmail}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusButton action={formAction} disabled={pending || track.status === "approved"} status="approved" trackId={track.id} />
                <StatusButton action={formAction} disabled={pending || track.status === "draft"} status="draft" trackId={track.id} />
                <StatusButton action={formAction} disabled={pending || track.status === "archived"} status="archived" trackId={track.id} />
              </div>
            </div>

            {mode === "catalogue" ? (
              <form action={formAction} className="grid gap-4 xl:grid-cols-4">
                <input name="intent" type="hidden" value="update-track" />
                <input name="trackId" type="hidden" value={track.id} />
                <TrackFields pending={pending} track={track} />
                <div className="flex items-end">
                  <Button disabled={pending} type="submit" variant="dark">
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Save track
                  </Button>
                </div>
              </form>
            ) : (
              <div className="grid gap-3 rounded-md border border-bc-line bg-bc-ink p-4 text-sm md:grid-cols-3">
                <div>
                  <p className="text-bc-muted">Genre</p>
                  <p className="mt-1 font-semibold">{track.genre ?? "Unlisted"}</p>
                </div>
                <div>
                  <p className="text-bc-muted">BPM / Key</p>
                  <p className="mt-1 font-semibold">
                    {track.bpm ? `${track.bpm} BPM` : "No BPM"} / {track.musicalKey ?? "No key"}
                  </p>
                </div>
                <div>
                  <p className="text-bc-muted">Producer slug</p>
                  <p className="mt-1 font-semibold">{track.producerSlug}</p>
                </div>
              </div>
            )}
          </article>
        ))}

        {!tracks.length ? (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <Disc3 className="h-7 w-7 text-bc-acid" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-black">{mode === "approvals" ? "No pending approvals" : "No tracks yet"}</h3>
            <p className="mt-2 text-sm text-bc-muted">
              {mode === "approvals"
                ? "Pending producer submissions will appear here automatically."
                : "Producer tracks will appear here once creators start uploading catalogue records."}
            </p>
          </article>
        ) : null}
      </div>
    </div>
  );
}
