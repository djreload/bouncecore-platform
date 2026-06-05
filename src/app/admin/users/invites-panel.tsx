"use client";

import { useActionState, useState } from "react";
import { Ban, Check, Clipboard, Clock, Mail, Send, UserPlus } from "lucide-react";
import { createAdminUserInviteAction, revokeAdminUserInviteAction } from "@/app/admin/users/actions";
import {
  initialAdminUserInviteActionState,
  type AdminUserInviteActionState
} from "@/app/admin/users/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { roleBadgeTone, roleDisplayName } from "@/lib/auth/role-display";
import type { Role } from "@/lib/auth/rbac";
import type { AdminUserInvitesData } from "@/lib/auth/user-invite-service";

type InviteRoleOption = {
  description: string;
  key: Role;
  label: string;
};

type AdminUserInvitesPanelProps = {
  invites: AdminUserInvitesData;
  roleDisplayLabels: Record<string, string>;
  roles: InviteRoleOption[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function inviteStatusTone(status: string) {
  if (status === "accepted") {
    return "acid" as const;
  }

  if (status === "revoked") {
    return "pink" as const;
  }

  return "amber" as const;
}

function inviteIsRevocable(invite: AdminUserInvitesData[number]) {
  return invite.status === "pending" && !invite.acceptedAt && !invite.revokedAt && new Date(invite.expiresAt) > new Date();
}

export function AdminUserInvitesPanel({ invites, roleDisplayLabels, roles }: AdminUserInvitesPanelProps) {
  const [state, formAction, pending] = useActionState<AdminUserInviteActionState, FormData>(
    createAdminUserInviteAction,
    initialAdminUserInviteActionState
  );
  const [copied, setCopied] = useState(false);
  const roleOptions = roles.filter((role) => role.key !== "viewer");

  async function copyInviteUrl() {
    if (!state.inviteUrl) {
      return;
    }

    await navigator.clipboard.writeText(state.inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="mb-5 rounded-md border border-bc-line bg-bc-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
        <div>
          <h3 className="text-xl font-black">User invites</h3>
          <p className="mt-1 text-sm text-bc-muted">Create registration links with preselected roles and expiry.</p>
        </div>
        <Badge tone="cyan">{invites.length} recent</Badge>
      </div>

      <div className="grid gap-5 p-4 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <form action={formAction} className="grid gap-4 rounded-md border border-bc-line bg-bc-ink/50 p-4">
          <div>
            <label className="text-xs font-bold uppercase text-bc-muted" htmlFor="invite-email">
              Email
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-md border border-bc-line bg-bc-ink px-3 py-2">
              <Mail className="h-4 w-4 text-bc-muted" aria-hidden="true" />
              <input
                className="w-full bg-transparent text-sm text-white outline-none"
                id="invite-email"
                name="email"
                placeholder="person@example.com"
                required
                type="email"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <div>
              <label className="text-xs font-bold uppercase text-bc-muted" htmlFor="invite-note">
                Note
              </label>
              <input
                className="mt-2 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                id="invite-note"
                maxLength={240}
                name="note"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-bc-muted" htmlFor="invite-expires">
                Days
              </label>
              <input
                className="mt-2 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue="7"
                id="invite-expires"
                max={90}
                min={1}
                name="expiresDays"
                required
                type="number"
              />
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase text-bc-muted">Roles</p>
              <Badge tone="muted">Viewer included</Badge>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {roleOptions.map((role) => (
                <label
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm"
                  key={role.key}
                >
                  <input className="h-4 w-4 accent-bc-pink" name="roles" type="checkbox" value={role.key} />
                  {roleDisplayName(role.key, roleDisplayLabels)}
                </label>
              ))}
            </div>
          </div>

          <Button disabled={pending} type="submit" variant="primary">
            <Send className="h-4 w-4" aria-hidden="true" />
            {pending ? "Creating" : "Create invite"}
          </Button>

          {state.message ? (
            <div
              className={`rounded-md border p-3 text-sm ${
                state.status === "error" ? "border-bc-pink/30 bg-bc-pink/10 text-bc-pink" : "border-bc-acid/30 bg-bc-acid/10 text-bc-acid"
              }`}
            >
              {state.message}
            </div>
          ) : null}

          {state.inviteUrl ? (
            <div className="grid gap-2">
              <label className="text-xs font-bold uppercase text-bc-muted" htmlFor="invite-url">
                Invite link
              </label>
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-xs text-white"
                  id="invite-url"
                  readOnly
                  value={state.inviteUrl}
                />
                <Button onClick={copyInviteUrl} type="button" variant="ghost">
                  {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Clipboard className="h-4 w-4" aria-hidden="true" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          ) : null}
        </form>

        <div className="overflow-x-auto rounded-md border border-bc-line">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="text-bc-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Invite</th>
                <th className="px-4 py-3 font-semibold">Roles</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Dates</th>
                <th className="px-4 py-3 font-semibold">Manage</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr className="border-t border-bc-line align-top" key={invite.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-semibold">
                      <UserPlus className="h-4 w-4 text-bc-electric" aria-hidden="true" />
                      {invite.email}
                    </div>
                    <p className="mt-1 text-xs text-bc-muted">{invite.note || `Created by ${invite.createdByDisplayName}`}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {invite.roles.map((role) => (
                        <Badge key={role} tone={roleBadgeTone(role)}>
                          {roleDisplayName(role, roleDisplayLabels)}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={inviteStatusTone(invite.status)}>{invite.status}</Badge>
                    {invite.acceptedByDisplayName ? (
                      <p className="mt-2 text-xs text-bc-muted">Accepted by {invite.acceptedByDisplayName}</p>
                    ) : null}
                    {invite.revokedByDisplayName ? (
                      <p className="mt-2 text-xs text-bc-muted">Revoked by {invite.revokedByDisplayName}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-bc-muted">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      Created {formatDate(invite.createdAt)}
                    </div>
                    <p className="mt-1 text-xs">Expires {formatDate(invite.expiresAt)}</p>
                    {invite.acceptedAt ? <p className="mt-1 text-xs">Accepted {formatDate(invite.acceptedAt)}</p> : null}
                    {invite.revokedAt ? <p className="mt-1 text-xs">Revoked {formatDate(invite.revokedAt)}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    {inviteIsRevocable(invite) ? (
                      <form action={revokeAdminUserInviteAction}>
                        <input name="inviteId" type="hidden" value={invite.id} />
                        <Button size="sm" type="submit" variant="dark">
                          <Ban className="h-4 w-4" aria-hidden="true" />
                          Revoke
                        </Button>
                      </form>
                    ) : (
                      <Badge tone="muted">Closed</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {!invites.length ? (
                <tr className="border-t border-bc-line">
                  <td className="px-4 py-8 text-center text-bc-muted" colSpan={5}>
                    No invites have been created yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
