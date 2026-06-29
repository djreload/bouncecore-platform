import { Activity, CheckCircle2, Clock, DatabaseZap, ExternalLink, ListChecks, Server, TriangleAlert, XCircle } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
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
  const productionReadinessItemCount = health.productionReadiness.reduce((total, group) => total + group.items.length, 0);
  const productionCriticalCount = health.productionIssues.filter((issue) => issue.status === "critical").length;
  const productionWarningCount = health.productionIssues.filter((issue) => issue.status === "warning").length;

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
            <p className="text-3xl font-black">{health.checks.length + health.dataQuality.length + productionReadinessItemCount}</p>
          </div>
          <p className="mt-2 text-sm text-bc-muted">Runtime, integration, and data checks.</p>
        </article>
      </div>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
          <div>
            <h3 className="text-xl font-black">Launch attention</h3>
            <p className="mt-1 text-sm text-bc-muted">Critical blockers and warnings pulled from the production readiness checks.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={productionCriticalCount ? "pink" : "acid"}>{productionCriticalCount} critical</Badge>
            <Badge tone={productionWarningCount ? "amber" : "acid"}>{productionWarningCount} warnings</Badge>
          </div>
        </div>
        {health.productionIssues.length ? (
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {health.productionIssues.slice(0, 10).map((issue) => (
              <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={`${issue.groupId}:${issue.label}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusIcon status={issue.status} />
                      <h4 className="font-semibold">{issue.label}</h4>
                    </div>
                    <p className="mt-1 text-xs font-semibold uppercase text-bc-muted">{issue.groupTitle}</p>
                  </div>
                  <Badge tone={statusTone(issue.status)}>{issue.value}</Badge>
                </div>
                <p className="mt-3 text-sm text-bc-muted">{issue.detail}</p>
                {issue.href ? (
                  <ButtonLink className="mt-4" href={issue.href} size="sm" variant="ghost">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Repair
                  </ButtonLink>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="p-4">
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-bc-acid" aria-hidden="true" />
                <h4 className="font-semibold">No production readiness issues detected</h4>
              </div>
              <p className="mt-2 text-sm text-bc-muted">All launch checklist groups are currently healthy.</p>
            </article>
          </div>
        )}
      </section>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
          <div>
            <h3 className="text-xl font-black">Production readiness</h3>
            <p className="mt-1 text-sm text-bc-muted">Grouped launch checklist across payments, email, push, stream, uploads, mobile, legal, and operations.</p>
          </div>
          <ListChecks className="h-6 w-6 text-bc-acid" aria-hidden="true" />
        </div>
        <div className="grid gap-3 p-4 xl:grid-cols-2">
          {health.productionReadiness.map((group) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={group.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={group.status} />
                    <h4 className="font-black">{group.title}</h4>
                  </div>
                  <p className="mt-2 text-sm text-bc-muted">{group.description}</p>
                </div>
                <Badge tone={statusTone(group.status)}>{group.status}</Badge>
              </div>
              <div className="mt-4 grid gap-2">
                {group.items.map((item) => (
                  <div className="rounded-md border border-bc-line bg-bc-panel p-3" key={`${group.id}:${item.label}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={item.status} />
                        <p className="text-sm font-semibold">{item.label}</p>
                      </div>
                      <Badge tone={statusTone(item.status)}>{item.value}</Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-bc-muted">{item.detail}</p>
                    {item.href ? (
                      <ButtonLink className="mt-3" href={item.href} size="sm" variant="ghost">
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        Repair
                      </ButtonLink>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel">
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
          <div>
            <h3 className="text-xl font-black">Data quality</h3>
            <p className="mt-1 text-sm text-bc-muted">Production records that can break checkout, downloads, mobile config, or public presentation.</p>
          </div>
          <DatabaseZap className="h-6 w-6 text-bc-electric" aria-hidden="true" />
        </div>
        <div className="grid gap-3 p-4 lg:grid-cols-2">
          {health.dataQuality.map((check) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={check.label}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <StatusIcon status={check.status} />
                  <h4 className="font-semibold">{check.label}</h4>
                </div>
                <Badge tone={statusTone(check.status)}>{check.value}</Badge>
              </div>
              <p className="mt-3 text-sm text-bc-muted">{check.detail}</p>
              {check.href ? (
                <ButtonLink className="mt-4" href={check.href} size="sm" variant="ghost">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Repair
                </ButtonLink>
              ) : null}
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
