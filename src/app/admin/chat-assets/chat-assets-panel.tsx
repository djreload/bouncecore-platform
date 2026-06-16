"use client";

import Image from "next/image";
import { useActionState } from "react";
import { Package, Plus, Save, Smile, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { adminChatAssetsAction } from "@/app/admin/chat-assets/actions";
import {
  initialAdminChatAssetsActionState,
  type AdminChatAssetPackRow,
  type AdminChatAssetRow,
  type AdminChatAssetsActionState,
  type AdminChatAssetsStats
} from "@/app/admin/chat-assets/state";

type AdminChatAssetsPanelProps = {
  packs: AdminChatAssetPackRow[];
  stats: AdminChatAssetsStats;
};

const packStatusOptions = ["active", "draft", "archived"] as const;
const assetKindOptions = ["sticker", "emoji"] as const;
const imageAccept = ".jpg,.jpeg,.png,.webp,.gif,.avif,image/jpeg,image/png,image/webp,image/gif,image/avif";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusTone(status: string) {
  if (status === "active") {
    return "acid" as const;
  }

  if (status === "draft") {
    return "amber" as const;
  }

  return "muted" as const;
}

function assetTone(kind: string) {
  return kind === "emoji" ? ("cyan" as const) : ("pink" as const);
}

function AssetPreview({ asset }: { asset: AdminChatAssetRow }) {
  return (
    <div className="grid gap-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-md border border-bc-line bg-bc-void">
        <Image
          alt={asset.name}
          className="h-full w-full object-contain"
          height={180}
          sizes="180px"
          src={asset.imageUrl}
          unoptimized
          width={180}
        />
      </div>
      <div className="flex flex-wrap gap-1">
        <Badge tone={assetTone(asset.kind)}>{asset.kind}</Badge>
        {asset.isAnimated ? <Badge tone="acid">Animated</Badge> : null}
      </div>
    </div>
  );
}

export function AdminChatAssetsPanel({ packs, stats }: AdminChatAssetsPanelProps) {
  const [state, formAction, pending] = useActionState<AdminChatAssetsActionState, FormData>(
    adminChatAssetsAction,
    initialAdminChatAssetsActionState
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Packs</Badge>
          <p className="mt-4 text-3xl font-black">{stats.packs}</p>
          <p className="mt-2 text-sm text-bc-muted">Sticker and emoji packs.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Active</Badge>
          <p className="mt-4 text-3xl font-black">{stats.activePacks}</p>
          <p className="mt-2 text-sm text-bc-muted">Visible in chat pickers.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Assets</Badge>
          <p className="mt-4 text-3xl font-black">{stats.assets}</p>
          <p className="mt-2 text-sm text-bc-muted">Uploaded stickers and emoji.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Animated</Badge>
          <p className="mt-4 text-3xl font-black">{stats.animated}</p>
          <p className="mt-2 text-sm text-bc-muted">Marked as animated assets.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">New pack</Badge>
            <h3 className="mt-4 text-2xl font-black">Create sticker pack</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Draft packs stay hidden. Active packs appear in the public and live chat picker.
            </p>
          </div>
          <Package className="h-7 w-7 text-bc-pink" aria-hidden="true" />
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

        <form action={formAction} className="mt-5 grid gap-3 lg:grid-cols-[1fr_180px_150px_120px_auto]">
          <input name="intent" type="hidden" value="create-pack" />
          <input
            className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
            name="name"
            placeholder="Pack name"
            required
          />
          <input
            className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
            name="slug"
            placeholder="pack-slug"
            required
          />
          <select className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white" name="status">
            {packStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <input
            className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
            name="sortOrder"
            placeholder="Order"
            type="number"
          />
          <Button disabled={pending} type="submit" variant="primary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create
          </Button>
          <textarea
            className="min-h-20 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white lg:col-span-5"
            maxLength={240}
            name="description"
            placeholder="Optional pack note"
          />
        </form>
      </section>

      <div className="grid gap-4">
        {packs.map((pack) => (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={pack.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={statusTone(pack.status)}>{pack.status}</Badge>
                  <Badge tone="muted">#{pack.slug}</Badge>
                  <Badge tone="cyan">{pack.stickers.length} assets</Badge>
                </div>
                <h3 className="mt-3 text-2xl font-black">{pack.name}</h3>
                <p className="mt-1 text-sm text-bc-muted">
                  Updated {formatDate(pack.updatedAt)}. Sort order {pack.sortOrder}.
                </p>
              </div>
            </div>

            <form action={formAction} className="mt-5 grid gap-3 lg:grid-cols-[1fr_180px_150px_120px_auto]">
              <input name="intent" type="hidden" value="update-pack" />
              <input name="packId" type="hidden" value={pack.id} />
              <input
                className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={pack.name}
                name="name"
                required
              />
              <input
                className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={pack.slug}
                name="slug"
                required
              />
              <select
                className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={pack.status}
                name="status"
              >
                {packStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <input
                className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={pack.sortOrder}
                name="sortOrder"
                type="number"
              />
              <Button disabled={pending} type="submit" variant="dark">
                <Save className="h-4 w-4" aria-hidden="true" />
                Save
              </Button>
              <textarea
                className="min-h-20 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white lg:col-span-5"
                defaultValue={pack.description ?? ""}
                maxLength={240}
                name="description"
              />
            </form>

            <section className="mt-5 rounded-md border border-bc-line bg-bc-ink p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Badge tone="acid">Add asset</Badge>
                  <h4 className="mt-3 text-lg font-black">Sticker or animated emoji</h4>
                </div>
                <Smile className="h-6 w-6 text-bc-acid" aria-hidden="true" />
              </div>
              <form
                action={formAction}
                className="mt-4 grid gap-3 lg:grid-cols-[1fr_150px_150px_120px_160px_auto]"
                encType="multipart/form-data"
              >
                <input name="intent" type="hidden" value="create-asset" />
                <input name="packId" type="hidden" value={pack.id} />
                <input
                  className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  name="name"
                  placeholder="Asset name"
                  required
                />
                <input
                  className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  name="shortcode"
                  placeholder=":reload:"
                  required
                />
                <select className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white" name="kind">
                  {assetKindOptions.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
                <input
                  className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  name="sortOrder"
                  placeholder="Order"
                  type="number"
                />
                <label className="flex min-h-10 items-center gap-2 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white">
                  <input className="h-4 w-4 accent-bc-electric" name="isAnimated" type="checkbox" value="true" />
                  Animated
                </label>
                <Button disabled={pending} type="submit" variant="primary">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Add
                </Button>
                <input
                  accept={imageAccept}
                  className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white lg:col-span-3"
                  name="imageUpload"
                  type="file"
                />
                <p className="text-xs text-bc-muted lg:col-span-6">
                  Stickers and animated emoji support JPG, PNG, WebP, GIF, and AVIF uploads up to 25MB.
                </p>
                <input
                  className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white lg:col-span-3"
                  name="imageUrl"
                  placeholder="Or paste image URL"
                />
              </form>
            </section>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pack.stickers.map((asset) => (
                <form
                  action={formAction}
                  className="grid gap-4 rounded-md border border-bc-line bg-bc-ink p-4"
                  encType="multipart/form-data"
                  key={asset.id}
                >
                  <input name="intent" type="hidden" value="update-asset" />
                  <input name="assetId" type="hidden" value={asset.id} />
                  <AssetPreview asset={asset} />
                  <div className="grid gap-3">
                    <input
                      className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                      defaultValue={asset.name}
                      name="name"
                      required
                    />
                    <input
                      className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                      defaultValue={asset.shortcode}
                      name="shortcode"
                      required
                    />
                    <select
                      className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                      defaultValue={asset.packId}
                      name="packId"
                    >
                      {packs.map((availablePack) => (
                        <option key={availablePack.id} value={availablePack.id}>
                          {availablePack.name}
                        </option>
                      ))}
                    </select>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select
                        className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                        defaultValue={asset.kind}
                        name="kind"
                      >
                        {assetKindOptions.map((kind) => (
                          <option key={kind} value={kind}>
                            {kind}
                          </option>
                        ))}
                      </select>
                      <input
                        className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                        defaultValue={asset.sortOrder}
                        name="sortOrder"
                        type="number"
                      />
                    </div>
                    <label className="flex min-h-10 items-center gap-2 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white">
                      <input
                        className="h-4 w-4 accent-bc-electric"
                        defaultChecked={asset.isAnimated}
                        name="isAnimated"
                        type="checkbox"
                        value="true"
                      />
                      Animated
                    </label>
                    <input
                      accept={imageAccept}
                      className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                      name="imageUpload"
                      type="file"
                    />
                    <input
                      className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                      name="imageUrl"
                      placeholder="Replacement image URL"
                    />
                    <Button disabled={pending} type="submit" variant="dark">
                      <Save className="h-4 w-4" aria-hidden="true" />
                      Save asset
                    </Button>
                  </div>
                </form>
              ))}
              {!pack.stickers.length ? (
                <div className="rounded-md border border-dashed border-bc-line bg-bc-ink p-5 text-sm text-bc-muted">
                  No stickers or emoji in this pack yet.
                </div>
              ) : null}
            </div>
          </article>
        ))}
        {!packs.length ? (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <Package className="h-7 w-7 text-bc-electric" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-black">No chat asset packs yet</h3>
            <p className="mt-2 text-sm text-bc-muted">Create a pack, add sticker or emoji images, then set it active.</p>
          </article>
        ) : null}
      </div>
    </div>
  );
}
