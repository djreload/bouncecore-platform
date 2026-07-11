import { AdminChatroomsPanel } from "@/app/admin/chatrooms/chatrooms-panel";
import type { AdminChatMessageRow, AdminChatRoomRow, AdminChatSheepThrowRow } from "@/app/admin/chatrooms/state";
import { AdminShell } from "@/components/layout/admin-shell";
import { requireUserPermission } from "@/lib/auth/guards";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";
import { getAdminChatroomsData } from "@/lib/chat/chat-service";
import { getSheepThrowSettings } from "@/lib/chat/sheep-throw-service";
import { getRaveWarSettings } from "@/lib/rave-wars/rave-war-service";

export const dynamic = "force-dynamic";

export default async function AdminChatroomsPage() {
  await requireUserPermission("moderation.use");
  const [{ rooms, messages, sheepThrows }, roleDisplayLabels, sheepSettings, raveWarSettings] = await Promise.all([
    getAdminChatroomsData(),
    getRoleDisplayNameOverrides(),
    getSheepThrowSettings(),
    getRaveWarSettings()
  ]);
  const roomRows: AdminChatRoomRow[] = rooms.map((room) => ({
    id: room.id,
    lockedAt: room.lockedAt,
    slug: room.slug,
    name: room.name,
    slowModeSeconds: room.slowModeSeconds,
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
    kind: message.kind,
    mediaPreviewUrl: message.mediaPreviewUrl,
    mediaAlt: message.mediaAlt,
    createdAt: message.createdAt,
    deletedAt: message.deletedAt,
    authorDisplayName: message.authorDisplayName,
    authorRoles: message.authorRoles
  }));
  const sheepThrowRows: AdminChatSheepThrowRow[] = sheepThrows.map((sheepThrow) => ({
    id: sheepThrow.id,
    roomName: sheepThrow.roomName,
    roomSlug: sheepThrow.roomSlug,
    spriteId: sheepThrow.spriteId,
    throwerDisplayName: sheepThrow.throwerDisplayName,
    targetDisplayName: sheepThrow.targetDisplayName,
    targetMessageId: sheepThrow.targetMessageId,
    createdAt: sheepThrow.createdAt
  }));

  return (
    <AdminShell
      requiredPermission="moderation.use"
      title="Chatrooms"
      description="Native room setup and moderation for public chat, live chat, VIP spaces, and creator rooms."
    >
      <AdminChatroomsPanel
        messages={messageRows}
        raveWarSettings={raveWarSettings}
        roleDisplayLabels={roleDisplayLabels}
        rooms={roomRows}
        sheepSettings={sheepSettings}
        sheepThrows={sheepThrowRows}
      />
    </AdminShell>
  );
}
