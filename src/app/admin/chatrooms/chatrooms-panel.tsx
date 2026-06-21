"use client";

import Image from "next/image";
import { useActionState } from "react";
import { Lock, MessageSquare, Plus, Radio, Save, ShieldOff, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { adminChatroomsAction } from "@/app/admin/chatrooms/actions";
import { roleBadgeTone, roleDisplayName, type RoleDisplayNameMap } from "@/lib/auth/role-display";
import type { SheepThrowSettings } from "@/lib/chat/sheep-throw-settings";
import {
  initialAdminChatroomsActionState,
  type AdminChatMessageRow,
  type AdminChatRoomRow,
  type AdminChatroomsActionState
} from "@/app/admin/chatrooms/state";
import { chatRoomTypeOptions } from "@/lib/chat/chat-types";

type AdminChatroomsPanelProps = {
  rooms: AdminChatRoomRow[];
  messages: AdminChatMessageRow[];
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

export function AdminChatroomsPanel({ rooms, messages, roleDisplayLabels, sheepSettings }: AdminChatroomsPanelProps) {
  const [state, formAction, pending] = useActionState<AdminChatroomsActionState, FormData>(
    adminChatroomsAction,
    initialAdminChatroomsActionState
  );
  const visibleMessages = messages.filter((message) => !message.deletedAt).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
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
            <Badge tone="acid">Chat fun</Badge>
            <h3 className="mt-4 text-2xl font-black">Sheep throw overlay</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Let supporters trigger the sheep overlay from chat. The cooldown is enforced per user and the overlay queue is targeted.
            </p>
          </div>
          <Badge tone={sheepSettings.enabled ? "acid" : "muted"}>{sheepSettings.enabled ? "Enabled" : "Disabled"}</Badge>
        </div>
        <form action={formAction} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[150px_repeat(5,minmax(140px,1fr))_auto]">
          <input name="intent" type="hidden" value="sheep-settings" />
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
            <p className="mt-1 text-xs text-bc-muted">How long each targeted sheep throw stays on screen.</p>
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
            <p className="mt-1 text-xs text-bc-muted">How often viewers check for sheep throws targeted at them.</p>
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
          <div className="flex items-end">
            <Button disabled={pending} type="submit" variant="dark">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save
            </Button>
          </div>
        </form>
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
                      {message.authorRoles.map((role) => (
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
