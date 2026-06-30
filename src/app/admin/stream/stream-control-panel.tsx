"use client";

import { useActionState, useState } from "react";
import { Activity, Plus, Radio, Save, Share2, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { adminStreamAction } from "@/app/admin/stream/actions";
import {
  initialAdminStreamActionState,
  type AdminStreamActionState,
  type AdminRestreamSettingsRow,
  type AdminStreamChannelRow,
  type AdminStreamProfileRow,
  type AdminStreamProviderState
} from "@/app/admin/stream/state";
import { uploadAdminMedia } from "@/lib/media/admin-upload-client";
import { streamStatusOptions } from "@/lib/stream/stream-status";
import { restreamProviders } from "@/lib/stream/restream-settings";

type AdminStreamControlPanelProps = {
  channels: AdminStreamChannelRow[];
  provider: AdminStreamProviderState;
  repairFilter?: AdminStreamRepairFilter | null;
  restreamSettings: AdminRestreamSettingsRow;
  streamProfiles: AdminStreamProfileRow[];
};

type AdminStreamRepairFilter = "missing-offline-image";

function statusTone(status: string) {
  if (status === "live") {
    return "acid" as const;
  }

  if (status === "starting" || status === "degraded") {
    return "amber" as const;
  }

  return "muted" as const;
}

function profileOptionLabel(profile: AdminStreamProfileRow) {
  return `${profile.label} - ${profile.videoHeight}p${profile.fps} / ${profile.videoBitrateKbps} Kbps`;
}

function repairLabel() {
  return {
    detail: "Showing stream channels that need an offline image for the public player fallback.",
    title: "Missing offline image"
  };
}

function matchesRepairFilter(channel: AdminStreamChannelRow, filter: AdminStreamRepairFilter) {
  return filter === "missing-offline-image" && !channel.offlineImageUrl;
}

export function AdminStreamControlPanel({
  channels,
  provider,
  repairFilter = null,
  restreamSettings,
  streamProfiles
}: AdminStreamControlPanelProps) {
  const [state, formAction, pending] = useActionState<AdminStreamActionState, FormData>(
    adminStreamAction,
    initialAdminStreamActionState
  );
  const liveChannels = channels.filter((channel) => channel.status === "live").length;
  const enabledProfiles = streamProfiles.filter((profile) => profile.isEnabled);
  const visibleChannels = repairFilter ? channels.filter((channel) => matchesRepairFilter(channel, repairFilter)) : channels;
  const activeRepair = repairFilter ? repairLabel() : null;
  const [newOfflineImageUrl, setNewOfflineImageUrl] = useState("");
  const [offlineImageUrls, setOfflineImageUrls] = useState<Record<string, string>>(() =>
    Object.fromEntries(channels.map((channel) => [channel.id, channel.offlineImageUrl ?? ""]))
  );
  const [offlineUploading, setOfflineUploading] = useState<Record<string, boolean>>({});
  const [offlineUploadError, setOfflineUploadError] = useState("");

  async function uploadOfflineImage(key: string, file: File, onUrl: (url: string) => void) {
    setOfflineUploadError("");
    setOfflineUploading((current) => ({
      ...current,
      [key]: true
    }));

    try {
      onUrl(await uploadAdminMedia("stream-offline-image", file));
    } catch (error) {
      setOfflineUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setOfflineUploading((current) => ({
        ...current,
        [key]: false
      }));
    }
  }

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
          <div className="flex flex-wrap gap-2">
            <form action={formAction}>
              <input name="intent" type="hidden" value="ensure-default" />
              <Button disabled={pending} type="submit" variant="ghost">
                <Radio className="h-4 w-4" aria-hidden="true" />
                Ensure default
              </Button>
            </form>
            <form action={formAction}>
              <input name="intent" type="hidden" value="ensure-profiles" />
              <Button disabled={pending} type="submit" variant="ghost">
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Ensure profiles
              </Button>
            </form>
          </div>
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

        {offlineUploadError ? (
          <div className="mt-5 rounded-md border border-bc-pink/30 bg-bc-pink/10 p-3 text-sm text-bc-pink">
            {offlineUploadError}
          </div>
        ) : null}
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone={restreamSettings.enabled ? "acid" : "muted"}>
              {restreamSettings.enabled ? "Restream on" : "Restream off"}
            </Badge>
            <h3 className="mt-4 text-2xl font-black">External restream output</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Push the current primary DJ feed to one external RTMP/RTMPS destination. When DJ 1 disconnects, the outbound
              feed follows the promoted primary DJ.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="cyan">{restreamSettings.provider}</Badge>
            <Badge tone={restreamSettings.streamKeyConfigured ? "acid" : "amber"}>
              {restreamSettings.streamKeyConfigured ? "Key saved" : "No key"}
            </Badge>
            <Badge tone={restreamSettings.targetHost ? "muted" : "amber"}>
              {restreamSettings.targetHost ?? "No target"}
            </Badge>
          </div>
        </div>

        <form action={formAction} className="mt-5 grid gap-4 xl:grid-cols-[170px_1fr_1.5fr_1.5fr_auto]">
          <input name="intent" type="hidden" value="update-restream" />
          <label className="text-xs font-semibold uppercase text-bc-muted">
            Provider
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              defaultValue={restreamSettings.provider}
              name="provider"
            >
              {restreamProviders.map((providerOption) => (
                <option key={providerOption} value={providerOption}>
                  {providerOption === "youtube" ? "YouTube Live" : providerOption === "facebook" ? "Facebook Live" : "Custom"}
                </option>
              ))}
            </select>
            <span className="mt-1 block normal-case text-bc-muted">Destination preset label.</span>
          </label>
          <label className="text-xs font-semibold uppercase text-bc-muted">
            Display label
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              defaultValue={restreamSettings.label}
              name="label"
              placeholder="Main YouTube feed"
            />
            <span className="mt-1 block normal-case text-bc-muted">Shown only in admin logs and status.</span>
          </label>
          <label className="text-xs font-semibold uppercase text-bc-muted">
            RTMP server URL
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              defaultValue={restreamSettings.serverUrl}
              name="serverUrl"
              placeholder="rtmps://live-api-s.facebook.com:443/rtmp/"
            />
            <span className="mt-1 block normal-case text-bc-muted">Use a public RTMP or RTMPS ingest host.</span>
          </label>
          <label className="text-xs font-semibold uppercase text-bc-muted">
            Stream key
            <input
              autoComplete="off"
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              name="streamKey"
              placeholder={restreamSettings.streamKeyConfigured ? "Saved - leave blank to keep" : "Paste stream key"}
              type="password"
            />
            <span className="mt-1 block normal-case text-bc-muted">Stored as a secret app setting.</span>
          </label>
          <div className="flex flex-col justify-end gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-bc-muted">
              <input defaultChecked={restreamSettings.enabled} name="enabled" type="checkbox" />
              Enabled
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-bc-muted">
              <input name="clearStreamKey" type="checkbox" />
              Clear key
            </label>
            <Button disabled={pending} type="submit" variant="primary">
              <Share2 className="h-4 w-4" aria-hidden="true" />
              Save
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <Badge tone="cyan">New channel</Badge>
        <form
          action={formAction}
          className="mt-4 grid gap-3 lg:grid-cols-[1fr_160px_150px_1fr_minmax(220px,1.2fr)_220px_auto]"
        >
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
          <div>
            <input
              className="min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              name="offlineImageUrl"
              onChange={(event) => setNewOfflineImageUrl(event.currentTarget.value)}
              placeholder="Offline image URL"
              value={newOfflineImageUrl}
            />
            <input
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-xs text-white file:mr-3 file:rounded file:border-0 file:bg-bc-electric file:px-3 file:py-1 file:text-xs file:font-semibold file:text-bc-void"
              disabled={pending || offlineUploading.create}
              onChange={async (event) => {
                const input = event.currentTarget;
                const file = input.files?.[0];

                if (!file) {
                  return;
                }

                await uploadOfflineImage("create", file, setNewOfflineImageUrl);
                input.value = "";
              }}
              type="file"
            />
          </div>
          <select
            className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
            name="streamProfileId"
            required
          >
            {enabledProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profileOptionLabel(profile)}
              </option>
            ))}
          </select>
          <Button disabled={pending || offlineUploading.create} type="submit" variant="primary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create
          </Button>
        </form>
      </section>

      {activeRepair ? (
        <section className="rounded-md border border-bc-acid/35 bg-bc-acid/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge tone="acid">Repair filter</Badge>
              <h3 className="mt-2 text-xl font-black">{activeRepair.title}</h3>
              <p className="mt-1 text-sm text-bc-muted">
                {activeRepair.detail} Showing {visibleChannels.length.toLocaleString("en-GB")} of{" "}
                {channels.length.toLocaleString("en-GB")} channels.
              </p>
            </div>
            <ButtonLink href="/admin/stream" size="sm" variant="ghost">
              Clear filter
            </ButtonLink>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4">
        {visibleChannels.map((channel) => (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={channel.id}>
            <form
              action={formAction}
              className="grid gap-4 xl:grid-cols-[1fr_160px_150px_1fr_1fr_220px_auto]"
            >
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
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`offline-image-${channel.id}`}>
                  Offline image
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                  id={`offline-image-${channel.id}`}
                  name="offlineImageUrl"
                  onChange={(event) =>
                    setOfflineImageUrls((current) => ({
                      ...current,
                      [channel.id]: event.currentTarget.value
                    }))
                  }
                  placeholder="https://.../offline.jpg or uploaded file path"
                  type="text"
                  value={offlineImageUrls[channel.id] ?? channel.offlineImageUrl ?? ""}
                />
                <input
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-bc-electric file:px-3 file:py-1 file:text-sm file:font-semibold file:text-bc-void"
                  disabled={pending || offlineUploading[channel.id]}
                  id={`offline-image-file-${channel.id}`}
                  onChange={async (event) => {
                    const input = event.currentTarget;
                    const file = input.files?.[0];

                    if (!file) {
                      return;
                    }

                    await uploadOfflineImage(channel.id, file, (url) =>
                      setOfflineImageUrls((current) => ({
                        ...current,
                        [channel.id]: url
                      }))
                    );
                    input.value = "";
                  }}
                  type="file"
                />
                <p className="mt-1 text-xs text-bc-muted">Landscape image, ideally 1920 x 1080.</p>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`profile-${channel.id}`}>
                  Profile
                </label>
                <select
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                  defaultValue={channel.streamProfile?.id ?? enabledProfiles[0]?.id ?? ""}
                  id={`profile-${channel.id}`}
                  name="streamProfileId"
                  required
                >
                  {enabledProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profileOptionLabel(profile)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button disabled={pending || offlineUploading[channel.id]} type="submit" variant="dark">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save
                </Button>
              </div>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={statusTone(channel.status)}>{channel.status}</Badge>
              <Badge tone="cyan">{channel.streamProfile ? profileOptionLabel(channel.streamProfile) : "No profile"}</Badge>
              <Badge tone="muted">{channel.streamKeys} keys</Badge>
              <Badge tone="muted">{channel.sessions} sessions</Badge>
              <Badge tone="muted">{channel.events} events</Badge>
            </div>
          </article>
        ))}
        {!visibleChannels.length ? (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <Activity className="h-7 w-7 text-bc-electric" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-black">
              {activeRepair ? "No channels match this repair filter" : "No channels yet"}
            </h3>
            <p className="mt-2 text-sm text-bc-muted">
              {activeRepair
                ? "This repair category is currently clean."
                : "Use Ensure default to create the main Bouncecore Live channel."}
            </p>
          </article>
        ) : null}
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-bc-electric" aria-hidden="true" />
          <h3 className="text-xl font-black">Stream profiles</h3>
        </div>
        <div className="mt-5 grid gap-4">
          {streamProfiles.map((profile) => (
            <form
              action={formAction}
              className="rounded-md border border-bc-line bg-bc-ink p-4"
              key={profile.id}
            >
              <input name="intent" type="hidden" value="update-profile" />
              <input name="profileId" type="hidden" value={profile.id} />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={profile.isEnabled ? "acid" : "muted"}>{profile.isEnabled ? "Enabled" : "Disabled"}</Badge>
                    {profile.isDefault ? <Badge tone="pink">Default</Badge> : null}
                    <Badge tone="cyan">{profile.key}</Badge>
                  </div>
                  <p className="mt-3 text-lg font-black">{profileOptionLabel(profile)}</p>
                </div>
                <Button disabled={pending} type="submit" variant="dark">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save
                </Button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-xs font-semibold uppercase text-bc-muted">
                  Label
                  <input
                    className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={profile.label}
                    name="label"
                    required
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-bc-muted">
                  Sort
                  <input
                    className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={profile.sortOrder}
                    min={0}
                    name="sortOrder"
                    type="number"
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-bc-muted">
                  Width
                  <input
                    className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={profile.videoWidth}
                    min={320}
                    name="videoWidth"
                    type="number"
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-bc-muted">
                  Height
                  <input
                    className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={profile.videoHeight}
                    min={180}
                    name="videoHeight"
                    type="number"
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-bc-muted">
                  Video Kbps
                  <input
                    className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={profile.videoBitrateKbps}
                    min={250}
                    name="videoBitrateKbps"
                    type="number"
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-bc-muted">
                  Audio Kbps
                  <input
                    className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={profile.audioBitrateKbps}
                    min={64}
                    name="audioBitrateKbps"
                    type="number"
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-bc-muted">
                  FPS
                  <input
                    className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={profile.fps}
                    min={15}
                    name="fps"
                    type="number"
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-bc-muted">
                  Keyframe seconds
                  <input
                    className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={profile.keyframeSeconds}
                    min={1}
                    name="keyframeSeconds"
                    type="number"
                  />
                </label>
              </div>

              <label className="mt-3 block text-xs font-semibold uppercase text-bc-muted">
                Description
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={profile.description ?? ""}
                  name="description"
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2 text-bc-muted">
                  <input defaultChecked={profile.isEnabled} name="isEnabled" type="checkbox" />
                  Enabled
                </label>
                <label className="inline-flex items-center gap-2 text-bc-muted">
                  <input defaultChecked={profile.isDefault} name="isDefault" type="checkbox" />
                  Default
                </label>
              </div>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
