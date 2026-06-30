import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Database, FileArchive, Files, HardDrive, Search, UploadCloud } from "lucide-react";
import { CleanOrphanUploadsForm } from "@/app/admin/storage/clean-orphan-uploads-form";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { cleanOrphanUploadsConfirmationText } from "@/lib/admin/maintenance-core";
import {
  type AdminMediaStorageData,
  formatStorageBytes,
  getAdminMediaStorageData
} from "@/lib/admin/media-storage-service";
import { requireUserPermission } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

type BadgeTone = React.ComponentProps<typeof Badge>["tone"];
type StorageFile = AdminMediaStorageData["files"]["largest"][number];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(
    new Date(value)
  );
}

function statusTone(status: StorageFile["status"]): BadgeTone {
  return status === "referenced" ? "acid" : "amber";
}

function StatCard({
  detail,
  icon: Icon,
  label,
  tone,
  value
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  tone: BadgeTone;
  value: string | number;
}) {
  return (
    <article className="rounded-md border border-bc-line bg-bc-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <Badge tone={tone}>{label}</Badge>
        <Icon className="h-5 w-5 text-bc-muted" aria-hidden="true" />
      </div>
      <p className="mt-4 text-3xl font-black">{value}</p>
      <p className="mt-2 text-sm text-bc-muted">{detail}</p>
    </article>
  );
}

function StorageBar({ label, total, value }: { label: string; total: number; value: number }) {
  const width = total > 0 ? Math.max(2, Math.round((value / total) * 100)) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-bc-muted">
        <span>{label}</span>
        <span>{formatStorageBytes(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-bc-ink">
        <div className="h-2 rounded-full bg-bc-electric" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function FileTable({ emptyText, files, title }: { emptyText: string; files: StorageFile[]; title: string }) {
  return (
    <section className="rounded-md border border-bc-line bg-bc-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
        <div>
          <h3 className="text-xl font-black">{title}</h3>
          <p className="mt-1 text-sm text-bc-muted">Showing up to 50 files from the managed uploads directory.</p>
        </div>
        <Badge tone="muted">{files.length} shown</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-bc-line text-left text-sm">
          <thead className="bg-bc-ink text-xs uppercase text-bc-muted">
            <tr>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">References</th>
              <th className="px-4 py-3">Modified</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bc-line">
            {files.map((file) => (
              <tr className="align-top" key={`${title}:${file.path}`}>
                <td className="max-w-[420px] px-4 py-3">
                  <p className="break-all font-semibold text-white">{file.path}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge tone="cyan">{file.category}</Badge>
                </td>
                <td className="px-4 py-3 text-bc-muted">{formatStorageBytes(file.sizeBytes)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={statusTone(file.status)}>{file.status}</Badge>
                    <Badge tone="muted">{file.references}</Badge>
                  </div>
                </td>
                <td className="px-4 py-3 text-bc-muted">{formatDate(file.modifiedAt)}</td>
              </tr>
            ))}
            {!files.length ? (
              <tr>
                <td className="px-4 py-6 text-sm text-bc-muted" colSpan={5}>
                  {emptyText}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function AdminStoragePage() {
  await requireUserPermission("settings.manage");
  const data = await getAdminMediaStorageData();

  return (
    <AdminShell
      title="Storage"
      description="Inspect managed upload disk usage, active references, orphan candidates, and guarded media cleanup."
      requiredPermission="settings.manage"
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            detail="Total bytes currently stored in public/uploads."
            icon={HardDrive}
            label="Disk usage"
            tone="cyan"
            value={formatStorageBytes(data.stats.totalSizeBytes)}
          />
          <StatCard detail="Files found in the managed upload directory." icon={Files} label="Files" tone="acid" value={data.stats.fileCount} />
          <StatCard
            detail="Files still referenced by database records or settings."
            icon={Database}
            label="Referenced"
            tone="acid"
            value={data.stats.referencedCount}
          />
          <StatCard
            detail="Local upload files with no current database/settings reference."
            icon={AlertTriangle}
            label="Orphan candidates"
            tone={data.stats.orphanCount ? "amber" : "muted"}
            value={data.stats.orphanCount}
          />
        </div>

        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge tone="muted">Upload root</Badge>
              <h3 className="mt-4 text-xl font-black">Managed upload directory</h3>
              <p className="mt-2 break-all text-sm text-bc-muted">{data.rootPath}</p>
            </div>
            <div className="grid min-w-[240px] gap-3">
              <StorageBar label="Referenced media" total={data.stats.totalSizeBytes} value={data.stats.referencedSizeBytes} />
              <StorageBar label="Orphan candidates" total={data.stats.totalSizeBytes} value={data.stats.orphanSizeBytes} />
            </div>
          </div>
        </section>

        <section className="rounded-md border border-bc-line bg-bc-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
            <div>
              <h3 className="text-xl font-black">Usage by category</h3>
              <p className="mt-1 text-sm text-bc-muted">Grouped by the first folder under /uploads.</p>
            </div>
            <UploadCloud className="h-6 w-6 text-bc-electric" aria-hidden="true" />
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {data.categories.map((category) => (
              <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={category.category}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge tone="cyan">{category.category}</Badge>
                    <p className="mt-3 text-2xl font-black">{formatStorageBytes(category.sizeBytes)}</p>
                    <p className="mt-1 text-sm text-bc-muted">{category.fileCount} files</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="acid">{category.referencedCount} referenced</Badge>
                    <Badge tone={category.orphanCount ? "amber" : "muted"}>{category.orphanCount} orphan</Badge>
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  <StorageBar label="Referenced" total={category.sizeBytes} value={category.referencedSizeBytes} />
                  <StorageBar label="Orphan candidates" total={category.sizeBytes} value={category.orphanSizeBytes} />
                </div>
              </article>
            ))}
            {!data.categories.length ? (
              <div className="rounded-md border border-bc-line bg-bc-ink p-5 text-sm text-bc-muted">
                Upload categories will appear here once media files have been saved.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge tone="pink">Maintenance</Badge>
              <h3 className="mt-4 text-xl font-black">Clean orphan uploads</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-bc-muted">
                Deletes files that exist under public/uploads but are not referenced by current database records or saved settings.
                Each file is checked again immediately before deletion, and the result is written to the audit log.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone={data.stats.orphanCount ? "amber" : "muted"}>{data.stats.orphanCount} candidates</Badge>
                <Badge tone="muted">{formatStorageBytes(data.stats.orphanSizeBytes)} reclaimable</Badge>
              </div>
            </div>
            <CleanOrphanUploadsForm
              confirmationText={cleanOrphanUploadsConfirmationText}
              disabled={!data.stats.orphanCount}
            />
          </div>
        </section>

        <FileTable emptyText="No unreferenced uploaded files were found." files={data.files.orphanCandidates} title="Orphan candidates" />
        <FileTable emptyText="No uploaded files were found." files={data.files.largest} title="Largest files" />
        <FileTable emptyText="No uploaded files were found." files={data.files.recent} title="Recent uploads" />

        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex items-center gap-2">
            <FileArchive className="h-5 w-5 text-bc-amber" aria-hidden="true" />
            <h3 className="text-lg font-black">Cleanup behavior</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-bc-muted">
            Replaced or account-deleted media is removed automatically only after Bouncecore confirms the old upload path is no longer
            referenced by active database records or saved settings. Manual orphan cleanup uses the same reference-safe deletion path.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-bc-muted">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span>Reference scan covers profiles, stream channels, chat media, chat reports, stickers, products, tracks, purchases, and app settings.</span>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
