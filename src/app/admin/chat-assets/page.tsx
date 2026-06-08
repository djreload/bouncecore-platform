import { AdminChatAssetsPanel } from "@/app/admin/chat-assets/chat-assets-panel";
import type { AdminChatAssetPackRow } from "@/app/admin/chat-assets/state";
import { AdminShell } from "@/components/layout/admin-shell";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminChatAssetData } from "@/lib/chat/chat-asset-service";

export const dynamic = "force-dynamic";

export default async function AdminChatAssetsPage() {
  await requireUserPermission("admin.access");
  const { packs, stats } = await getAdminChatAssetData();
  const packRows: AdminChatAssetPackRow[] = packs.map((pack) => ({
    id: pack.id,
    slug: pack.slug,
    name: pack.name,
    description: pack.description,
    status: pack.status,
    sortOrder: pack.sortOrder,
    createdAt: pack.createdAt,
    updatedAt: pack.updatedAt,
    stickers: pack.stickers.map((asset) => ({
      id: asset.id,
      packId: asset.packId,
      packName: asset.packName,
      name: asset.name,
      shortcode: asset.shortcode,
      imageUrl: asset.imageUrl,
      kind: asset.kind,
      isAnimated: asset.isAnimated,
      sortOrder: asset.sortOrder,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt
    }))
  }));

  return (
    <AdminShell
      title="Chat Assets"
      description="Upload custom sticker packs and animated emoji for public chat and live chat."
    >
      <AdminChatAssetsPanel packs={packRows} stats={stats} />
    </AdminShell>
  );
}
