"use client";

import { useActionState, useMemo, useState } from "react";
import { Copy, KeyRound, RefreshCw, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { adminStreamKeyAction } from "@/app/admin/stream-keys/actions";
import { roleBadgeTone, roleDisplayName } from "@/lib/auth/role-display";
import {
  initialAdminStreamKeyActionState,
  type AdminStreamKeyActionState,
  type AdminStreamKeyRow,
  type AdminStreamKeyUserOption
} from "@/app/admin/stream-keys/state";

type AdminStreamKeysPanelProps = {
  keys: AdminStreamKeyRow[];
  users: AdminStreamKeyUserOption[];
  canRevealRawKeys: boolean;
};

function formatDate(date: string | null) {
  return date
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date))
    : "Not yet";
}

function statusTone(status: string) {
  if (status === "active") {
    return "acid" as const;
  }

  if (status === "rotated") {
    return "amber" as const;
  }

  return "muted" as const;
}

export function AdminStreamKeysPanel({ keys, users, canRevealRawKeys }: AdminStreamKeysPanelProps) {
  const [state, formAction, pending] = useActionState<AdminStreamKeyActionState, FormData>(
    adminStreamKeyAction,
    initialAdminStreamKeyActionState
  );
  const [copied, setCopied] = useState(false);
  const activeKeyCount = keys.filter((key) => key.status === "active" && !key.revokedAt).length;
  const availableUsers = useMemo(() => users.filter((user) => !user.hasActiveKey), [users]);

  async function copyRawKey() {
    if (!state.rawKey) {
      return;
    }

    await navigator.clipboard.writeText(state.rawKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Keys</Badge>
          <p className="mt-4 text-3xl font-black">{keys.length}</p>
          <p className="mt-2 text-sm text-bc-muted">Total stream-key records.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Active</Badge>
          <p className="mt-4 text-3xl font-black">{activeKeyCount}</p>
          <p className="mt-2 text-sm text-bc-muted">Currently usable ingest keys.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={canRevealRawKeys ? "pink" : "amber"}>{canRevealRawKeys ? "Raw reveal allowed" : "Raw reveal blocked"}</Badge>
          <p className="mt-4 text-3xl font-black">{availableUsers.length}</p>
          <p className="mt-2 text-sm text-bc-muted">Users without an active key.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Owner/Admin</Badge>
            <h3 className="mt-4 text-2xl font-black">Create stream key</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Create keys for approved creators from the control room. Existing active keys must be rotated from the table.
            </p>
          </div>
          <form action={formAction} className="flex w-full flex-wrap gap-3 md:w-auto">
            <input name="intent" type="hidden" value="create" />
            <select
              className="min-h-10 min-w-[260px] rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              disabled={pending || !availableUsers.length || !canRevealRawKeys}
              name="userId"
              required
            >
              <option value="">Choose user</option>
              {availableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName} ({user.email})
                </option>
              ))}
            </select>
            <Button disabled={pending || !availableUsers.length || !canRevealRawKeys} type="submit" variant="ghost">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Create
            </Button>
          </form>
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

        {state.rawKey ? (
          <div className="mt-5 rounded-md border border-bc-acid/35 bg-bc-acid/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone="acid">Copy now</Badge>
              <button className="inline-flex items-center gap-2 text-sm font-semibold text-bc-acid hover:text-white" onClick={copyRawKey} type="button">
                <Copy className="h-4 w-4" aria-hidden="true" />
                {copied ? "Copied" : "Copy key"}
              </button>
            </div>
            <p className="mt-3 break-all font-mono text-sm text-white">{state.rawKey}</p>
          </div>
        ) : null}
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel">
        <div className="border-b border-bc-line p-4">
          <h3 className="text-xl font-black">Stream-key directory</h3>
          <p className="mt-1 text-sm text-bc-muted">Fingerprints, owners, statuses, and admin actions.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="text-bc-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 font-semibold">Fingerprint</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold">Last used</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => {
                const active = key.status === "active" && !key.revokedAt;

                return (
                  <tr className="border-t border-bc-line" key={key.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{key.userDisplayName}</p>
                      <p className="mt-1 text-xs text-bc-muted">{key.userEmail}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {key.userRoles.map((role) => (
                          <Badge key={role} tone={roleBadgeTone(role)}>
                            {roleDisplayName(role)}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-bc-muted">{key.fingerprint}</td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(key.status)}>{key.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-bc-muted">{formatDate(key.createdAt)}</td>
                    <td className="px-4 py-3 text-bc-muted">{formatDate(key.lastUsedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <form action={formAction}>
                          <input name="intent" type="hidden" value="rotate" />
                          <input name="userId" type="hidden" value={key.userId} />
                          <Button disabled={pending || !canRevealRawKeys} size="sm" type="submit" variant="dark">
                            <RefreshCw className="h-4 w-4" aria-hidden="true" />
                            Rotate
                          </Button>
                        </form>
                        <form action={formAction}>
                          <input name="intent" type="hidden" value="revoke" />
                          <input name="keyId" type="hidden" value={key.id} />
                          <Button disabled={pending || !active} size="sm" type="submit" variant="pink">
                            <ShieldOff className="h-4 w-4" aria-hidden="true" />
                            Revoke
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!keys.length ? (
                <tr className="border-t border-bc-line">
                  <td className="px-4 py-8 text-center text-bc-muted" colSpan={6}>
                    No stream keys have been created yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
