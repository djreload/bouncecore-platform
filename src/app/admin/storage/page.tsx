import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Database,
  Download,
  FileArchive,
  Files,
  HardDrive,
  Link2Off,
  Search,
  ShieldCheck,
  UploadCloud
} from "lucide-react";
import { CleanOrphanUploadsForm } from "@/app/admin/storage/clean-orphan-uploads-form";
import { OffsiteBackupSettingsForm } from "@/app/admin/storage/offsite-backup-settings-form";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { cleanOrphanUploadsConfirmationText } from "@/lib/admin/maintenance-core";
import {
  type AdminMediaStorageData,
  formatStorageBytes,
  getAdminMediaStorageData
} from "@/lib/admin/media-storage-service";
import { getAdminOffsiteBackupSettingsData } from "@/lib/admin/offsite-backup-settings";
import {
  backupStatusFilePath,
  backupStatusHealthCheck,
  offsiteBackupStatusFilePath,
  offsiteBackupStatusHealthCheck,
  type HealthCheck
} from "@/lib/admin/system-health";
import { requireUserPermission } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

type BadgeTone = React.ComponentProps<typeof Badge>["tone"];
type StorageFile = AdminMediaStorageData["files"]["largest"][number];
type BrokenReference = AdminMediaStorageData["brokenReferences"][number];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(
    new Date(value)
  );
}

function statusTone(status: StorageFile["status"]): BadgeTone {
  return status === "referenced" ? "acid" : "amber";
}

function healthTone(status: HealthCheck["status"]): BadgeTone {
  if (status === "healthy") {
    return "acid";
  }

  if (status === "critical") {
    return "pink";
  }

  return "amber";
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

function BackupStatusCard({
  check,
  command,
  icon: Icon,
  statusPath
}: {
  check: HealthCheck;
  command: string;
  icon: LucideIcon;
  statusPath: string;
}) {
  return (
    <article className="rounded-md border border-bc-line bg-bc-ink p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={healthTone(check.status)}>{check.value}</Badge>
          <h4 className="mt-3 text-lg font-black text-white">{check.label}</h4>
        </div>
        <Icon className="h-5 w-5 text-bc-muted" aria-hidden="true" />
      </div>
      <p className="mt-3 text-sm leading-6 text-bc-muted">{check.detail}</p>
      <p className="mt-3 break-all text-xs text-bc-muted">Status file: {statusPath}</p>
      <code className="mt-3 block overflow-x-auto rounded-md border border-bc-line bg-black/30 px-3 py-2 text-xs text-bc-muted">
        {command}
      </code>
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

function BrokenReferenceTable({ references }: { references: BrokenReference[] }) {
  return (
    <section className="rounded-md border border-bc-line bg-bc-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
        <div>
          <h3 className="text-xl font-black">Missing uploaded files</h3>
          <p className="mt-1 text-sm text-bc-muted">
            Database records or settings pointing to upload paths that are not present on disk. Showing up to 100 references.
          </p>
        </div>
        <Badge tone={references.length ? "amber" : "muted"}>{references.length} shown</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-bc-line text-left text-sm">
          <thead className="bg-bc-ink text-xs uppercase text-bc-muted">
            <tr>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Record</th>
              <th className="px-4 py-3">Field</th>
              <th className="px-4 py-3">Missing path</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bc-line">
            {references.map((reference) => (
              <tr className="align-top" key={`${reference.source}:${reference.recordId}:${reference.field}:${reference.path}`}>
                <td className="px-4 py-3">
                  <Badge tone="amber">{reference.source}</Badge>
                </td>
                <td className="max-w-[260px] px-4 py-3">
                  <p className="font-semibold text-white">{reference.label}</p>
                  <p className="mt-1 break-all text-xs text-bc-muted">{reference.recordId}</p>
                </td>
                <td className="px-4 py-3 text-bc-muted">{reference.field}</td>
                <td className="max-w-[420px] px-4 py-3">
                  <p className="break-all font-semibold text-white">{reference.path}</p>
                </td>
                <td className="px-4 py-3">
                  {reference.href ? (
                    <ButtonLink href={reference.href} size="sm" variant="ghost">
                      Open
                    </ButtonLink>
                  ) : (
                    <Badge tone="muted">Manual fix</Badge>
                  )}
                </td>
              </tr>
            ))}
            {!references.length ? (
              <tr>
                <td className="px-4 py-6 text-sm text-bc-muted" colSpan={5}>
                  No missing uploaded file references were found.
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
  const [data, backupStatus, offsiteBackupStatus, offsiteSettings] = await Promise.all([
    getAdminMediaStorageData(),
    backupStatusHealthCheck(),
    offsiteBackupStatusHealthCheck(),
    getAdminOffsiteBackupSettingsData()
  ]);
  const verifiedBackupCommand =
    "scripts/backup-instance.sh --env-file .env.instance --compose-file docker-compose.instance.yml --backup-root /srv/bouncecore-backups";
  const offsiteBackupCommand =
    "sudo bash scripts/install-backup-schedule.sh --env-file .env.instance --compose-file docker-compose.instance.yml --backup-root /srv/bouncecore-backups";

  return (
    <AdminShell
      title="Storage"
      description="Inspect managed upload disk usage, active references, orphan candidates, and guarded media cleanup."
      requiredPermission="settings.manage"
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
          <StatCard
            detail={`${data.stats.brokenReferencePathCount} unique upload paths are missing from disk.`}
            icon={Link2Off}
            label="Missing refs"
            tone={data.stats.brokenReferenceCount ? "amber" : "muted"}
            value={data.stats.brokenReferenceCount}
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

        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge tone="cyan">Backup readiness</Badge>
              <h3 className="mt-4 text-xl font-black">Verified and off-server backups</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-bc-muted">
                These are the same backup checks used by the production readiness report. Keep the age private identity key
                off this web server; this server only needs the public age recipient.
              </p>
            </div>
            <ButtonLink href="/admin/system-health" size="sm" variant="ghost">
              Open readiness
            </ButtonLink>
          </div>
          <div className="mt-4 rounded-md border border-bc-line bg-bc-panel p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-black text-white">External backup location</h4>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-bc-muted">
                  Save the rclone destination and public age recipient here. The scheduled backup script reads the generated
                  config from the uploads volume when no offsite command-line flags are supplied.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {offsiteSettings.checks.map((check) => (
                  <Badge key={check.label} tone={check.status === "ready" ? "acid" : "amber"}>
                    {check.label}: {check.value}
                  </Badge>
                ))}
              </div>
            </div>
            <OffsiteBackupSettingsForm
              configVolumePath={offsiteSettings.configVolumePath}
              settings={offsiteSettings.settings}
            />
            <p className="mt-4 break-all text-xs text-bc-muted">
              Generated config file: {offsiteSettings.configFilePath}
            </p>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <BackupStatusCard
              check={backupStatus}
              command={verifiedBackupCommand}
              icon={ShieldCheck}
              statusPath={backupStatusFilePath()}
            />
            <BackupStatusCard
              check={offsiteBackupStatus}
              command={offsiteBackupCommand}
              icon={FileArchive}
              statusPath={offsiteBackupStatusFilePath()}
            />
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

        <BrokenReferenceTable references={data.brokenReferences} />

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
              <div className="mt-5 rounded-md border border-bc-line bg-bc-ink p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-bc-acid" aria-hidden="true" />
                    <h4 className="font-black text-white">Backup first</h4>
                  </div>
                  <ButtonLink download href="/admin/storage/manifest" size="sm" variant="ghost">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Download manifest
                  </ButtonLink>
                </div>
                <p className="mt-3 text-sm leading-6 text-bc-muted">
                  The manifest records every managed upload, orphan candidate, and missing database reference before cleanup.
                  For a full file backup, run the instance backup script on the server before deleting files.
                </p>
                <code className="mt-3 block overflow-x-auto rounded-md border border-bc-line bg-black/30 px-3 py-2 text-xs text-bc-muted">
                  scripts/backup-instance.sh --env-file .env.instance --compose-file docker-compose.instance.yml
                </code>
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
