"use client";

import { useActionState, useState } from "react";
import { Activity, Plus, Radio, Save, Share2, SlidersHorizontal, TvMinimalPlay, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { adminStreamAction } from "@/app/admin/stream/actions";
import {
  initialAdminStreamActionState,
  type AdminStreamActionState,
  type AdminFacebookOAuthCredentialsRow,
  type AdminRestreamSettingsRow,
  type AdminStreamChannelRow,
  type AdminStreamPlaybackSettingsRow,
  type AdminStreamProfileRow,
  type AdminStreamProviderState,
  type AdminYouTubeOAuthCredentialsRow
} from "@/app/admin/stream/state";
import { uploadAdminMedia } from "@/lib/media/admin-upload-client";
import { streamStatusOptions } from "@/lib/stream/stream-status";
import { streamPlaybackBufferLimits } from "@/lib/stream/stream-playback-settings";

type AdminStreamControlPanelProps = {
  channels: AdminStreamChannelRow[];
  facebookNotice?: { message: string; status: "success" | "error" } | null;
  facebookOAuthCredentials: AdminFacebookOAuthCredentialsRow;
  playbackSettings: AdminStreamPlaybackSettingsRow;
  provider: AdminStreamProviderState;
  repairFilter?: AdminStreamRepairFilter | null;
  restreamSettings: AdminRestreamSettingsRow[];
  streamProfiles: AdminStreamProfileRow[];
  youtubeNotice?: { message: string; status: "success" | "error" } | null;
  youtubeOAuthCredentials: AdminYouTubeOAuthCredentialsRow;
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
  facebookNotice = null,
  facebookOAuthCredentials,
  playbackSettings,
  provider,
  repairFilter = null,
  restreamSettings,
  streamProfiles,
  youtubeNotice = null,
  youtubeOAuthCredentials
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
        <Badge tone={restreamSettings.some((target) => target.enabled) ? "acid" : "muted"}>
          {restreamSettings.filter((target) => target.enabled).length} of 2 outputs enabled
        </Badge>
        <h3 className="mt-4 text-2xl font-black">External restream outputs</h3>
        <p className="mt-2 max-w-3xl text-sm text-bc-muted">
          Send the current primary DJ feed to two independent YouTube, Facebook, or custom RTMP/RTMPS destinations. Each
          output runs separately, so a failure or configuration change on one does not stop the other.
        </p>

        {youtubeNotice ? (
          <div
            className={`mt-4 rounded-md border p-3 text-sm ${
              youtubeNotice.status === "success"
                ? "border-bc-acid/30 bg-bc-acid/10 text-bc-acid"
                : "border-bc-pink/30 bg-bc-pink/10 text-bc-pink"
            }`}
            role={youtubeNotice.status === "error" ? "alert" : "status"}
          >
            {youtubeNotice.message}
          </div>
        ) : null}

        {facebookNotice ? (
          <div
            className={`mt-4 rounded-md border p-3 text-sm ${
              facebookNotice.status === "success"
                ? "border-bc-acid/30 bg-bc-acid/10 text-bc-acid"
                : "border-bc-pink/30 bg-bc-pink/10 text-bc-pink"
            }`}
            role={facebookNotice.status === "error" ? "alert" : "status"}
          >
            {facebookNotice.message}
          </div>
        ) : null}

        <div className="mt-5 border-y border-bc-line bg-bc-ink/45 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <TvMinimalPlay className="h-5 w-5 text-red-400" aria-hidden="true" />
                <h4 className="font-black">YouTube public auto-start</h4>
              </div>
              <p className="mt-1 max-w-3xl text-sm text-bc-muted">
                OAuth lets Bouncecore create a public broadcast, bind the saved YouTube stream key, and start it when the primary DJ connects.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={youtubeOAuthCredentials.configured ? "acid" : "amber"}>
                OAuth {youtubeOAuthCredentials.configured ? "ready" : "setup needed"}
              </Badge>
              <Badge tone="muted">Source: {youtubeOAuthCredentials.source}</Badge>
            </div>
          </div>

          <form action={formAction} className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <input name="intent" type="hidden" value="update-youtube-oauth" />
            <label className="text-xs font-semibold uppercase text-bc-muted">
              Google OAuth client ID
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                defaultValue={youtubeOAuthCredentials.clientId}
                name="clientId"
                placeholder="Google OAuth web client ID"
              />
              <span className="mt-1 block normal-case text-bc-muted">Use a Web application client with YouTube Data API v3 enabled.</span>
            </label>
            <label className="text-xs font-semibold uppercase text-bc-muted">
              Google OAuth client secret
              <input
                autoComplete="off"
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                name="clientSecret"
                placeholder={youtubeOAuthCredentials.clientSecretConfigured ? "Saved - leave blank to keep" : "Paste OAuth client secret"}
                type="password"
              />
              <span className="mt-1 block normal-case text-bc-muted">Encrypted before storage and never shown again.</span>
            </label>
            <div className="flex flex-col justify-end gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-bc-muted">
                <input name="clearClientSecret" type="checkbox" />
                Clear secret
              </label>
              <Button disabled={pending} type="submit" variant="ghost">
                <Save className="h-4 w-4" aria-hidden="true" />
                Save OAuth
              </Button>
            </div>
          </form>

          <p className="mt-3 break-all text-xs text-bc-muted">
            Authorized redirect URI: <code className="text-bc-electric">{youtubeOAuthCredentials.redirectUri ?? "Set NEXT_PUBLIC_APP_URL first"}</code>
          </p>
        </div>

        <div className="mt-5 border-y border-bc-line bg-bc-ink/45 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-blue-400" aria-hidden="true" />
                <h4 className="font-black">Facebook Page auto-live</h4>
              </div>
              <p className="mt-1 max-w-3xl text-sm text-bc-muted">
                OAuth lets a Page administrator connect the destination. Bouncecore then creates the Facebook Live post,
                relays over the generated secure RTMPS URL, and ends it when the local stream disconnects.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={facebookOAuthCredentials.configured ? "acid" : "amber"}>
                OAuth {facebookOAuthCredentials.configured ? "ready" : "setup needed"}
              </Badge>
              <Badge tone="muted">Source: {facebookOAuthCredentials.source}</Badge>
            </div>
          </div>

          <form action={formAction} className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <input name="intent" type="hidden" value="update-facebook-oauth" />
            <label className="text-xs font-semibold uppercase text-bc-muted">
              Meta app ID
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                defaultValue={facebookOAuthCredentials.appId}
                name="appId"
                placeholder="Meta app ID"
              />
              <span className="mt-1 block normal-case text-bc-muted">Use a Meta app with Facebook Login and Live Video API access.</span>
            </label>
            <label className="text-xs font-semibold uppercase text-bc-muted">
              Meta app secret
              <input
                autoComplete="off"
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                name="appSecret"
                placeholder={facebookOAuthCredentials.appSecretConfigured ? "Saved - leave blank to keep" : "Paste Meta app secret"}
                type="password"
              />
              <span className="mt-1 block normal-case text-bc-muted">Encrypted before storage and never shown again.</span>
            </label>
            <div className="flex flex-col justify-end gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-bc-muted">
                <input name="clearAppSecret" type="checkbox" />
                Clear secret
              </label>
              <Button disabled={pending} type="submit" variant="ghost">
                <Save className="h-4 w-4" aria-hidden="true" />
                Save Meta OAuth
              </Button>
            </div>
          </form>

          <p className="mt-3 break-all text-xs text-bc-muted">
            Valid OAuth redirect URI: <code className="text-bc-electric">{facebookOAuthCredentials.redirectUri ?? "Set NEXT_PUBLIC_APP_URL first"}</code>
          </p>
          <p className="mt-1 text-xs text-bc-muted">
            The Facebook account used during Connect must administer the destination Page; it does not need to be the site owner&apos;s Facebook account.
          </p>
        </div>

        <div className="mt-5 divide-y divide-bc-line border-y border-bc-line">
          {restreamSettings.map((target, index) => (
            <div className="py-5" key={target.slot}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-lg font-black">
                    Destination {index + 1}: {target.slot === "primary" ? "YouTube" : "Facebook"}
                  </h4>
                  <Badge tone={target.enabled ? "acid" : "muted"}>{target.enabled ? "Enabled" : "Disabled"}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="cyan">{target.slot === "primary" ? "YouTube Live" : "Facebook Live"}</Badge>
                  {target.slot === "primary" ? (
                    <>
                      <Badge tone={target.streamKeyConfigured ? "acid" : "amber"}>
                        {target.streamKeyConfigured ? "YouTube key saved" : "No YouTube key"}
                      </Badge>
                      <Badge tone={target.targetHost ? "muted" : "amber"}>{target.targetHost ?? "No target"}</Badge>
                    </>
                  ) : null}
                  {target.slot === "primary" ? (
                    <Badge tone={target.youtubeConnection.connected ? "acid" : "amber"}>
                      {target.youtubeConnection.connected
                        ? `Connected: ${target.youtubeConnection.channelTitle}`
                        : "YouTube not connected"}
                    </Badge>
                  ) : null}
                  {target.slot === "secondary" ? (
                    <Badge tone={target.facebookConnection.connected ? "acid" : "amber"}>
                      {target.facebookConnection.connected
                        ? `Connected: ${target.facebookConnection.pageName}`
                        : "Facebook Page not connected"}
                    </Badge>
                  ) : null}
                </div>
              </div>

              {target.slot === "primary" ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink p-3">
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-white">
                      {target.youtubeConnection.connected
                        ? `Public auto-start uses ${target.youtubeConnection.channelTitle}.`
                        : "Connect the YouTube channel used by this destination."}
                    </p>
                    <p className="mt-1 text-xs text-bc-muted">
                      {target.youtubeConnection.lastError
                        ? `Last automation error: ${target.youtubeConnection.lastError}`
                        : target.youtubeConnection.lastBroadcastId
                          ? `Last broadcast ${target.youtubeConnection.lastBroadcastId} (${target.youtubeConnection.runtimeStatus}).`
                          : "A new public broadcast is created once per Bouncecore live session."}
                    </p>
                  </div>
                  {target.youtubeConnection.connected ? (
                    <form action={formAction}>
                      <input name="intent" type="hidden" value="disconnect-youtube" />
                      <input name="targetSlot" type="hidden" value={target.slot} />
                      <Button disabled={pending} type="submit" variant="ghost">
                        <Unplug className="h-4 w-4" aria-hidden="true" />
                        Disconnect
                      </Button>
                    </form>
                  ) : (
                    <ButtonLink
                      href={`/admin/stream/youtube/connect?slot=${target.slot}`}
                      size="sm"
                      variant={youtubeOAuthCredentials.configured ? "primary" : "ghost"}
                    >
                      <TvMinimalPlay className="h-4 w-4" aria-hidden="true" />
                      Connect YouTube
                    </ButtonLink>
                  )}
                </div>
              ) : null}

              {target.slot === "secondary" ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink p-3">
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-white">
                      {target.facebookConnection.connected
                        ? `Automatic live posts use ${target.facebookConnection.pageName}.`
                        : "Save the destination Page ID, then connect a Page administrator."}
                    </p>
                    <p className="mt-1 text-xs text-bc-muted">
                      {target.facebookConnection.lastError
                        ? `Last automation error: ${target.facebookConnection.lastError}`
                        : target.facebookConnection.lastLiveVideoId
                          ? `Last live video ${target.facebookConnection.lastLiveVideoId} (${target.facebookConnection.runtimeStatus}).`
                          : "A new LIVE_NOW Page post and secure RTMPS target are created once per Bouncecore live session."}
                    </p>
                  </div>
                  {target.facebookConnection.connected ? (
                    <form action={formAction}>
                      <input name="intent" type="hidden" value="disconnect-facebook" />
                      <input name="targetSlot" type="hidden" value={target.slot} />
                      <Button disabled={pending} type="submit" variant="ghost">
                        <Unplug className="h-4 w-4" aria-hidden="true" />
                        Disconnect
                      </Button>
                    </form>
                  ) : (
                    <ButtonLink
                      href={`/admin/stream/facebook/connect?slot=${target.slot}`}
                      size="sm"
                      variant={facebookOAuthCredentials.configured ? "primary" : "ghost"}
                    >
                      <Radio className="h-4 w-4" aria-hidden="true" />
                      Connect Facebook Page
                    </ButtonLink>
                  )}
                </div>
              ) : null}

              <form action={formAction} className="mt-4 space-y-4">
                <input name="intent" type="hidden" value="update-restream" />
                <input name="targetSlot" type="hidden" value={target.slot} />
                <input
                  name="label"
                  type="hidden"
                  value={target.label || (target.slot === "primary" ? "YouTube" : "Facebook")}
                />
                <input name="provider" type="hidden" value={target.slot === "primary" ? "youtube" : "facebook"} />

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="text-xs font-semibold uppercase text-bc-muted">
                    Live title
                    <input
                      className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                      defaultValue={target.broadcastTitle}
                      maxLength={100}
                      name="broadcastTitle"
                      placeholder={target.slot === "primary" ? "Bouncecore Live on YouTube" : "Bouncecore Live on Facebook"}
                    />
                    <span className="mt-1 block normal-case text-bc-muted">
                      Used for the new {target.slot === "primary" ? "YouTube broadcast" : "Facebook Page live post"}. Leave blank for the automatic stream title.
                    </span>
                  </label>
                  <label className="text-xs font-semibold uppercase text-bc-muted">
                    Live description
                    <textarea
                      className="mt-2 min-h-24 w-full resize-y rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                      defaultValue={target.broadcastDescription}
                      maxLength={5000}
                      name="broadcastDescription"
                      placeholder="Describe the live show for viewers."
                    />
                    <span className="mt-1 block normal-case text-bc-muted">
                      Published with this destination&apos;s new live broadcast. Leave blank for the Bouncecore default.
                    </span>
                  </label>
                </div>

                {target.slot === "primary" ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="text-xs font-semibold uppercase text-bc-muted">
                      YouTube RTMPS server URL
                      <input
                        className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                        defaultValue={target.serverUrl}
                        name="serverUrl"
                        placeholder="rtmps://a.rtmps.youtube.com/live2"
                      />
                      <span className="mt-1 block normal-case text-bc-muted">The YouTube Live server URL paired with the saved key.</span>
                    </label>
                    <label className="text-xs font-semibold uppercase text-bc-muted">
                      YouTube stream key
                      <input
                        autoComplete="off"
                        className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                        name="streamKey"
                        placeholder={target.streamKeyConfigured ? "Saved and active - leave blank to keep" : "Paste YouTube stream key"}
                        type="password"
                      />
                      <span className="mt-1 block normal-case text-bc-muted">
                        Leaving this blank keeps the currently saved key. It is never displayed after saving.
                      </span>
                    </label>
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <input name="serverUrl" type="hidden" value={target.serverUrl} />
                    <label className="text-xs font-semibold uppercase text-bc-muted">
                      Facebook Page ID
                      <input
                        className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                        defaultValue={target.facebookPageId}
                        inputMode="numeric"
                        name="facebookPageId"
                        placeholder="Facebook Page ID"
                      />
                      <span className="mt-1 block normal-case text-bc-muted">The Page authorized by the Facebook connection above.</span>
                    </label>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-4">
                  <label className="inline-flex items-center gap-2 text-sm text-bc-muted">
                    <input defaultChecked={target.enabled} name="enabled" type="checkbox" />
                    Enable {target.slot === "primary" ? "YouTube" : "Facebook"} destination
                  </label>
                  {target.slot === "primary" ? (
                    <label className="inline-flex items-center gap-2 text-sm text-bc-muted">
                      <input name="clearStreamKey" type="checkbox" />
                      Clear YouTube key
                    </label>
                  ) : null}
                  <Button disabled={pending} type="submit" variant="primary">
                    <Share2 className="h-4 w-4" aria-hidden="true" />
                    Save {target.slot === "primary" ? "YouTube" : "Facebook"}
                  </Button>
                </div>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="cyan">Player settings</Badge>
            <h3 className="mt-4 text-2xl font-black">Live player and page</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Set the player startup buffer and choose whether the public live page shows the upcoming schedule.
            </p>
          </div>
          <Badge tone="acid">{playbackSettings.playbackBufferSeconds}s behind live</Badge>
        </div>

        <form action={formAction} className="mt-5 grid gap-4 lg:grid-cols-[minmax(180px,260px)_minmax(260px,1fr)_auto]">
          <input name="intent" type="hidden" value="update-playback-settings" />
          <label className="text-xs font-semibold uppercase text-bc-muted">
            Buffer seconds
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              defaultValue={playbackSettings.playbackBufferSeconds}
              max={streamPlaybackBufferLimits.max}
              min={streamPlaybackBufferLimits.min}
              name="playbackBufferSeconds"
              step={1}
              type="number"
            />
            <span className="mt-1 block normal-case text-bc-muted">
              Allowed range: {streamPlaybackBufferLimits.min}-{streamPlaybackBufferLimits.max} seconds.
            </span>
          </label>
          <div className="grid gap-3">
            <div className="rounded-md border border-bc-line bg-bc-ink p-3 text-sm text-bc-muted">
              Start around 4 seconds for normal live shows. Use 6-10 seconds if viewers report stalls, or 1-2 seconds when
              low latency matters more than buffering.
            </div>
            <label className="flex items-start gap-3 rounded-md border border-bc-line bg-bc-ink p-3 text-sm text-white">
              <input
                className="mt-0.5 h-4 w-4 accent-bc-electric"
                defaultChecked={playbackSettings.showUpcomingSets}
                name="showUpcomingSets"
                type="checkbox"
              />
              <span>
                <span className="block font-semibold">Show Upcoming Sets on the live page</span>
                <span className="mt-1 block text-xs text-bc-muted">
                  Disabled by default. Turn this on when you want the schedule card visible below the player.
                </span>
              </span>
            </label>
          </div>
          <div className="flex items-end">
            <Button disabled={pending} type="submit" variant="primary">
              <Save className="h-4 w-4" aria-hidden="true" />
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
