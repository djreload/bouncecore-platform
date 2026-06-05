import { Activity, CheckCircle2, Clock, Server, TriangleAlert, XCircle } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { getAdminSystemHealthData } from "@/lib/admin/system-health";
import { requireUserPermission } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value));
}

function statusTone(status: string) {
  if (status === "healthy") {
    return "acid" as const;
  }

  if (status === "warning") {
    return "amber" as const;
  }

  return "pink" as const;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "healthy") {
    return <CheckCircle2 className="h-5 w-5 text-bc-acid" aria-hidden="true" />;
  }

  if (status === "warning") {
    return <TriangleAlert className="h-5 w-5 text-amber-300" aria-hidden="true" />;
  }

  return <XCircle className="h-5 w-5 text-bc-pink" aria-hidden="true" />;
}

export default async function AdminSystemHealthPage() {
  await requireUserPermission("admin.access");
  const health = await getAdminSystemHealthData();

  return (
    <AdminShell
      title="System health"
      description="Runtime, database, stream, chat, and integration readiness checks for the Bouncecore platform."
    >
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={statusTone(health.overallStatus)}>Overall</Badge>
          <div className="mt-4 flex items-center gap-3">
            <StatusIcon status={health.overallStatus} />
            <p className="text-3xl font-black capitalize">{health.overallStatus}</p>
          </div>
          <p className="mt-2 text-sm text-bc-muted">Current platform readiness.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Checked</Badge>
          <div className="mt-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-bc-electric" aria-hidden="true" />
            <p className="text-lg font-black">{formatDate(health.checkedAt)}</p>
          </div>
          <p className="mt-2 text-sm text-bc-muted">Generated on request from the server.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Checks</Badge>
          <div className="mt-4 flex items-center gap-3">
            <Server className="h-5 w-5 text-bc-pink" aria-hidden="true" />
            <p className="text-3xl font-black">{health.checks.length}</p>
          </div>
          <p className="mt-2 text-sm text-bc-muted">Runtime and integration checks.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel">
        <div className="border-b border-bc-line p-4">
          <h3 className="text-xl font-black">Readiness checks</h3>
          <p className="mt-1 text-sm text-bc-muted">Database, stream provider, and required environment values.</p>
        </div>
        <div className="grid gap-3 p-4 lg:grid-cols-2">
          {health.checks.map((check) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={check.label}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <StatusIcon status={check.status} />
                  <h4 className="font-semibold">{check.label}</h4>
                </div>
                <Badge tone={statusTone(check.status)}>{check.value}</Badge>
              </div>
              <p className="mt-3 text-sm text-bc-muted">{check.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel">
        <div className="border-b border-bc-line p-4">
          <h3 className="text-xl font-black">Live metrics</h3>
          <p className="mt-1 text-sm text-bc-muted">Counts and runtime metrics pulled from the app and database.</p>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {health.metrics.map((metric) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={metric.label}>
              <div className="flex items-center justify-between gap-3">
                <Badge tone="muted">{metric.label}</Badge>
                <Activity className="h-4 w-4 text-bc-muted" aria-hidden="true" />
              </div>
              <p className="mt-4 text-3xl font-black">{metric.value}</p>
              <p className="mt-2 text-sm text-bc-muted">{metric.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
