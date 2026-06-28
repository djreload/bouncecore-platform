import {
  CalendarClock,
  ExternalLink,
  Globe2,
  Link2,
  MessageCircle,
  Music,
  Radio,
  Share2,
  UserRound,
  Video
} from "lucide-react";
import { ChatRoomPanel } from "@/app/chat/chat-room-panel";
import { LivePlaybackPlayer } from "@/app/live/live-playback-player";
import { StarSupportLeaderboard } from "@/app/live/star-support-panel";
import type { PublicChatAssetRow, PublicChatMessageRow, PublicChatPresenceUserRow, PublicChatRoomRow } from "@/app/chat/state";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { roleBadgeTone, roleDisplayName } from "@/lib/auth/role-display";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicChatData } from "@/lib/chat/chat-service";
import { getChatSheepThrowReadiness, getSheepThrowSettings } from "@/lib/chat/sheep-throw-service";
import { getPublicSiteSettings, type LiveSocialLink } from "@/lib/admin/site-settings-service";
import { getPublicLiveState } from "@/lib/stream/stream-channel-service";
import { getPublicUpcomingStreamSchedules } from "@/lib/stream/stream-schedule-service";
import { getLiveStarSupportData, getStarWalletBalance } from "@/lib/stars/star-send-service";

export const dynamic = "force-dynamic";

function formatScheduleDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function scheduleTone(status: string) {
  return status === "live" ? ("acid" as const) : ("cyan" as const);
}

function socialIcon(platform: string) {
  const key = platform.toLowerCase();

  if (["youtube", "twitch", "kick", "video", "tv"].some((value) => key.includes(value))) {
    return Video;
  }

  if (["instagram", "tiktok", "soundcloud", "mixcloud", "music"].some((value) => key.includes(value))) {
    return Music;
  }

  if (["discord", "facebook", "messenger", "chat"].some((value) => key.includes(value))) {
    return MessageCircle;
  }

  if (["radio", "live", "stream"].some((value) => key.includes(value))) {
    return Radio;
  }

  if (["web", "site", "home"].some((value) => key.includes(value))) {
    return Globe2;
  }

  return Link2;
}

function LiveSocialLinks({ links }: { links: LiveSocialLink[] }) {
  const enabledLinks = links.filter((link) => link.enabled);

  return (
    <section className="mt-3 rounded-md border border-bc-line bg-bc-panel/90 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-bc-electric" aria-hidden="true" />
          <h2 className="text-sm font-black uppercase">Follow the stream</h2>
        </div>
        <Badge tone={enabledLinks.length ? "cyan" : "muted"}>{enabledLinks.length ? `${enabledLinks.length} links` : "Not configured"}</Badge>
      </div>
      {enabledLinks.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {enabledLinks.map((link) => {
            const Icon = socialIcon(link.platform);

            return (
              <a
                className="bc-focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-bc-line bg-bc-ink px-3 text-sm font-semibold text-white transition hover:border-bc-electric/60 hover:bg-bc-electric/10"
                href={link.url}
                key={`${link.platform}-${link.url}`}
                rel="noreferrer"
                target="_blank"
              >
                <Icon className="h-4 w-4 text-bc-electric" aria-hidden="true" />
                <span>{link.label}</span>
                <ExternalLink className="h-3.5 w-3.5 text-bc-muted" aria-hidden="true" />
              </a>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-sm text-bc-muted">Social links can be added from Admin / General settings.</p>
      )}
    </section>
  );
}

export default async function LivePage() {
  const currentUser = await getCurrentUser();
  const [liveState, chatData, roleDisplayLabels, schedules, siteSettings, sheepSettings] = await Promise.all([
    getPublicLiveState(),
    getPublicChatData("live", currentUser?.id),
    getRoleDisplayNameOverrides(),
    getPublicUpcomingStreamSchedules(),
    getPublicSiteSettings(),
    getSheepThrowSettings()
  ]);
  const [starSupport, currentStarBalance] = await Promise.all([
    getLiveStarSupportData(),
    getStarWalletBalance(currentUser?.id)
  ]);
  const sheepReadiness = await getChatSheepThrowReadiness(currentUser?.id, sheepSettings);
  const { activeIngests, channel, status, playbackUrl, offlineImageUrl, viewerCount, health } = liveState;
  const roomRows: PublicChatRoomRow[] = chatData.rooms.map((room) => ({
    id: room.id,
    lockedAt: room.lockedAt,
    slug: room.slug,
    name: room.name,
    slowModeSeconds: room.slowModeSeconds,
    type: room.type,
    messages: room.messages
  }));
  const selectedRoomRow: PublicChatRoomRow | null = chatData.selectedRoom
    ? {
        id: chatData.selectedRoom.id,
        lockedAt: chatData.selectedRoom.lockedAt,
        slug: chatData.selectedRoom.slug,
        name: chatData.selectedRoom.name,
        slowModeSeconds: chatData.selectedRoom.slowModeSeconds,
        type: chatData.selectedRoom.type,
        messages: chatData.selectedRoom.messages
      }
    : null;
  const messageRows: PublicChatMessageRow[] = chatData.messages.map((message) => ({
    id: message.id,
    roomId: message.roomId,
    replyTo: message.replyTo,
    body: message.body,
    kind: message.kind,
    mediaUrl: message.mediaUrl,
    mediaPreviewUrl: message.mediaPreviewUrl,
    mediaAlt: message.mediaAlt,
    mediaSource: message.mediaSource,
    mediaSourceId: message.mediaSourceId,
    mediaWidth: message.mediaWidth,
    mediaHeight: message.mediaHeight,
    effectId: message.effectId,
    starAmount: message.starAmount,
    starNote: message.starNote,
    createdAt: message.createdAt,
    deletedAt: message.deletedAt,
    authorDisplayName: message.authorDisplayName,
    authorAvatarUrl: message.authorAvatarUrl,
    authorUserId: message.authorUserId,
    authorRoles: message.authorRoles,
    reactions: message.reactions
  }));
  const assetRows: PublicChatAssetRow[] = chatData.assets.map((asset) => ({
    id: asset.id,
    packId: asset.packId,
    packName: asset.packName,
    name: asset.name,
    shortcode: asset.shortcode,
    imageUrl: asset.imageUrl,
    kind: asset.kind,
    isAnimated: asset.isAnimated
  }));
  const presenceRows: PublicChatPresenceUserRow[] = chatData.presenceUsers.map((user) => ({
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    roles: user.roles,
    status: user.status,
    lastActiveAt: user.lastActiveAt
  }));

  return (
    <PublicShell hideFooterOnMobile siteSettings={siteSettings}>
      <main className="h-[calc(100dvh-65px)] min-h-0 w-full overflow-hidden px-0 py-0 lg:-mt-[65px] lg:h-auto lg:overflow-visible lg:px-4 xl:px-5">
        <section className="mx-auto flex h-full min-h-0 w-full max-w-[1920px] flex-col overflow-hidden lg:block lg:h-auto lg:min-h-[100dvh] lg:overflow-visible">
          <div className="min-w-0 shrink-0 transition-[margin-right] duration-300 ease-out lg:mr-[calc(340px+var(--bc-live-presence-rail-width,224px)+16px)] lg:pb-4 lg:pt-[81px] xl:mr-[calc(360px+var(--bc-live-presence-rail-width,224px)+20px)] 2xl:mr-[calc(380px+var(--bc-live-presence-rail-width,224px)+20px)]">
            <div className="relative z-20 shrink-0 lg:static lg:z-auto">
              <LivePlaybackPlayer
                offlineImageUrl={offlineImageUrl}
                activeIngests={activeIngests}
                playbackUrl={playbackUrl}
                status={status}
                title={channel?.title ?? "Bouncecore Live"}
              />
            </div>
            <div className="hidden lg:block">
              <LiveSocialLinks links={siteSettings.liveSocialLinks} />
            </div>

            <section className="mt-4 hidden gap-4 lg:grid lg:grid-cols-2">
              <div className="rounded-md border border-bc-line bg-bc-panel p-5">
                <Badge tone={status === "live" ? "acid" : "muted"}>{status.toUpperCase()}</Badge>
                <h2 className="mt-4 text-xl font-black">Stream status</h2>
                <p className="mt-2 text-sm text-bc-muted">
                  {viewerCount.toLocaleString("en-GB")} viewers on {channel ? `/${channel.slug}` : "the primary live channel"}.
                </p>
              </div>
              <div className="rounded-md border border-bc-line bg-bc-panel p-5">
                <Badge tone="cyan">{health.status.toUpperCase()}</Badge>
                <h2 className="mt-4 text-xl font-black">Stream health</h2>
                <p className="mt-2 text-sm text-bc-muted">
                  Ingest connected: {health.ingestConnected ? "yes" : "no"}. Checked {health.checkedAt}.
                </p>
              </div>
            </section>

            <section className="mt-4 hidden gap-4 lg:grid lg:grid-cols-[minmax(0,420px)_1fr]">
              <StarSupportLeaderboard initialData={starSupport} />
              <div className="rounded-md border border-bc-line bg-bc-panel p-5">
                <div className="flex items-center justify-between gap-3">
                  <Badge tone="pink">Schedule</Badge>
                  <CalendarClock className="h-5 w-5 text-bc-pink" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-xl font-black">Upcoming sets</h2>
                <div className="mt-4 space-y-3">
                  {schedules.map((schedule) => (
                    <article className="rounded-md border border-bc-line bg-bc-ink p-3" key={schedule.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={scheduleTone(schedule.status)}>{schedule.status}</Badge>
                        <Badge tone="muted">/{schedule.channelSlug}</Badge>
                      </div>
                      <h3 className="mt-3 font-semibold">{schedule.title}</h3>
                      <p className="mt-1 text-xs text-bc-muted">
                        {formatScheduleDate(schedule.startsAt)} to {formatScheduleDate(schedule.endsAt)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <UserRound className="h-4 w-4 text-bc-muted" aria-hidden="true" />
                        <span className="text-xs text-bc-muted">{schedule.hostDisplayName ?? "Host TBC"}</span>
                        {schedule.hostRoles.map((role) => (
                          <Badge key={role} tone={roleBadgeTone(role)}>
                            {roleDisplayName(role, roleDisplayLabels)}
                          </Badge>
                        ))}
                      </div>
                    </article>
                  ))}
                  {!schedules.length ? <p className="text-sm text-bc-muted">No upcoming stream slots have been scheduled yet.</p> : null}
                </div>
              </div>
            </section>
          </div>

          <aside className="relative z-30 flex min-h-0 min-w-0 flex-1 overflow-hidden px-0 pb-0 lg:fixed lg:right-0 lg:top-[65px] lg:h-[calc(100dvh-65px)] lg:w-[340px] lg:overflow-visible lg:px-0 xl:w-[360px] 2xl:w-[380px]">
            <ChatRoomPanel
              className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border-x-0 border-b-0 border-white/15 bg-bc-panel/75 shadow-none backdrop-blur-md lg:border-y-0 lg:border-r-0 lg:border-bc-line lg:bg-[#050712]/95 lg:backdrop-blur-none"
              compact
              hideHeader
              mobileLiveMode
              currentUser={currentUser ? { id: currentUser.id, displayName: currentUser.displayName, roles: currentUser.roles } : null}
              currentStarBalance={currentStarBalance}
              assets={assetRows}
              messagesClassName="min-h-0 flex-1 max-h-none p-2 lg:p-3"
              messages={messageRows}
              presenceUsers={presenceRows}
              roleDisplayLabels={roleDisplayLabels}
              rooms={roomRows}
              selectedRoom={selectedRoomRow}
              sheepRemainingCooldownSeconds={sheepReadiness.remainingCooldownSeconds}
              sheepSettings={sheepSettings}
              showPresenceRail
              showRoomLinks={false}
            />
          </aside>
        </section>
      </main>
    </PublicShell>
  );
}
