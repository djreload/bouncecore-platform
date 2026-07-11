import { Activity, BadgeCheck, Cable, CreditCard, ExternalLink, Image, Mail, Radio, Settings2 } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireUserPermission } from "@/lib/auth/guards";
import { getAdminIntegrationsData, type IntegrationStatus } from "@/lib/admin/integrations-service";
import { AdminEmailTestForm } from "@/app/admin/integrations/email-test-form";
import { GifProviderSettingsForm } from "@/app/admin/integrations/gif-provider-settings-form";

export const dynamic = "force-dynamic";

function statusTone(status: IntegrationStatus) {
  if (status === "ready") {
    return "acid" as const;
  }

  return status === "partial" ? ("amber" as const) : ("pink" as const);
}

function groupIcon(id: string) {
  if (id === "paypal") {
    return CreditCard;
  }

  if (id === "gifs") {
    return Image;
  }

  if (id === "mail") {
    return Mail;
  }

  if (id === "stream") {
    return Radio;
  }

  return Cable;
}

export default async function AdminIntegrationsPage() {
  const [user, data] = await Promise.all([requireUserPermission("admin.access"), getAdminIntegrationsData()]);

  return (
    <AdminShell
      title="Integrations"
      description="Readiness overview for PayPal, Brevo SMTP email, GIF search providers, stream-provider wiring, public URLs, and external app surfaces."
    >
      <div className="space-y-5">
        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <Badge tone="acid">Ready</Badge>
            <p className="mt-4 text-3xl font-black">
              {data.readyCount}/{data.totalCount}
            </p>
            <p className="mt-2 text-sm text-bc-muted">Integration groups fully configured.</p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <Badge tone={data.attentionCount ? "amber" : "acid"}>Attention</Badge>
            <p className="mt-4 text-3xl font-black">{data.attentionCount}</p>
            <p className="mt-2 text-sm text-bc-muted">Groups with missing or partial setup.</p>
          </article>
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <Badge tone="cyan">Control</Badge>
            <p className="mt-4 text-3xl font-black">Env + DB</p>
            <p className="mt-2 text-sm text-bc-muted">Secrets stay in environment; safe settings live in admin panels.</p>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          {data.groups.map((group) => {
            const Icon = groupIcon(group.id);

            return (
              <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={group.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Badge tone={statusTone(group.status)}>{group.statusLabel}</Badge>
                    <p className="mt-4 text-xs font-semibold uppercase text-bc-muted">{group.eyebrow}</p>
                    <h3 className="mt-1 text-2xl font-black">{group.title}</h3>
                    <p className="mt-2 max-w-2xl text-sm text-bc-muted">{group.description}</p>
                  </div>
                  <Icon className="h-7 w-7 text-bc-electric" aria-hidden="true" />
                </div>

                <div className="mt-5 grid gap-3">
                  {group.checks.map((item) => (
                    <div className="grid gap-2 border-t border-bc-line pt-3 md:grid-cols-[1fr_auto]" key={item.label}>
                      <div>
                        <p className="font-semibold">{item.label}</p>
                        <p className="mt-1 text-sm text-bc-muted">{item.detail}</p>
                      </div>
                      <div className="md:text-right">
                        <Badge tone={statusTone(item.status)}>{item.value}</Badge>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 border-t border-bc-line pt-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-bc-acid" aria-hidden="true" />
                    <h4 className="font-semibold">Connected surfaces</h4>
                  </div>
                  <div className="mt-3 grid gap-3">
                    {group.surfaces.map((surface) => (
                      <a
                        className="bc-focus-ring rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm transition hover:border-bc-electric/60"
                        href={surface.href}
                        key={`${group.id}-${surface.label}`}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-semibold">{surface.label}</span>
                          <ExternalLink className="h-4 w-4 text-bc-muted" aria-hidden="true" />
                        </span>
                        <span className="mt-1 block text-bc-muted">{surface.detail}</span>
                      </a>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <ButtonLink href={group.primaryHref} variant="ghost">
                    <Settings2 className="h-4 w-4" aria-hidden="true" />
                    {group.primaryLabel}
                  </ButtonLink>
                  {group.status === "ready" ? (
                    <div className="inline-flex min-h-10 items-center gap-2 text-sm text-bc-muted">
                      <BadgeCheck className="h-4 w-4 text-bc-acid" aria-hidden="true" />
                      No required setup missing
                    </div>
                  ) : null}
                </div>

                {group.id === "mail" ? <AdminEmailTestForm defaultRecipientEmail={user.email} /> : null}
                {group.id === "gifs" ? <GifProviderSettingsForm data={data.gifProviders} /> : null}
              </article>
            );
          })}
        </section>
      </div>
    </AdminShell>
  );
}
