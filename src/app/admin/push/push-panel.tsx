"use client";

import { useActionState } from "react";
import { BellRing, CheckCheck, RefreshCw, Send, UserRoundCheck, UsersRound } from "lucide-react";
import { adminCheckPushReceiptsAction, adminProcessPushQueueAction, adminPushAction } from "@/app/admin/push/actions";
import { initialAdminPushActionState, type AdminPushActionState } from "@/app/admin/push/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminPushData } from "@/lib/admin/push-service";

type AdminPushPanelProps = {
  data: AdminPushData;
};

const adminPushTargets = ["all", "role", "user"] as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function readTone(readAt: string | null) {
  return readAt ? ("muted" as const) : ("acid" as const);
}

function targetLabel(value: string) {
  if (value === "all") {
    return "All active users";
  }

  if (value === "role") {
    return "Role";
  }

  return "User";
}

export function AdminPushPanel({ data }: AdminPushPanelProps) {
  const [state, formAction, pending] = useActionState<AdminPushActionState, FormData>(
    adminPushAction,
    initialAdminPushActionState
  );
  const [queueState, queueFormAction, queuePending] = useActionState<AdminPushActionState, FormData>(
    adminProcessPushQueueAction,
    initialAdminPushActionState
  );
  const [receiptState, receiptFormAction, receiptPending] = useActionState<AdminPushActionState, FormData>(
    adminCheckPushReceiptsAction,
    initialAdminPushActionState
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Active users</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.activeUsers}</p>
          <p className="mt-2 text-sm text-bc-muted">Eligible recipients.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Mobile devices</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.activeMobileDevices}</p>
          <p className="mt-2 text-sm text-bc-muted">Active push registrations.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.stats.pushEncryptionConfigured ? "acid" : "amber"}>Push key</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.pushEncryptionConfigured ? "Ready" : "Missing"}</p>
          <p className="mt-2 text-sm text-bc-muted">{data.stats.deliverableMobileDevices} encrypted device tokens.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Queued</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.queuedPushDeliveries}</p>
          <p className="mt-2 text-sm text-bc-muted">Mobile pushes ready for delivery.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Accepted</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.sentPushDeliveries}</p>
          <p className="mt-2 text-sm text-bc-muted">Accepted by Expo, waiting for receipt.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Delivered</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.deliveredPushDeliveries}</p>
          <p className="mt-2 text-sm text-bc-muted">Receipt confirmed by provider.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Receipts</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.receiptPendingPushDeliveries}</p>
          <p className="mt-2 text-sm text-bc-muted">Sent pushes needing receipt checks.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Failed pushes</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.failedPushDeliveries}</p>
          <p className="mt-2 text-sm text-bc-muted">Rejected or network failed.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Blocked</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.blockedPushDeliveries}</p>
          <p className="mt-2 text-sm text-bc-muted">Pushes needing token encryption.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Sent today</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.sentToday}</p>
          <p className="mt-2 text-sm text-bc-muted">Notification records created today.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Unread</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.unreadNotifications}</p>
          <p className="mt-2 text-sm text-bc-muted">Unread account notifications.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Stored</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.totalNotifications}</p>
          <p className="mt-2 text-sm text-bc-muted">Total notification records.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Message</Badge>
            <h3 className="mt-4 text-2xl font-black">Send notification</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Notifications appear in each recipient account inbox and create mobile push delivery rows for active registered devices.
            </p>
          </div>
          <BellRing className="h-7 w-7 text-bc-pink" aria-hidden="true" />
        </div>

        {state.message ? (
          <div
            className={`mt-5 rounded-md border p-3 text-sm ${
              state.status === "error"
                ? "border-bc-pink/30 bg-bc-pink/10 text-bc-pink"
                : "border-bc-acid/30 bg-bc-acid/10 text-bc-acid"
            }`}
          >
            {state.message}
          </div>
        ) : null}

        {queueState.message ? (
          <div
            className={`mt-5 rounded-md border p-3 text-sm ${
              queueState.status === "error"
                ? "border-bc-pink/30 bg-bc-pink/10 text-bc-pink"
                : "border-bc-acid/30 bg-bc-acid/10 text-bc-acid"
            }`}
          >
            {queueState.message}
          </div>
        ) : null}

        {receiptState.message ? (
          <div
            className={`mt-5 rounded-md border p-3 text-sm ${
              receiptState.status === "error"
                ? "border-bc-pink/30 bg-bc-pink/10 text-bc-pink"
                : "border-bc-acid/30 bg-bc-acid/10 text-bc-acid"
            }`}
          >
            {receiptState.message}
          </div>
        ) : null}

        <div className="mt-5 rounded-md border border-bc-line bg-bc-ink p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="font-black">Mobile delivery queue</h4>
              <p className="mt-1 text-sm text-bc-muted">Processes up to 50 queued rows per run. Check Expo receipts after pushes have been accepted.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <form action={queueFormAction}>
                <Button disabled={queuePending || !data.stats.queuedPushDeliveries} type="submit" variant="ghost">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Process queue
                </Button>
              </form>
              <form action={receiptFormAction}>
                <Button disabled={receiptPending || !data.stats.receiptPendingPushDeliveries} type="submit" variant="ghost">
                  <CheckCheck className="h-4 w-4" aria-hidden="true" />
                  Check receipts
                </Button>
              </form>
            </div>
          </div>
        </div>

        <form action={formAction} className="mt-5 grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="push-target">
                Target
              </label>
              <select
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue="all"
                disabled={pending}
                id="push-target"
                name="target"
              >
                {adminPushTargets.map((target) => (
                  <option key={target} value={target}>
                    {targetLabel(target)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="push-role">
                Role target
              </label>
              <select
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.roles[0]?.key}
                disabled={pending}
                id="push-role"
                name="role"
              >
                {data.roles.map((role) => (
                  <option key={role.key} value={role.key}>
                    {role.label} ({role.activeUserCount})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="push-user">
                User target
              </label>
              <select
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.users.find((user) => user.status === "active")?.id ?? ""}
                disabled={pending}
                id="push-user"
                name="userId"
              >
                {data.users.map((user) => (
                  <option disabled={user.status !== "active"} key={user.id} value={user.id}>
                    {user.displayName} / {user.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="push-type">
                Type
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue="platform"
                disabled={pending}
                id="push-type"
                name="type"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="push-title">
                Title
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                disabled={pending}
                id="push-title"
                name="title"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="push-body">
              Body
            </label>
            <textarea
              className="mt-2 min-h-32 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              disabled={pending}
              id="push-body"
              name="body"
            />
          </div>

          <div>
            <Button disabled={pending || !data.stats.activeUsers} type="submit" variant="primary">
              <Send className="h-4 w-4" aria-hidden="true" />
              Send notification
            </Button>
          </div>
        </form>
      </section>

      <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex items-center gap-2">
            <UsersRound className="h-5 w-5 text-bc-electric" aria-hidden="true" />
            <h3 className="text-xl font-black">Role reach</h3>
          </div>
          <div className="mt-4 grid gap-3">
            {data.roles.map((role) => (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink p-3" key={role.key}>
                <div>
                  <p className="font-semibold">{role.label}</p>
                  <p className="mt-1 text-xs text-bc-muted">{role.key}</p>
                </div>
                <Badge tone={role.activeUserCount ? "acid" : "muted"}>{role.activeUserCount}</Badge>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-md border border-bc-line bg-bc-panel">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-bc-line p-4">
            <div className="flex items-center gap-2">
              <UserRoundCheck className="h-5 w-5 text-bc-acid" aria-hidden="true" />
              <h3 className="text-xl font-black">Recent notifications</h3>
            </div>
            <Badge tone="muted">{data.recentNotifications.length} rows</Badge>
          </div>
          <div className="grid gap-3 p-4">
            {data.recentNotifications.map((notification) => (
              <div className="rounded-md border border-bc-line bg-bc-ink p-4" key={notification.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={readTone(notification.readAt)}>{notification.readAt ? "read" : "unread"}</Badge>
                      <Badge tone="muted">{notification.type}</Badge>
                      {notification.pushDeliveryCount ? (
                        <>
                          <Badge tone="cyan">{notification.pushDeliveryCount} mobile</Badge>
                          {notification.pushQueuedCount ? <Badge tone="acid">{notification.pushQueuedCount} queued</Badge> : null}
                          {notification.pushSentCount ? <Badge tone="acid">{notification.pushSentCount} sent</Badge> : null}
                          {notification.pushReceiptPendingCount ? <Badge tone="cyan">{notification.pushReceiptPendingCount} receipt pending</Badge> : null}
                          {notification.pushDeliveredCount ? <Badge tone="acid">{notification.pushDeliveredCount} delivered</Badge> : null}
                          {notification.pushFailedCount ? <Badge tone="pink">{notification.pushFailedCount} failed</Badge> : null}
                          {notification.pushBlockedCount ? <Badge tone="amber">{notification.pushBlockedCount} blocked</Badge> : null}
                        </>
                      ) : (
                        <Badge tone="muted">no mobile devices</Badge>
                      )}
                    </div>
                    <h4 className="mt-3 font-black">{notification.title}</h4>
                    {notification.body ? <p className="mt-2 text-sm text-bc-muted">{notification.body}</p> : null}
                    <p className="mt-2 text-xs text-bc-muted">
                      {notification.userDisplayName} / {notification.userEmail}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-bc-muted">
                    <CheckCheck className="h-4 w-4" aria-hidden="true" />
                    {formatDate(notification.createdAt)}
                  </div>
                </div>
              </div>
            ))}
            {!data.recentNotifications.length ? (
              <div className="rounded-md border border-bc-line bg-bc-ink p-5 text-sm text-bc-muted">
                Sent notifications will appear here.
              </div>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}
