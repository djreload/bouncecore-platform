import { NextResponse } from "next/server";
import { mediaStorageManifestFilename } from "@/lib/admin/media-storage-core";
import { getAdminMediaStorageManifest } from "@/lib/admin/media-storage-service";
import { writeAuditLog } from "@/lib/auth/audit";
import { getApiUserWithPermission } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getApiUserWithPermission("settings.manage");

  if (!user) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const generatedAt = new Date();
  const manifest = await getAdminMediaStorageManifest(generatedAt);

  await writeAuditLog({
    action: "admin.storage.export_manifest",
    actorId: user.id,
    metadata: {
      brokenReferenceCount: manifest.stats.brokenReferenceCount,
      fileCount: manifest.stats.fileCount,
      orphanCount: manifest.stats.orphanCount,
      totalSizeBytes: manifest.stats.totalSizeBytes
    },
    severity: "info",
    target: "media-storage"
  });

  return new NextResponse(JSON.stringify(manifest, null, 2), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${mediaStorageManifestFilename(generatedAt)}"`,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
