import { Activity, ShieldCheck, Trash2 } from "lucide-react";
import { clearAuditLogsAction } from "@/app/admin/audit-logs/actions";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clearAuditLogsConfirmationText } from "@/lib/admin/maintenance-core";
import { getAdminAuditLogs } from "@/lib/admin/admin-data";
import { requireUserPermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(date);
}

function severityTone(severity: string) {
  if (severity === "critical") {
    return "pink" as const;
  }

  if (severity === "warning") {
    return "amber" as const;
  }

  return "cyan" as const;
}

export default async function AdminAuditLogsPage() {
  const actor = await requireUserPermission("audit.view");
  const auditLogs = await getAdminAuditLogs();
  const canClearAuditLogs = hasPermission(actor, "settings.manage");

  return (
    <AdminShell
      requiredPermission="audit.view"
      title="Audit logs"
      description="Security and operations trail for authentication, setup, RBAC, stream-key, payment, and moderation events."
    >
      <section className="rounded-md border border-bc-line bg-bc-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-bc-electric" aria-hidden="true" />
            <div>
              <h3 className="text-xl font-black">Recent events</h3>
              <p className="mt-1 text-sm text-bc-muted">Showing the latest {auditLogs.length} audit records.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="acid">Database-backed</Badge>
            {canClearAuditLogs ? (
              <form action={clearAuditLogsAction} className="flex flex-wrap gap-2">
                <input
                  className="min-h-9 w-52 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-xs text-white"
                  name="confirmation"
                  placeholder={clearAuditLogsConfirmationText}
                />
                <Button disabled={!auditLogs.length} size="sm" type="submit" variant="pink">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Clear logs
                </Button>
              </form>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="text-bc-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Event</th>
                <th className="px-4 py-3 font-semibold">Severity</th>
                <th className="px-4 py-3 font-semibold">Actor</th>
                <th className="px-4 py-3 font-semibold">Target</th>
                <th className="px-4 py-3 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr className="border-t border-bc-line" key={log.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-bc-electric" aria-hidden="true" />
                      <span className="font-semibold">{log.action}</span>
                    </div>
                    {log.ipAddress ? <p className="mt-1 text-xs text-bc-muted">{log.ipAddress}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={severityTone(log.severity)}>{log.severity}</Badge>
                  </td>
                  <td className="px-4 py-3 text-bc-muted">
                    {log.actor ? (
                      <>
                        <span className="font-semibold text-white">{log.actor.displayName}</span>
                        <p className="mt-1 text-xs">{log.actor.email}</p>
                      </>
                    ) : (
                      "System"
                    )}
                  </td>
                  <td className="px-4 py-3 text-bc-muted">{log.target ?? "None"}</td>
                  <td className="px-4 py-3 text-bc-muted">{formatDate(log.createdAt)}</td>
                </tr>
              ))}
              {!auditLogs.length ? (
                <tr className="border-t border-bc-line">
                  <td className="px-4 py-8 text-center text-bc-muted" colSpan={5}>
                    No audit logs have been written yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
