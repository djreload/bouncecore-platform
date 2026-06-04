import { CalendarClock, UserRound } from "lucide-react";
import { ChatRoomPanel } from "@/app/chat/chat-room-panel";
import { LivePlaybackPlayer } from "@/app/live/live-playback-player";
import { StarSupportLeaderboard } from "@/app/live/star-support-panel";
import type { PublicChatMessageRow, PublicChatRoomRow } from "@/app/chat/state";
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
  const [liveState, chatData, currentUser, roleDisplayLabels, schedules] = await Promise.all([
    getPublicLiveState(),
    getPublicChatData("live"),
    getCurrentUser(),
    getRoleDisplayNameOverrides(),
    getPublicUpcomingStreamSchedules()
  ]);
  const [starSupport, currentStarBalance] = await Promise.all([
    getLiveStarSupportData(),
    getStarWalletBalance(currentUser?.id)
  ]);
  const { channel, status, playbackUrl, viewerCount, health } = liveState;
  const roomRows: PublicChatRoomRow[] = chatData.rooms.map((room) => ({
    id: room.id,
    slug: room.slug,
    name: room.name,
    type: room.type,
    messages: room.messages
  }));
  const selectedRoomRow: PublicChatRoomRow | null = chatData.selectedRoom
    ? {
        id: chatData.selectedRoom.id,
        slug: chatData.selectedRoom.slug,
        name: chatData.selectedRoom.name,
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
    starAmount: message.starAmount,
    starNote: message.starNote,
    createdAt: message.createdAt,
    authorDisplayName: message.authorDisplayName,
    authorUserId: message.authorUserId,
    authorRoles: message.authorRoles
  }));

  return (
    <PublicShell>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-5">
          <p className="text-sm text-bc-muted">Home / Live</p>
          <h1 className="mt-1 text-4xl font-black">Bouncecore Live</h1>
          <p className="mt-2 max-w-3xl text-bc-muted">
            Public playback shell wired to Bouncecore stream channels and the replaceable stream provider. This page never
            exposes private stream keys.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <LivePlaybackPlayer
            healthStatus={health.status}
            playbackUrl={playbackUrl}
            status={status}
            title={channel?.title ?? "Bouncecore Live"}
            viewerCount={viewerCount}
          />
          <aside className="space-y-4">
            <div className="rounded-md border border-bc-line bg-bc-panel p-5">
              <Badge tone={status === "live" ? "acid" : "muted"}>{status.toUpperCase()}</Badge>
              <h2 className="mt-4 text-xl font-black">Stream status</h2>
              <p className="mt-2 text-sm text-bc-muted">
                {viewerCount} viewers via stream provider. {channel ? `Channel: ${channel.slug}.` : "No database channel yet."}
              </p>
            </div>
            <div className="rounded-md border border-bc-line bg-bc-panel p-5">
              <Badge tone="cyan">{health.status.toUpperCase()}</Badge>
              <h2 className="mt-4 text-xl font-black">Stream health</h2>
              <p className="mt-2 text-sm text-bc-muted">
                Ingest connected: {health.ingestConnected ? "yes" : "no"}. Checked {health.checkedAt}.
              </p>
            </div>
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
            <ChatRoomPanel
              compact
              currentUser={currentUser ? { id: currentUser.id, displayName: currentUser.displayName, roles: currentUser.roles } : null}
              currentStarBalance={currentStarBalance}
              messages={messageRows}
              roleDisplayLabels={roleDisplayLabels}
              rooms={roomRows}
              selectedRoom={selectedRoomRow}
              showRoomLinks={false}
            />
          </aside>
        </div>
      </main>
    </PublicShell>
  );
}
