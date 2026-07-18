import { Bell, CheckCheck, Clock3, Settings2 } from "lucide-react";
import { ClearNotificationsForm } from "@/app/account/notifications/clear-notifications-form";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction
} from "@/app/account/notifications/actions";
import { clearNotificationInboxConfirmationText } from "@/lib/admin/maintenance-core";
import { requireSignedInUser } from "@/lib/auth/guards";
import { getAccountNotificationsData } from "@/lib/account/account-service";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(
    new Date(value)
  );
}

function notificationTone(readAt: string | null) {
  return readAt ? ("muted" as const) : ("acid" as const);
}

export default async function AccountNotificationsPage() {
  const user = await requireSignedInUser();
  const data = await getAccountNotificationsData(user.id);

  return (
    <DashboardShell title="Notifications" description="Account alerts, platform updates, and purchase notifications.">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Total</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.total}</p>
          <p className="mt-2 text-sm text-bc-muted">Stored notifications.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Unread</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.unread}</p>
          <p className="mt-2 text-sm text-bc-muted">Require attention.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="muted">Read</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.read}</p>
          <p className="mt-2 text-sm text-bc-muted">Already acknowledged.</p>
        </article>
      </div>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Inbox</Badge>
            <h3 className="mt-4 text-2xl font-black">Notification inbox</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Bouncecore notifications are kept in your account history and can be marked read when handled.
            </p>
          </div>
          <Bell className="h-7 w-7 text-bc-pink" aria-hidden="true" />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/account/preferences" variant="ghost">
            <Settings2 className="h-4 w-4" aria-hidden="true" />
            Delivery settings
          </ButtonLink>
          <form action={markAllNotificationsReadAction}>
            <Button disabled={!data.stats.unread} type="submit" variant="primary">
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              Mark all read
            </Button>
          </form>
          <ClearNotificationsForm confirmationText={clearNotificationInboxConfirmationText} disabled={!data.stats.total} />
        </div>
      </section>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel">
        <div className="border-b border-bc-line p-4">
          <h3 className="text-xl font-black">Recent notifications</h3>
        </div>
        <div className="grid gap-4 p-4">
          {data.notifications.map((notification) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={notification.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={notificationTone(notification.readAt)}>{notification.readAt ? "read" : "unread"}</Badge>
                    <Badge tone="muted">{notification.type}</Badge>
                  </div>
                  <h4 className="mt-3 text-lg font-black">{notification.title}</h4>
                  {notification.body ? <p className="mt-2 text-sm text-bc-muted">{notification.body}</p> : null}
                  <p className="mt-2 text-xs text-bc-muted">{formatDate(notification.createdAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {notification.actionUrl ? (
                    <ButtonLink href={notification.actionUrl} size="sm" variant="primary">
                      Open
                    </ButtonLink>
                  ) : null}
                  {!notification.readAt ? (
                    <form action={markNotificationReadAction}>
                      <input name="notificationId" type="hidden" value={notification.id} />
                      <Button size="sm" type="submit" variant="ghost">
                        Mark read
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            </article>
          ))}

          {!data.notifications.length ? (
            <article className="rounded-md border border-bc-line bg-bc-ink p-5">
              <Clock3 className="h-7 w-7 text-bc-acid" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-black">No notifications yet</h3>
              <p className="mt-2 text-sm text-bc-muted">Account alerts and platform updates will appear here.</p>
            </article>
          ) : null}
        </div>
      </section>
    </DashboardShell>
  );
}
