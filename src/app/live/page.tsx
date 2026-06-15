import { CalendarClock, UserRound } from "lucide-react";
import { ChatRoomPanel } from "@/app/chat/chat-room-panel";
import { LivePlaybackPlayer } from "@/app/live/live-playback-player";
import { StarSupportLeaderboard } from "@/app/live/star-support-panel";
import type { PublicChatAssetRow, PublicChatMessageRow, PublicChatRoomRow } from "@/app/chat/state";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { roleBadgeTone, roleDisplayName } from "@/lib/auth/role-display";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicChatData } from "@/lib/chat/chat-service";
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

export default async function LivePage() {
  const currentUser = await getCurrentUser();
  const [liveState, chatData, roleDisplayLabels, schedules] = await Promise.all([
    getPublicLiveState(),
    getPublicChatData("live", currentUser?.id),
    getRoleDisplayNameOverrides(),
    getPublicUpcomingStreamSchedules()
  ]);
  const [starSupport, currentStarBalance] = await Promise.all([
    getLiveStarSupportData(),
    getStarWalletBalance(currentUser?.id)
  ]);
  const { channel, status, playbackUrl, offlineImageUrl, viewerCount, health } = liveState;
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

  return (
    <PublicShell>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-bc-muted">Home / Live</p>
            <h1 className="mt-1 text-4xl font-black">Bouncecore Live</h1>
            <p className="mt-2 max-w-3xl text-bc-muted">
              Watch the stream, join the live room, and send stars without leaving the player.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={status === "live" ? "acid" : "muted"}>{status.toUpperCase()}</Badge>
            <Badge tone="cyan">{viewerCount.toLocaleString("en-GB")} watching</Badge>
          </div>
        </div>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px] xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="min-w-0">
            <LivePlaybackPlayer
              healthStatus={health.status}
              offlineImageUrl={offlineImageUrl}
              playbackUrl={playbackUrl}
              status={status}
              streamProfile={channel?.streamProfile ?? null}
              title={channel?.title ?? "Bouncecore Live"}
              viewerCount={viewerCount}
            />
          </div>

          <aside className="min-w-0">
            <ChatRoomPanel
              compact
              currentUser={currentUser ? { id: currentUser.id, displayName: currentUser.displayName, roles: currentUser.roles } : null}
              currentStarBalance={currentStarBalance}
              assets={assetRows}
              messages={messageRows}
              roleDisplayLabels={roleDisplayLabels}
              rooms={roomRows}
              selectedRoom={selectedRoomRow}
              showRoomLinks={false}
            />
          </aside>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
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

        <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
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
      </main>
    </PublicShell>
  );
}
