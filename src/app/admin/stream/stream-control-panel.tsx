"use client";

import { useActionState } from "react";
import { Activity, Plus, Radio, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { adminStreamAction } from "@/app/admin/stream/actions";
import {
  initialAdminStreamActionState,
  type AdminStreamActionState,
  type AdminStreamChannelRow,
  type AdminStreamProviderState
} from "@/app/admin/stream/state";
import { streamStatusOptions } from "@/lib/stream/stream-status";

type AdminStreamControlPanelProps = {
  channels: AdminStreamChannelRow[];
  provider: AdminStreamProviderState;
};

function statusTone(status: string) {
  if (status === "live") {
    return "acid" as const;
  }

  if (status === "starting" || status === "degraded") {
    return "amber" as const;
  }

  return "muted" as const;
}

export function AdminStreamControlPanel({ channels, provider }: AdminStreamControlPanelProps) {
  const [state, formAction, pending] = useActionState<AdminStreamActionState, FormData>(
    adminStreamAction,
    initialAdminStreamActionState
  );
  const liveChannels = channels.filter((channel) => channel.status === "live").length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Channels</Badge>
          <p className="mt-4 text-3xl font-black">{channels.length}</p>
          <p className="mt-2 text-sm text-bc-muted">Database-backed stream channels.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={liveChannels ? "acid" : "muted"}>Live</Badge>
          <p className="mt-4 text-3xl font-black">{liveChannels}</p>
          <p className="mt-2 text-sm text-bc-muted">Channels marked live in Bouncecore.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={provider.health.status === "healthy" ? "acid" : "amber"}>{provider.health.status}</Badge>
          <p className="mt-4 text-3xl font-black">{provider.viewerCount}</p>
          <p className="mt-2 text-sm text-bc-muted">Provider viewers via stream boundary.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Channel setup</Badge>
            <h3 className="mt-4 text-2xl font-black">Stream control</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Create channels, set live/offline state, and control the playback URL that public pages can use.
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
        <Badge tone="cyan">New channel</Badge>
        <form action={formAction} className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px_170px_1fr_auto]">
          <input name="intent" type="hidden" value="create" />
          <input
            className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
            name="title"
            placeholder="Channel title"
            required
          />
          <input
            className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
            name="slug"
            placeholder="slug"
            required
          />
          <select className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white" name="status">
            {streamStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <input
            className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
            name="playbackUrl"
            placeholder="https://.../live.m3u8"
          />
          <Button disabled={pending} type="submit" variant="primary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create
          </Button>
        </form>
      </section>

      <div className="grid gap-4">
        {channels.map((channel) => (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={channel.id}>
            <form action={formAction} className="grid gap-4 xl:grid-cols-[1fr_170px_170px_1fr_auto]">
              <input name="intent" type="hidden" value="update" />
              <input name="channelId" type="hidden" value={channel.id} />
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`title-${channel.id}`}>
                  Title
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                  defaultValue={channel.title}
                  id={`title-${channel.id}`}
                  name="title"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`slug-${channel.id}`}>
                  Slug
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                  defaultValue={channel.slug}
                  id={`slug-${channel.id}`}
                  name="slug"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`status-${channel.id}`}>
                  Status
                </label>
                <select
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                  defaultValue={channel.status}
                  id={`status-${channel.id}`}
                  name="status"
                >
                  {streamStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`playback-${channel.id}`}>
                  Playback URL
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                  defaultValue={channel.playbackUrl ?? ""}
                  id={`playback-${channel.id}`}
                  name="playbackUrl"
                  placeholder="https://.../live.m3u8"
                />
              </div>
              <div className="flex items-end">
                <Button disabled={pending} type="submit" variant="dark">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save
                </Button>
              </div>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={statusTone(channel.status)}>{channel.status}</Badge>
              <Badge tone="muted">{channel.streamKeys} keys</Badge>
              <Badge tone="muted">{channel.sessions} sessions</Badge>
              <Badge tone="muted">{channel.events} events</Badge>
            </div>
          </article>
        ))}
        {!channels.length ? (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <Activity className="h-7 w-7 text-bc-electric" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-black">No channels yet</h3>
            <p className="mt-2 text-sm text-bc-muted">Use Ensure default to create the main Bouncecore Live channel.</p>
          </article>
        ) : null}
      </div>
    </div>
  );
}
