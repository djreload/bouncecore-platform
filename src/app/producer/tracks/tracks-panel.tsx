"use client";

import { useActionState } from "react";
import { Archive, Disc3, Plus, Save } from "lucide-react";
import { producerAction } from "@/app/producer/actions";
import { initialProducerActionState, type ProducerActionState } from "@/app/producer/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProducerTrackRow, ProducerWorkspaceData } from "@/lib/music/music-service";

type ProducerTracksPanelProps = {
  data: ProducerWorkspaceData;
  mode?: "full" | "create";
};

const producerTrackStatusOptions = ["draft", "pending", "approved", "archived"] as const;

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

function TrackFields({ pending, track }: { pending: boolean; track?: ProducerTrackRow }) {
  return (
    <>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={track ? `title-${track.id}` : "create-title"}>
          Title
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={track?.title ?? ""}
          disabled={pending}
          id={track ? `title-${track.id}` : "create-title"}
          maxLength={120}
          name="title"
          placeholder="Track title"
          required
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={track ? `slug-${track.id}` : "create-slug"}>
          Slug
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={track?.slug ?? ""}
          disabled={pending}
          id={track ? `slug-${track.id}` : "create-slug"}
          maxLength={58}
          name="slug"
          placeholder="track-slug"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={track ? `genre-${track.id}` : "create-genre"}>
          Genre
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={track?.genre ?? ""}
          disabled={pending}
          id={track ? `genre-${track.id}` : "create-genre"}
          maxLength={60}
          name="genre"
          placeholder="Hardcore"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={track ? `price-${track.id}` : "create-price"}>
          Price
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={track ? priceInputValue(track.pricePence) : "1.99"}
          disabled={pending}
          id={track ? `price-${track.id}` : "create-price"}
          min="0"
          name="pricePounds"
          step="0.01"
          type="number"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={track ? `bpm-${track.id}` : "create-bpm"}>
          BPM
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={track?.bpm ?? ""}
          disabled={pending}
          id={track ? `bpm-${track.id}` : "create-bpm"}
          max="260"
          min="40"
          name="bpm"
          type="number"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={track ? `key-${track.id}` : "create-key"}>
          Musical key
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={track?.musicalKey ?? ""}
          disabled={pending}
          id={track ? `key-${track.id}` : "create-key"}
          maxLength={20}
          name="musicalKey"
          placeholder="A minor"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={track ? `status-${track.id}` : "create-status"}>
          Status
        </label>
        <select
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={track?.status ?? "draft"}
          disabled={pending}
          id={track ? `status-${track.id}` : "create-status"}
          name="status"
        >
          {producerTrackStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={track ? `preview-${track.id}` : "create-preview"}>
          Preview URL
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={track?.previewUrl ?? ""}
          disabled={pending}
          id={track ? `preview-${track.id}` : "create-preview"}
          maxLength={500}
          name="previewUrl"
          placeholder="https://..."
          type="url"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={track ? `download-${track.id}` : "create-download"}>
          Download URL
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={track?.downloadUrl ?? ""}
          disabled={pending}
          id={track ? `download-${track.id}` : "create-download"}
          maxLength={500}
          name="downloadUrl"
          placeholder="https://..."
          type="url"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={track ? `license-${track.id}` : "create-license"}>
          License type
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={track?.licenseType ?? "personal"}
          disabled={pending}
          id={track ? `license-${track.id}` : "create-license"}
          maxLength={40}
          name="licenseType"
          placeholder="personal"
        />
      </div>
      <div className="xl:col-span-2">
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={track ? `terms-${track.id}` : "create-terms"}>
          License summary
        </label>
        <textarea
          className="mt-2 min-h-24 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue={track?.licenseSummary ?? ""}
          disabled={pending}
          id={track ? `terms-${track.id}` : "create-terms"}
          maxLength={1200}
          name="licenseSummary"
          placeholder="Personal listening and DJ set use. Redistribution or resale is not included."
        />
      </div>
    </>
  );
}

export function ProducerTracksPanel({ data, mode = "full" }: ProducerTracksPanelProps) {
  const [state, formAction, pending] = useActionState<ProducerActionState, FormData>(
    producerAction,
    initialProducerActionState
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Tracks</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.totalTracks}</p>
          <p className="mt-2 text-sm text-bc-muted">Total tracks in your catalogue.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Approved</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.approvedTracks}</p>
          <p className="mt-2 text-sm text-bc-muted">Publicly listed tracks.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Pending</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.pendingTracks}</p>
          <p className="mt-2 text-sm text-bc-muted">Tracks awaiting approval.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Value</Badge>
          <p className="mt-4 text-3xl font-black">{formatMoney(data.stats.catalogueValuePence)}</p>
          <p className="mt-2 text-sm text-bc-muted">Combined list price.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex items-center gap-2">
          <Disc3 className="h-5 w-5 text-bc-acid" aria-hidden="true" />
          <h3 className="text-xl font-black">Add track</h3>
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
        <form action={formAction} className="mt-5 grid gap-4 xl:grid-cols-4">
          <input name="intent" type="hidden" value="create-track" />
          <TrackFields pending={pending} />
          <div className="flex items-end">
            <Button disabled={pending} type="submit" variant="primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create
            </Button>
          </div>
        </form>
      </section>

      {mode === "full" ? (
        <section className="rounded-md border border-bc-line bg-bc-panel">
          <div className="border-b border-bc-line p-4">
            <h3 className="text-xl font-black">Track catalogue</h3>
            <p className="mt-1 text-sm text-bc-muted">Edit metadata, pricing, and approval state for your digital tracks.</p>
          </div>
          <div className="grid gap-4 p-4">
            {data.tracks.map((track) => (
              <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={track.id}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Badge tone={statusTone(track.status)}>{track.status}</Badge>
                    <h4 className="mt-3 text-lg font-black">{track.title}</h4>
                    <p className="mt-1 text-sm text-bc-muted">
                      {track.genre ?? "No genre"} / {track.bpm ? `${track.bpm} BPM` : "No BPM"} / {track.musicalKey ?? "No key"}
                    </p>
                  </div>
                  <Badge tone="muted">{formatMoney(track.pricePence)}</Badge>
                  {track.downloadUrl ? <Badge tone="cyan">Download ready</Badge> : <Badge tone="amber">No download URL</Badge>}
                </div>
                <form action={formAction} className="grid gap-4 xl:grid-cols-4">
                  <input name="intent" type="hidden" value="update-track" />
                  <input name="trackId" type="hidden" value={track.id} />
                  <TrackFields pending={pending} track={track} />
                  <div className="flex items-end gap-2">
                    <Button disabled={pending} type="submit" variant="dark">
                      <Save className="h-4 w-4" aria-hidden="true" />
                      Save
                    </Button>
                  </div>
                </form>
                <form action={formAction} className="mt-3 flex justify-end">
                  <input name="intent" type="hidden" value="archive-track" />
                  <input name="trackId" type="hidden" value={track.id} />
                  <Button disabled={pending || track.status === "archived"} size="sm" type="submit" variant="pink">
                    <Archive className="h-4 w-4" aria-hidden="true" />
                    Archive
                  </Button>
                </form>
              </article>
            ))}
            {!data.tracks.length ? (
              <article className="rounded-md border border-bc-line bg-bc-ink p-5">
                <Disc3 className="h-7 w-7 text-bc-acid" aria-hidden="true" />
                <h3 className="mt-4 text-xl font-black">No tracks yet</h3>
                <p className="mt-2 text-sm text-bc-muted">Add your first track to start building the music catalogue.</p>
              </article>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
