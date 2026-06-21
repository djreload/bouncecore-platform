import type { LucideIcon } from "lucide-react";
import { Activity, Bell, CheckCircle2, Clock, Mail, Smartphone, Trash2, TriangleAlert } from "lucide-react";
import { clearNotificationLogsAction } from "@/app/admin/notification-logs/actions";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clearNotificationLogsConfirmationText } from "@/lib/admin/maintenance-core";
import { getAdminNotificationLogData } from "@/lib/admin/notification-log-service";
import { requireUserPermission } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

type BadgeTone = React.ComponentProps<typeof Badge>["tone"];

function formatDate(value: string | null) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(
    new Date(value)
  );
}

function statusTone(status: string): BadgeTone {
  if (["sent", "delivered", "read"].includes(status)) {
    return "acid";
  }

  if (["queued", "not sent", "blocked"].includes(status)) {
    return "amber";
  }

  if (["failed", "error"].includes(status)) {
    return "pink";
  }

  return "muted";
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

export default async function AdminNotificationLogsPage() {
  await requireUserPermission("mobile.manage");
  const data = await getAdminNotificationLogData();

  return (
    <AdminShell
      title="Notification logs"
      description="Inspect account notifications, email delivery outcomes, and mobile push delivery state."
      requiredPermission="mobile.manage"
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            detail="Account notification records stored."
            icon={Bell}
            label="Notifications"
            tone="cyan"
            value={data.stats.totalNotifications}
          />
          <StatCard
            detail="Notification records created today."
            icon={Clock}
            label="Today"
            tone="acid"
            value={data.stats.notificationsToday}
          />
          <StatCard detail="Successful email events logged." icon={Mail} label="Emails sent" tone="acid" value={data.stats.emailsSent} />
          <StatCard
            detail="Skipped or unavailable email sends."
            icon={TriangleAlert}
            label="Email skips"
            tone={data.stats.emailsSkipped ? "amber" : "muted"}
            value={data.stats.emailsSkipped}
          />
          <StatCard
            detail="Mobile pushes waiting to be processed."
            icon={Smartphone}
            label="Queued push"
            tone={data.stats.queuedPushDeliveries ? "amber" : "muted"}
            value={data.stats.queuedPushDeliveries}
          />
          <StatCard detail="Accepted by push provider." icon={CheckCircle2} label="Sent push" tone="acid" value={data.stats.sentPushDeliveries} />
          <StatCard
            detail="Provider receipt confirmed delivery."
            icon={CheckCircle2}
            label="Delivered"
            tone="acid"
            value={data.stats.deliveredPushDeliveries}
          />
          <StatCard
            detail="Failed or blocked mobile delivery rows."
            icon={Activity}
            label="Push issues"
            tone={data.stats.failedPushDeliveries + data.stats.blockedPushDeliveries ? "pink" : "muted"}
            value={data.stats.failedPushDeliveries + data.stats.blockedPushDeliveries}
          />
        </div>

        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge tone="pink">Maintenance</Badge>
              <h3 className="mt-4 text-xl font-black">Clear notification logs</h3>
              <p className="mt-2 max-w-2xl text-sm text-bc-muted">
                Deletes stored in-app notification rows, mobile push delivery rows, and email delivery audit events.
              </p>
            </div>
            <form action={clearNotificationLogsAction} className="flex flex-wrap gap-2">
              <input
                className="min-h-10 w-64 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                name="confirmation"
                placeholder={clearNotificationLogsConfirmationText}
              />
              <Button disabled={!data.stats.totalNotifications && !data.stats.emailEvents} type="submit" variant="pink">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Clear notification logs
              </Button>
            </form>
          </div>
        </section>

        <section className="rounded-md border border-bc-line bg-bc-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
            <div>
              <h3 className="text-xl font-black">Email events</h3>
              <p className="mt-1 text-sm text-bc-muted">Audit records for Brevo SMTP and account email sends.</p>
            </div>
            <Badge tone="muted">{data.stats.emailEvents} logged</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-bc-line text-left text-sm">
              <thead className="bg-bc-ink text-xs uppercase text-bc-muted">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bc-line">
                {data.emailEvents.map((event) => (
                  <tr className="align-top" key={event.id}>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(event.status)}>{event.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{event.type ?? event.action}</p>
                      {event.configured !== null ? (
                        <p className="mt-1 text-xs text-bc-muted">SMTP {event.configured ? "configured" : "not configured"}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-bc-muted">{event.target ?? "System"}</td>
                    <td className="px-4 py-3 text-bc-muted">{event.reason ?? "None"}</td>
                    <td className="px-4 py-3 text-bc-muted">{formatDate(event.createdAt)}</td>
                  </tr>
                ))}
                {!data.emailEvents.length ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-bc-muted" colSpan={5}>
                      Email delivery events will appear here after verification, checkout, or payout emails are attempted.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-md border border-bc-line bg-bc-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
            <div>
              <h3 className="text-xl font-black">Mobile push deliveries</h3>
              <p className="mt-1 text-sm text-bc-muted">Provider status, receipt state, and device details for queued mobile pushes.</p>
            </div>
            <Badge tone="muted">{data.pushDeliveries.length} recent</Badge>
          </div>
          <div className="grid gap-3 p-4">
            {data.pushDeliveries.map((delivery) => (
              <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={delivery.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={statusTone(delivery.status)}>{delivery.status}</Badge>
                      <Badge tone="muted">{delivery.provider}</Badge>
                      <Badge tone="muted">{delivery.platform}</Badge>
                      {delivery.receiptStatus ? <Badge tone={statusTone(delivery.receiptStatus)}>{delivery.receiptStatus}</Badge> : null}
                    </div>
                    <h4 className="mt-3 font-black">{delivery.notificationTitle}</h4>
                    <p className="mt-1 text-sm text-bc-muted">
                      {delivery.userDisplayName} / {delivery.userEmail}
                    </p>
                    <p className="mt-1 text-xs text-bc-muted">
                      {delivery.deviceName ?? "Unnamed device"} / {delivery.tokenPreview}
                    </p>
                    {delivery.errorMessage ? (
                      <p className="mt-3 rounded-md border border-bc-pink/30 bg-bc-pink/10 p-3 text-sm text-bc-pink">
                        {delivery.errorCode ? `${delivery.errorCode}: ` : ""}
                        {delivery.errorMessage}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right text-xs text-bc-muted">
                    <p>Created {formatDate(delivery.createdAt)}</p>
                    <p className="mt-1">Attempted {formatDate(delivery.attemptedAt)}</p>
                    <p className="mt-1">Sent {formatDate(delivery.sentAt)}</p>
                    <p className="mt-1">Receipt {formatDate(delivery.receiptCheckedAt)}</p>
                  </div>
                </div>
              </article>
            ))}
            {!data.pushDeliveries.length ? (
              <div className="rounded-md border border-bc-line bg-bc-ink p-5 text-sm text-bc-muted">
                Mobile push delivery rows will appear after users register devices and notifications are sent.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-md border border-bc-line bg-bc-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
            <div>
              <h3 className="text-xl font-black">Recent account notifications</h3>
              <p className="mt-1 text-sm text-bc-muted">The latest in-app notification records stored for user accounts.</p>
            </div>
            <Badge tone="muted">{data.recentNotifications.length} recent</Badge>
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {data.recentNotifications.map((notification) => (
              <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={notification.id}>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={notification.readAt ? "muted" : "acid"}>{notification.readAt ? "read" : "unread"}</Badge>
                  <Badge tone="muted">{notification.type}</Badge>
                  <Badge tone={notification.pushDeliveryCount ? "cyan" : "muted"}>{notification.pushDeliveryCount} push rows</Badge>
                </div>
                <h4 className="mt-3 font-black">{notification.title}</h4>
                {notification.body ? <p className="mt-2 text-sm text-bc-muted">{notification.body}</p> : null}
                <p className="mt-3 text-xs text-bc-muted">
                  {notification.userDisplayName} / {notification.userEmail}
                </p>
                <p className="mt-1 text-xs text-bc-muted">{formatDate(notification.createdAt)}</p>
              </article>
            ))}
            {!data.recentNotifications.length ? (
              <div className="rounded-md border border-bc-line bg-bc-ink p-5 text-sm text-bc-muted">
                Account notifications will appear here once generated.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
