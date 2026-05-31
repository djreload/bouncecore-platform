import { AdminChatroomsPanel } from "@/app/admin/chatrooms/chatrooms-panel";
import type { AdminChatMessageRow, AdminChatRoomRow } from "@/app/admin/chatrooms/state";
import { AdminShell } from "@/components/layout/admin-shell";
import { requireUserPermission } from "@/lib/auth/guards";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";
import { getAdminChatroomsData } from "@/lib/chat/chat-service";

export const dynamic = "force-dynamic";

export default async function AdminChatroomsPage() {
  await requireUserPermission("moderation.use");
  const [{ rooms, messages }, roleDisplayLabels] = await Promise.all([getAdminChatroomsData(), getRoleDisplayNameOverrides()]);
  const roomRows: AdminChatRoomRow[] = rooms.map((room) => ({
    id: room.id,
    slug: room.slug,
    name: room.name,
    type: room.type,
    createdAt: room.createdAt,
    messages: room.messages
  }));
  const messageRows: AdminChatMessageRow[] = messages.map((message) => ({
    id: message.id,
    roomId: message.roomId,
    roomName: message.roomName,
    roomSlug: message.roomSlug,
    body: message.body,
    createdAt: message.createdAt,
    deletedAt: message.deletedAt,
    authorDisplayName: message.authorDisplayName,
    authorRoles: message.authorRoles
  }));

  return (
    <AdminShell
      title="Chatrooms"
      description="Native room setup and moderation for public chat, live chat, VIP spaces, and creator rooms."
    >
      <AdminChatroomsPanel messages={messageRows} roleDisplayLabels={roleDisplayLabels} rooms={roomRows} />
    </AdminShell>
  );
}
