import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Clock3, Database, FileJson, LinkIcon, ShieldCheck } from "lucide-react";
import { WebhookRetryForm } from "@/app/admin/payments/webhook-retry-form";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireUserPermission } from "@/lib/auth/guards";
import { getPayPalWebhookEventDetail } from "@/lib/payments/paypal-webhook-service";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not processed";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatMoney(pence: number | undefined) {
  if (typeof pence !== "number") {
    return null;
  }

  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

function statusTone(status: string) {
  if (["failed", "denied", "blocked", "returned", "canceled"].includes(status)) {
    return "pink" as const;
  }

  if (["received", "retrying", "pending", "processing", "onhold"].includes(status)) {
    return "amber" as const;
  }

  if (status === "verified" || status === "success" || status.includes("paid") || status.includes("updated")) {
    return "acid" as const;
  }

  return "muted" as const;
}

export default async function AdminPayPalWebhookDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  await requireUserPermission("payments.manage");
  const { eventId } = await params;
  const event = await getPayPalWebhookEventDetail(eventId);

  if (!event) {
    notFound();
  }

  return (
    <AdminShell
      title="PayPal Webhook"
      description="Inspect stored PayPal webhook payloads, linked checkout records, retry status, and audit history."
      requiredPermission="payments.manage"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ButtonLink href="/admin/payments" variant="ghost">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to payments
          </ButtonLink>
          <div className="flex flex-wrap gap-2">
            <Badge tone={statusTone(event.verificationStatus)}>{event.verificationStatus}</Badge>
            <Badge tone={statusTone(event.processingStatus)}>{event.processingStatus}</Badge>
          </div>
        </div>

        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge tone="cyan">{event.eventType}</Badge>
              <h3 className="mt-4 text-2xl font-black">{event.paypalEventId}</h3>
              <p className="mt-2 break-all text-sm text-bc-muted">Transmission: {event.transmissionId ?? "Not supplied"}</p>
            </div>
            {event.retryable ? (
              <WebhookRetryForm eventId={event.id} />
            ) : (
              <Badge tone="muted">Retry unavailable</Badge>
            )}
          </div>

          {event.errorMessage ? (
            <div className="mt-5 rounded-md border border-bc-pink/30 bg-bc-pink/10 p-4 text-sm text-bc-pink">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Last processing error
              </div>
              <p className="mt-2">{event.errorMessage}</p>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Clock3 className="h-5 w-5 text-bc-electric" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold">Received</p>
              <p className="mt-1 text-sm text-bc-muted">{formatDateTime(event.createdAt)}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <ShieldCheck className="h-5 w-5 text-bc-acid" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold">Processed</p>
              <p className="mt-1 text-sm text-bc-muted">{formatDateTime(event.processedAt)}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Database className="h-5 w-5 text-bc-pink" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold">Resource</p>
              <p className="mt-1 break-all text-sm text-bc-muted">{event.resourceType ?? "Unknown"}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <LinkIcon className="h-5 w-5 text-bc-amber" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold">Resource ID</p>
              <p className="mt-1 break-all text-sm text-bc-muted">{event.resourceId ?? "Not supplied"}</p>
            </article>
          </div>
        </section>

        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge tone="amber">Linked records</Badge>
              <h3 className="mt-4 text-xl font-black">Local checkout or payout matches</h3>
            </div>
            <Badge tone="muted">{event.linkedRecords.length} found</Badge>
          </div>
          <div className="mt-5 grid gap-3">
            {event.linkedRecords.map((record) => (
              <a className="rounded-md border border-bc-line bg-bc-ink p-4 transition hover:border-bc-electric" href={record.href} key={`${record.type}:${record.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="cyan">{record.type}</Badge>
                      <Badge tone={statusTone(record.status)}>{record.status}</Badge>
                    </div>
                    <h4 className="mt-3 font-black">{record.label}</h4>
                    <p className="mt-1 break-all text-xs text-bc-muted">
                      {record.id}
                      {record.reference ? ` / ${record.reference}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-sm text-bc-muted">
                    {formatMoney(record.amountPence) ? <p className="font-black text-white">{formatMoney(record.amountPence)}</p> : null}
                    <p className="mt-1">{formatDateTime(record.createdAt)}</p>
                  </div>
                </div>
              </a>
            ))}
            {!event.linkedRecords.length ? (
              <div className="rounded-md border border-bc-line bg-bc-ink p-4 text-sm text-bc-muted">
                No local order, stars, music, or payout record matched the IDs inside this PayPal payload.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge tone="pink">Audit trail</Badge>
              <h3 className="mt-4 text-xl font-black">Webhook processing history</h3>
            </div>
            <Badge tone="muted">{event.auditTrail.length} entries</Badge>
          </div>
          <div className="mt-5 grid gap-3">
            {event.auditTrail.map((item) => (
              <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge tone={statusTone(item.severity)}>{item.severity}</Badge>
                    <h4 className="mt-3 font-black">{item.action}</h4>
                    <p className="mt-1 text-xs text-bc-muted">{item.actorName ?? "System"} / {formatDateTime(item.createdAt)}</p>
                  </div>
                </div>
                <pre className="mt-3 max-h-72 overflow-auto rounded-md border border-bc-line bg-black/40 p-3 text-xs text-bc-muted">
                  {item.metadataPreview}
                </pre>
              </article>
            ))}
            {!event.auditTrail.length ? (
              <div className="rounded-md border border-bc-line bg-bc-ink p-4 text-sm text-bc-muted">
                No audit entries are linked to this PayPal event yet.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-bc-electric" aria-hidden="true" />
            <h3 className="text-xl font-black">Stored payload</h3>
          </div>
          <pre className="mt-5 max-h-[620px] overflow-auto rounded-md border border-bc-line bg-black/50 p-4 text-xs leading-relaxed text-bc-muted">
            {event.payloadPreview}
          </pre>
        </section>
      </div>
    </AdminShell>
  );
}
