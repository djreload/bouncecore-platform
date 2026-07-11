"use client";

import Image from "next/image";
import { useActionState, useState, type ChangeEvent } from "react";
import { ImageIcon, Lock, MessageSquare, Plus, Radio, Save, ShieldOff, Sparkles, Timer, Trash2, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { adminChatroomsAction } from "@/app/admin/chatrooms/actions";
import { roleBadgeTone, roleDisplayName, visibleRoleBadges, type RoleDisplayNameMap } from "@/lib/auth/role-display";
import { defaultSheepThrowSprite, type SheepThrowSettings, type SheepThrowSprite } from "@/lib/chat/sheep-throw-settings";
import type { RaveWarSettings } from "@/lib/rave-wars/rave-war-settings";
import {
  initialAdminChatroomsActionState,
  type AdminChatMessageRow,
  type AdminChatRoomRow,
  type AdminChatSheepThrowRow,
  type AdminChatroomsActionState
} from "@/app/admin/chatrooms/state";
import { chatRoomTypeOptions } from "@/lib/chat/chat-types";

type AdminChatroomsPanelProps = {
  rooms: AdminChatRoomRow[];
  messages: AdminChatMessageRow[];
  raveWarSettings: RaveWarSettings;
  sheepThrows: AdminChatSheepThrowRow[];
  roleDisplayLabels: RoleDisplayNameMap;
  sheepSettings: SheepThrowSettings;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function roomTone(type: string) {
  if (type === "live") {
    return "acid" as const;
  }

  if (type === "vip") {
    return "pink" as const;
  }

  if (type === "private") {
    return "amber" as const;
  }

  return "cyan" as const;
}

function imageSize() {
  return {
    width: 180,
    height: 120
  };
}

const slowModeOptions = [
  { label: "Off", value: 0 },
  { label: "10 seconds", value: 10 },
  { label: "30 seconds", value: 30 },
  { label: "1 minute", value: 60 },
  { label: "5 minutes", value: 300 },
  { label: "15 minutes", value: 900 }
];

function slowModeLabel(seconds: number) {
  return slowModeOptions.find((option) => option.value === seconds)?.label ?? `${seconds} seconds`;
}

type SpriteFormRow = {
  id: string;
  label: string;
  spriteSheetUrl: string;
  impactSoundUrl: string;
  frameCount: string;
  columns: string;
  rows: string;
  frameWidth: string;
  frameHeight: string;
  enabled: boolean;
};

function toSpriteFormRow(sprite: SheepThrowSprite): SpriteFormRow {
  return {
    columns: String(sprite.columns),
    enabled: sprite.enabled,
    frameCount: String(sprite.frameCount),
    frameHeight: String(sprite.frameHeight),
    frameWidth: String(sprite.frameWidth),
    id: sprite.id,
    impactSoundUrl: sprite.impactSoundUrl ?? "",
    label: sprite.label,
    rows: String(sprite.rows),
    spriteSheetUrl: sprite.spriteSheetUrl
  };
}

function blankSpriteFormRow(): SpriteFormRow {
  return {
    columns: "12",
    enabled: true,
    frameCount: "12",
    frameHeight: "400",
    frameWidth: "400",
    id: "",
    impactSoundUrl: "",
    label: "",
    rows: "1",
    spriteSheetUrl: ""
  };
}

export function AdminChatroomsPanel({ rooms, messages, raveWarSettings, sheepThrows, roleDisplayLabels, sheepSettings }: AdminChatroomsPanelProps) {
  const [state, formAction, pending] = useActionState<AdminChatroomsActionState, FormData>(
    adminChatroomsAction,
    initialAdminChatroomsActionState
  );
  const [defaultSpriteRow, setDefaultSpriteRow] = useState<SpriteFormRow>(() =>
    toSpriteFormRow(sheepSettings.sprites.find((sprite) => sprite.id === "sheep") ?? sheepSettings.sprites[0] ?? defaultSheepThrowSprite)
  );
  const [spriteRows, setSpriteRows] = useState<SpriteFormRow[]>(() => {
    const customRows = sheepSettings.sprites.filter((sprite) => sprite.id !== "sheep").map(toSpriteFormRow);
    const blankRows = Array.from({ length: Math.max(2, 4 - customRows.length) }, () => blankSpriteFormRow());

    return [...customRows, ...blankRows];
  });
  const [spriteUploadMessage, setSpriteUploadMessage] = useState<string | null>(null);
  const [uploadingSpriteIndex, setUploadingSpriteIndex] = useState<number | null>(null);
  const [uploadingSoundIndex, setUploadingSoundIndex] = useState<number | null>(null);
  const [uploadingDefaultSound, setUploadingDefaultSound] = useState(false);
  const visibleMessages = messages.filter((message) => !message.deletedAt).length;
  const defaultSprite = sheepSettings.sprites.find((sprite) => sprite.id === "sheep") ?? sheepSettings.sprites[0] ?? defaultSheepThrowSprite;

  function updateSpriteRow(index: number, patch: Partial<SpriteFormRow>) {
    setSpriteRows((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function removeSpriteRow(index: number) {
    setSpriteRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
  }

  async function uploadDefaultImpactSound(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const uploadForm = new FormData();

    uploadForm.set("kind", "throw-sound");
    uploadForm.set("file", file);
    setUploadingDefaultSound(true);
    setSpriteUploadMessage(null);

    try {
      const response = await fetch("/api/admin/uploads", {
        method: "POST",
        body: uploadForm
      });
      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Default impact sound upload failed.");
      }

      const uploadedUrl = payload.url;

      setDefaultSpriteRow((row) => ({ ...row, impactSoundUrl: uploadedUrl }));
      setSpriteUploadMessage("Default sheep impact sound uploaded. Save the sheep throw settings to publish it.");
    } catch (error) {
      setSpriteUploadMessage(error instanceof Error ? error.message : "Default impact sound upload failed.");
    } finally {
      setUploadingDefaultSound(false);
      event.target.value = "";
    }
  }

  async function uploadSpriteSheet(index: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const uploadForm = new FormData();

    uploadForm.set("kind", "throw-sprite");
    uploadForm.set("file", file);
    setUploadingSpriteIndex(index);
    setSpriteUploadMessage(null);

    try {
      const response = await fetch("/api/admin/uploads", {
        method: "POST",
        body: uploadForm
      });
      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Sprite upload failed.");
      }

      updateSpriteRow(index, { spriteSheetUrl: payload.url });
      setSpriteUploadMessage("Sprite sheet uploaded. Save the sheep throw settings to publish it.");
    } catch (error) {
      setSpriteUploadMessage(error instanceof Error ? error.message : "Sprite upload failed.");
    } finally {
      setUploadingSpriteIndex(null);
      event.target.value = "";
    }
  }

  async function uploadImpactSound(index: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const uploadForm = new FormData();

    uploadForm.set("kind", "throw-sound");
    uploadForm.set("file", file);
    setUploadingSoundIndex(index);
    setSpriteUploadMessage(null);

    try {
      const response = await fetch("/api/admin/uploads", {
        method: "POST",
        body: uploadForm
      });
      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Impact sound upload failed.");
      }

      updateSpriteRow(index, { impactSoundUrl: payload.url });
      setSpriteUploadMessage("Impact sound uploaded. Save the sheep throw settings to publish it.");
    } catch (error) {
      setSpriteUploadMessage(error instanceof Error ? error.message : "Impact sound upload failed.");
    } finally {
      setUploadingSoundIndex(null);
      event.target.value = "";
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Rooms</Badge>
          <p className="mt-4 text-3xl font-black">{rooms.length}</p>
          <p className="mt-2 text-sm text-bc-muted">Configured native chat rooms.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Visible</Badge>
          <p className="mt-4 text-3xl font-black">{visibleMessages}</p>
          <p className="mt-2 text-sm text-bc-muted">Recent public messages still visible.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Moderated</Badge>
          <p className="mt-4 text-3xl font-black">{messages.length - visibleMessages}</p>
          <p className="mt-2 text-sm text-bc-muted">Recent messages hidden by moderators.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Sheep throws</Badge>
          <p className="mt-4 text-3xl font-black">{sheepThrows.length}</p>
          <p className="mt-2 text-sm text-bc-muted">Recent targeted chat throw activity.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Room setup</Badge>
            <h3 className="mt-4 text-2xl font-black">Chatroom control</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Create public, live, supporter, DJ, producer, and private-ready rooms backed by Bouncecore data.
            </p>
          </div>
          <form action={formAction}>
            <input name="intent" type="hidden" value="ensure-default" />
            <Button disabled={pending} type="submit" variant="ghost">
              <Radio className="h-4 w-4" aria-hidden="true" />
              Ensure default
            </Button>
          </form>
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
        <Badge tone="cyan">New room</Badge>
        <form action={formAction} className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
          <input name="intent" type="hidden" value="create" />
          <input
            className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
            name="name"
            placeholder="Room name"
            required
          />
          <input
            className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
            name="slug"
            placeholder="room-slug"
            required
          />
          <select className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white" name="type">
            {chatRoomTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <Button disabled={pending} type="submit" variant="primary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create
          </Button>
        </form>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="cyan">Chat games</Badge>
            <h3 className="mt-4 text-2xl font-black">Rave War mini-game</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Let signed-in chatters challenge one active online user to a private Hedgewars-style arena. The server enforces privacy, cooldown,
              and star cost.
            </p>
          </div>
          <Badge tone={raveWarSettings.enabled ? "acid" : "muted"}>{raveWarSettings.enabled ? "Enabled" : "Disabled"}</Badge>
        </div>
        <form action={formAction} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[150px_repeat(3,minmax(160px,1fr))_auto]">
          <input name="intent" type="hidden" value="rave-war-settings" />
          <div>
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="rave-war-enabled">
              Status
            </label>
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              defaultValue={raveWarSettings.enabled ? "true" : "false"}
              id="rave-war-enabled"
              name="enabled"
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
            <p className="mt-1 text-xs text-bc-muted">Turns the Rave War chat challenge button on or off.</p>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="rave-war-cost">
              Star cost
            </label>
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              defaultValue={String(raveWarSettings.costStars)}
              id="rave-war-cost"
              min={0}
              max={1000000}
              name="costStars"
              step={1}
              type="number"
            />
            <p className="mt-1 text-xs text-bc-muted">Deducted when a valid private challenge is created. Use 0 for free.</p>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="rave-war-cooldown">
              Cooldown minutes
            </label>
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              defaultValue={String(raveWarSettings.cooldownSeconds / 60)}
              id="rave-war-cooldown"
              min={0}
              max={1440}
              name="cooldownMinutes"
              step={0.5}
              type="number"
            />
            <p className="mt-1 text-xs text-bc-muted">Per-user delay before starting another challenge.</p>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="rave-war-expiry">
              Expiry minutes
            </label>
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              defaultValue={String(raveWarSettings.challengeTtlSeconds / 60)}
              id="rave-war-expiry"
              min={1}
              max={30}
              name="challengeTtlMinutes"
              step={0.5}
              type="number"
            />
            <p className="mt-1 text-xs text-bc-muted">How long the private challenge prompt stays valid.</p>
          </div>
          <div className="flex items-end">
            <Button disabled={pending} type="submit" variant="dark">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save Rave War
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="acid">Chat fun</Badge>
            <h3 className="mt-4 text-2xl font-black">Sheep throw overlay</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Let supporters trigger the sheep overlay from chat. The cooldown is enforced per user and the overlay queue is targeted.
            </p>
          </div>
          <Badge tone={sheepSettings.enabled ? "acid" : "muted"}>{sheepSettings.enabled ? "Enabled" : "Disabled"}</Badge>
        </div>
        <form action={formAction} className="mt-4 space-y-5">
          <input name="intent" type="hidden" value="sheep-settings" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[150px_repeat(5,minmax(140px,1fr))_auto]">
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="sheep-enabled">
                Status
              </label>
              <select
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={sheepSettings.enabled ? "true" : "false"}
                id="sheep-enabled"
                name="enabled"
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
              <p className="mt-1 text-xs text-bc-muted">Turns the sheep throw chat action and site overlay on or off.</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="sheep-cooldown">
                Cooldown minutes
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={String(sheepSettings.cooldownSeconds / 60)}
                id="sheep-cooldown"
                min={0}
                max={1440}
                name="cooldownMinutes"
                step={0.5}
                type="number"
              />
              <p className="mt-1 text-xs text-bc-muted">Default is 5 minutes. Use 0 to remove the cooldown.</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="sheep-cost">
                Star cost
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={String(sheepSettings.costStars)}
                id="sheep-cost"
                min={0}
                max={1000000}
                name="costStars"
                step={1}
                type="number"
              />
              <p className="mt-1 text-xs text-bc-muted">Stars deducted from the supporter who throws. Use 0 for free.</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="sheep-overlay-duration">
                Overlay seconds
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={String(sheepSettings.overlayDurationMs / 1000)}
                id="sheep-overlay-duration"
                min={1.8}
                max={10}
                name="overlayDurationSeconds"
                step={0.1}
                type="number"
              />
              <p className="mt-1 text-xs text-bc-muted">How long each targeted throw stays on screen.</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="sheep-poll-speed">
                Poll seconds
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={String(sheepSettings.pollMs / 1000)}
                id="sheep-poll-speed"
                min={1}
                max={10}
                name="pollSeconds"
                step={0.5}
                type="number"
              />
              <p className="mt-1 text-xs text-bc-muted">How often viewers check for throws targeted at them.</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="sheep-max-events">
                Queue depth
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={String(sheepSettings.maxRecentEvents)}
                id="sheep-max-events"
                min={4}
                max={50}
                name="maxRecentEvents"
                step={1}
                type="number"
              />
              <p className="mt-1 text-xs text-bc-muted">Maximum recent targeted throws to queue after a viewer reconnects.</p>
            </div>
          </div>

          <div className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="font-black">Throwable sprites</h4>
                <p className="mt-1 text-sm text-bc-muted">
                  Sheep is the default fallback. Add uploaded sprite sheets here to unlock options like unicorns or other throwables.
                </p>
              </div>
              <Button
                onClick={() => setSpriteRows((rows) => [...rows, blankSpriteFormRow()])}
                type="button"
                variant="ghost"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add row
              </Button>
            </div>

            {spriteUploadMessage ? (
              <p className="mt-3 rounded-md border border-bc-line bg-bc-panel p-3 text-sm text-bc-muted">{spriteUploadMessage}</p>
            ) : null}

            {defaultSprite ? (
              <div className="mt-4 rounded-md border border-bc-line bg-bc-panel p-3 text-sm">
                <input name="spriteId" type="hidden" value="sheep" />
                <input name="spriteLabel" type="hidden" value={defaultSpriteRow.label} />
                <input name="spriteSheetUrl" type="hidden" value={defaultSpriteRow.spriteSheetUrl} />
                <input name="spriteEnabled" type="hidden" value={defaultSpriteRow.enabled ? "true" : "false"} />
                <input name="spriteFrameCount" type="hidden" value={defaultSpriteRow.frameCount} />
                <input name="spriteColumns" type="hidden" value={defaultSpriteRow.columns} />
                <input name="spriteRows" type="hidden" value={defaultSpriteRow.rows} />
                <input name="spriteFrameWidth" type="hidden" value={defaultSpriteRow.frameWidth} />
                <input name="spriteFrameHeight" type="hidden" value={defaultSpriteRow.frameHeight} />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="acid">Default</Badge>
                  <span className="font-black">{defaultSprite.label}</span>
                  <span className="text-bc-muted">{defaultSprite.frameCount} frames</span>
                </div>
                <p className="mt-2 break-all text-xs text-bc-muted">{defaultSprite.spriteSheetUrl}</p>
                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto]">
                  <div>
                    <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="default-sheep-impact-sound">
                      Default sheep impact sound
                    </label>
                    <input
                      className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                      id="default-sheep-impact-sound"
                      name="spriteImpactSoundUrl"
                      onChange={(event) => setDefaultSpriteRow((row) => ({ ...row, impactSoundUrl: event.target.value }))}
                      placeholder="/uploads/throw-sounds/..."
                      value={defaultSpriteRow.impactSoundUrl}
                    />
                    <p className="mt-1 text-xs text-bc-muted">This sound plays when the built-in Sheep throwable splats.</p>
                  </div>
                  <div className="flex items-end">
                    <label className="bc-focus-ring inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-bc-line bg-bc-ink px-3 text-sm font-black text-white transition hover:border-bc-electric/60">
                      <Volume2 className="h-4 w-4" aria-hidden="true" />
                      {uploadingDefaultSound ? "Uploading" : "Sound"}
                      <input
                        accept=".mp3,.wav,.ogg,.oga,.webm,.m4a,.aac,audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4,audio/aac"
                        className="sr-only"
                        disabled={uploadingDefaultSound}
                        onChange={(event) => void uploadDefaultImpactSound(event)}
                        type="file"
                      />
                    </label>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              {spriteRows.map((row, index) => (
                <div className="rounded-md border border-bc-line bg-bc-panel p-3" key={`${row.id || "sprite"}-${index}`}>
                  <input name="spriteId" type="hidden" value={row.id} />
                  <div className="grid gap-3 lg:grid-cols-[160px_minmax(220px,1fr)_minmax(220px,1fr)_120px]">
                    <div>
                      <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`sprite-label-${index}`}>
                        Name
                      </label>
                      <input
                        className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                        id={`sprite-label-${index}`}
                        name="spriteLabel"
                        onChange={(event) => updateSpriteRow(index, { label: event.target.value })}
                        placeholder="Unicorn"
                        value={row.label}
                      />
                      <p className="mt-1 text-xs text-bc-muted">Shown in chat and the throw selector.</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`sprite-url-${index}`}>
                        Sprite sheet URL
                      </label>
                      <input
                        className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                        id={`sprite-url-${index}`}
                        name="spriteSheetUrl"
                        onChange={(event) => updateSpriteRow(index, { spriteSheetUrl: event.target.value })}
                        placeholder="/uploads/throw-sprites/..."
                        value={row.spriteSheetUrl}
                      />
                      <p className="mt-1 text-xs text-bc-muted">Use the upload button or paste a direct HTTPS image URL.</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`sprite-impact-sound-${index}`}>
                        Impact sound URL
                      </label>
                      <input
                        className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                        id={`sprite-impact-sound-${index}`}
                        name="spriteImpactSoundUrl"
                        onChange={(event) => updateSpriteRow(index, { impactSoundUrl: event.target.value })}
                        placeholder="/uploads/throw-sounds/..."
                        value={row.impactSoundUrl}
                      />
                      <p className="mt-1 text-xs text-bc-muted">Optional MP3, WAV, OGG, WebM, M4A, or AAC splat sound.</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`sprite-enabled-${index}`}>
                        Status
                      </label>
                      <select
                        className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                        id={`sprite-enabled-${index}`}
                        name="spriteEnabled"
                        onChange={(event) => updateSpriteRow(index, { enabled: event.target.value === "true" })}
                        value={row.enabled ? "true" : "false"}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <p className="mt-1 text-xs text-bc-muted">Disabled items do not appear in chat.</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-[100px_100px_100px_100px_auto]">
                    <div>
                      <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`sprite-frame-count-${index}`}>
                        Frames
                      </label>
                      <input
                        className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                        id={`sprite-frame-count-${index}`}
                        max={120}
                        min={1}
                        name="spriteFrameCount"
                        onChange={(event) => updateSpriteRow(index, { frameCount: event.target.value })}
                        type="number"
                        value={row.frameCount}
                      />
                      <p className="mt-1 text-xs text-bc-muted">Total frames in the sheet.</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`sprite-columns-${index}`}>
                        Columns
                      </label>
                      <input
                        className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                        id={`sprite-columns-${index}`}
                        max={60}
                        min={1}
                        name="spriteColumns"
                        onChange={(event) => updateSpriteRow(index, { columns: event.target.value })}
                        type="number"
                        value={row.columns}
                      />
                      <p className="mt-1 text-xs text-bc-muted">Frames per row.</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`sprite-rows-${index}`}>
                        Rows
                      </label>
                      <input
                        className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                        id={`sprite-rows-${index}`}
                        max={20}
                        min={1}
                        name="spriteRows"
                        onChange={(event) => updateSpriteRow(index, { rows: event.target.value })}
                        type="number"
                        value={row.rows}
                      />
                      <p className="mt-1 text-xs text-bc-muted">Sheet rows.</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`sprite-size-${index}`}>
                        Frame size
                      </label>
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        <input
                          className="min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-2 py-2 text-sm text-white"
                          id={`sprite-size-${index}`}
                          max={2000}
                          min={32}
                          name="spriteFrameWidth"
                          onChange={(event) => updateSpriteRow(index, { frameWidth: event.target.value })}
                          type="number"
                          value={row.frameWidth}
                        />
                        <input
                          className="min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-2 py-2 text-sm text-white"
                          max={2000}
                          min={32}
                          name="spriteFrameHeight"
                          onChange={(event) => updateSpriteRow(index, { frameHeight: event.target.value })}
                          type="number"
                          value={row.frameHeight}
                        />
                      </div>
                      <p className="mt-1 text-xs text-bc-muted">Width x height in pixels.</p>
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="bc-focus-ring inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-bc-line bg-bc-ink px-3 text-sm font-black text-white transition hover:border-bc-electric/60">
                        <ImageIcon className="h-4 w-4" aria-hidden="true" />
                        {uploadingSpriteIndex === index ? "Uploading" : "Upload"}
                        <input
                          accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                          className="sr-only"
                          disabled={uploadingSpriteIndex !== null}
                          onChange={(event) => void uploadSpriteSheet(index, event)}
                          type="file"
                        />
                      </label>
                      <label className="bc-focus-ring inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-bc-line bg-bc-ink px-3 text-sm font-black text-white transition hover:border-bc-electric/60">
                        <Volume2 className="h-4 w-4" aria-hidden="true" />
                        {uploadingSoundIndex === index ? "Uploading" : "Sound"}
                        <input
                          accept=".mp3,.wav,.ogg,.oga,.webm,.m4a,.aac,audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4,audio/aac"
                          className="sr-only"
                          disabled={uploadingSoundIndex !== null}
                          onChange={(event) => void uploadImpactSound(index, event)}
                          type="file"
                        />
                      </label>
                      <button
                        className="bc-focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-bc-pink/40 bg-bc-pink/10 px-3 text-sm font-black text-bc-pink transition hover:border-bc-pink"
                        onClick={() => removeSpriteRow(index)}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button disabled={pending} type="submit" variant="dark">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save throw settings
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-bc-line p-4">
          <div>
            <h3 className="text-xl font-black">Recent sheep throws</h3>
            <p className="mt-1 text-sm text-bc-muted">Targeted supporter throws, useful for moderation and support checks.</p>
          </div>
          <Badge tone={sheepSettings.enabled ? "amber" : "muted"}>{sheepSettings.enabled ? "Active" : "Disabled"}</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="text-bc-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Throw</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Room</th>
                <th className="px-4 py-3 font-semibold">Target message</th>
                <th className="px-4 py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {sheepThrows.map((sheepThrow) => (
                <tr className="border-t border-bc-line" key={sheepThrow.id}>
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Sparkles className="h-4 w-4 text-bc-amber" aria-hidden="true" />
                      <span className="font-semibold">{sheepThrow.throwerDisplayName}</span>
                      <span className="text-bc-muted">at</span>
                      <span className="font-semibold">{sheepThrow.targetDisplayName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="cyan">{sheepThrow.spriteId}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{sheepThrow.roomName}</p>
                    <p className="mt-1 text-xs text-bc-muted">#{sheepThrow.roomSlug}</p>
                  </td>
                  <td className="px-4 py-3">
                    {sheepThrow.targetMessageId ? (
                      <code className="rounded border border-bc-line bg-bc-ink px-2 py-1 text-xs text-bc-muted">
                        {sheepThrow.targetMessageId}
                      </code>
                    ) : (
                      <span className="text-bc-muted">No target message</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-bc-muted">{formatDate(sheepThrow.createdAt)}</td>
                </tr>
              ))}
              {!sheepThrows.length ? (
                <tr className="border-t border-bc-line">
                  <td className="px-4 py-8 text-center text-bc-muted" colSpan={5}>
                    No sheep throws have been recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4">
        {rooms.map((room) => (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={room.id}>
            <form action={formAction} className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_160px_140px_150px_150px_auto]">
              <input name="intent" type="hidden" value="update" />
              <input name="roomId" type="hidden" value={room.id} />
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`name-${room.id}`}>
                  Name
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                  defaultValue={room.name}
                  id={`name-${room.id}`}
                  name="name"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`slug-${room.id}`}>
                  Slug
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                  defaultValue={room.slug}
                  id={`slug-${room.id}`}
                  name="slug"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`type-${room.id}`}>
                  Type
                </label>
                <select
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                  defaultValue={room.type}
                  id={`type-${room.id}`}
                  name="type"
                >
                  {chatRoomTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`locked-${room.id}`}>
                  Status
                </label>
                <select
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                  defaultValue={room.lockedAt ? "true" : "false"}
                  id={`locked-${room.id}`}
                  name="locked"
                >
                  <option value="false">Unlocked</option>
                  <option value="true">Locked</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`slow-${room.id}`}>
                  Slow mode
                </label>
                <select
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                  defaultValue={String(room.slowModeSeconds)}
                  id={`slow-${room.id}`}
                  name="slowModeSeconds"
                >
                  {slowModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button disabled={pending} type="submit" variant="dark">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save
                </Button>
              </div>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={roomTone(room.type)}>{room.type}</Badge>
              <Badge tone="muted">#{room.slug}</Badge>
              <Badge className="gap-1" tone={room.lockedAt ? "pink" : "acid"}>
                <Lock className="h-3 w-3" aria-hidden="true" />
                {room.lockedAt ? "Locked" : "Unlocked"}
              </Badge>
              <Badge className="gap-1" tone={room.slowModeSeconds > 0 ? "amber" : "muted"}>
                <Timer className="h-3 w-3" aria-hidden="true" />
                {room.slowModeSeconds > 0 ? slowModeLabel(room.slowModeSeconds) : "No slow mode"}
              </Badge>
              <Badge tone="muted">{room.messages} messages</Badge>
            </div>
          </article>
        ))}
        {!rooms.length ? (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <MessageSquare className="h-7 w-7 text-bc-electric" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-black">No chat rooms yet</h3>
            <p className="mt-2 text-sm text-bc-muted">Use Ensure default to create live, lobby, and supporter rooms.</p>
          </article>
        ) : null}
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel">
        <div className="border-b border-bc-line p-4">
          <h3 className="text-xl font-black">Recent messages</h3>
          <p className="mt-1 text-sm text-bc-muted">Moderation queue for recent room messages.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="text-bc-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Author</th>
                <th className="px-4 py-3 font-semibold">Room</th>
                <th className="px-4 py-3 font-semibold">Message</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => (
                <tr className="border-t border-bc-line" key={message.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{message.authorDisplayName}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {visibleRoleBadges(message.authorRoles).map((role) => (
                        <Badge key={role} tone={roleBadgeTone(role)}>
                          {roleDisplayName(role, roleDisplayLabels)}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{message.roomName}</p>
                    <p className="mt-1 text-xs text-bc-muted">#{message.roomSlug}</p>
                  </td>
                  <td className={`max-w-[360px] px-4 py-3 ${message.deletedAt ? "text-bc-muted line-through" : "text-white"}`}>
                    {["gif", "sticker", "emoji"].includes(message.kind) && message.mediaPreviewUrl && !message.deletedAt ? (
                      <div>
                        <Badge tone={message.kind === "gif" ? "cyan" : "pink"}>{message.kind}</Badge>
                        <Image
                          alt={message.mediaAlt ?? message.body}
                          className="mt-2 h-auto max-h-28 w-auto rounded-md border border-bc-line object-contain"
                          height={imageSize().height}
                          src={message.mediaPreviewUrl}
                          unoptimized
                          width={imageSize().width}
                        />
                        <p className="mt-2 text-xs text-bc-muted">{message.mediaAlt ?? message.body}</p>
                      </div>
                    ) : (
                      message.body
                    )}
                  </td>
                  <td className="px-4 py-3 text-bc-muted">{formatDate(message.createdAt)}</td>
                  <td className="px-4 py-3">
                    <form action={formAction}>
                      <input name="intent" type="hidden" value="delete-message" />
                      <input name="messageId" type="hidden" value={message.id} />
                      <Button disabled={pending || Boolean(message.deletedAt)} size="sm" type="submit" variant="pink">
                        <ShieldOff className="h-4 w-4" aria-hidden="true" />
                        Hide
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
              {!messages.length ? (
                <tr className="border-t border-bc-line">
                  <td className="px-4 py-8 text-center text-bc-muted" colSpan={5}>
                    No chat messages have been sent yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
