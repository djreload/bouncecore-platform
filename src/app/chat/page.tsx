import { PublicShell } from "@/components/layout/public-shell";
import { ChatRoomPanel } from "@/app/chat/chat-room-panel";
import type { PublicChatMessageRow, PublicChatRoomRow } from "@/app/chat/state";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";
import { getPublicChatData } from "@/lib/chat/chat-service";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type ChatPageProps = {
  searchParams?: Promise<{
    room?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const params = searchParams ? await searchParams : {};
  const [{ rooms, selectedRoom, messages }, currentUser, roleDisplayLabels] = await Promise.all([
    getPublicChatData(firstParam(params.room)),
    getCurrentUser(),
    getRoleDisplayNameOverrides()
  ]);
  const roomRows: PublicChatRoomRow[] = rooms.map((room) => ({
    id: room.id,
    slug: room.slug,
    name: room.name,
    type: room.type,
    messages: room.messages
  }));
  const selectedRoomRow: PublicChatRoomRow | null = selectedRoom
    ? {
        id: selectedRoom.id,
        slug: selectedRoom.slug,
        name: selectedRoom.name,
        type: selectedRoom.type,
        messages: selectedRoom.messages
      }
    : null;
  const messageRows: PublicChatMessageRow[] = messages.map((message) => ({
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
    createdAt: message.createdAt,
    authorDisplayName: message.authorDisplayName,
    authorUserId: message.authorUserId,
    authorRoles: message.authorRoles
  }));

  return (
    <PublicShell>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-5">
          <p className="text-sm text-bc-muted">Home / Chat</p>
          <h1 className="mt-1 text-4xl font-black">Bouncecore Chat</h1>
          <p className="mt-2 max-w-3xl text-bc-muted">
            Native rooms for live shows, public community chat, supporter spaces, and moderation workflows.
          </p>
        </div>
        <ChatRoomPanel
          currentUser={currentUser ? { id: currentUser.id, displayName: currentUser.displayName, roles: currentUser.roles } : null}
          messages={messageRows}
          roleDisplayLabels={roleDisplayLabels}
          rooms={roomRows}
          selectedRoom={selectedRoomRow}
        />
      </main>
    </PublicShell>
  );
}
