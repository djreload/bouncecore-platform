import { Clock, Crown, Plus, ShoppingBag, Sparkles, Wallet, X } from "lucide-react";
import { grantSupporterRoleAction, removeSupporterRoleAction } from "@/app/admin/supporters/actions";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdminSupportersData } from "@/lib/admin/supporters";
import { requireUserPermission } from "@/lib/auth/guards";
import { roleBadgeTone, roleDisplayName } from "@/lib/auth/role-display";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null) {
  return date ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Not yet";
}

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

function statusTone(status: string) {
  if (status === "active") {
    return "acid" as const;
  }

  if (status === "pending") {
    return "amber" as const;
  }

  return "pink" as const;
}

export default async function AdminSupportersPage() {
  await requireUserPermission("admin.access");
  const [data, roleDisplayLabels] = await Promise.all([getAdminSupportersData(), getRoleDisplayNameOverrides()]);
  const supporterRoleLabel = roleDisplayName("supporter", roleDisplayLabels);

  return (
    <AdminShell
      title="VIP supporters"
      description="Supporter role control, stars balances, order activity, and VIP account visibility."
    >
      <div className="mb-5 grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">{supporterRoleLabel}</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.supporters}</p>
          <p className="mt-2 text-sm text-bc-muted">Total VIP/supporter role grants.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Active</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.activeSupporters}</p>
          <p className="mt-2 text-sm text-bc-muted">Supporters currently allowed to sign in.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Stars</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.totalStars.toLocaleString("en-GB")}</p>
          <p className="mt-2 text-sm text-bc-muted">Combined supporter wallet balance.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Spend</Badge>
          <p className="mt-4 text-3xl font-black">{formatMoney(data.stats.totalSpendPence)}</p>
          <p className="mt-2 text-sm text-bc-muted">Combined order value from supporters.</p>
        </article>
      </div>

      <section className="mb-5 rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Grant access</Badge>
            <h3 className="mt-4 text-2xl font-black">Add supporter role</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Grant VIP/supporter access to an active or pending account and create their stars wallet if needed.
            </p>
          </div>
          <form action={grantSupporterRoleAction} className="flex w-full flex-wrap gap-3 md:w-auto">
            <select
              className="min-h-10 min-w-[280px] rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              disabled={!data.candidates.length}
              name="userId"
              required
            >
              <option value="">Choose user</option>
              {data.candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.displayName} ({candidate.email})
                </option>
              ))}
            </select>
            <Button disabled={!data.candidates.length} type="submit" variant="primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Grant
            </Button>
          </form>
        </div>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bc-line p-4">
          <div className="flex items-center gap-3">
            <Crown className="h-6 w-6 text-bc-pink" aria-hidden="true" />
            <div>
              <h3 className="text-xl font-black">Supporter directory</h3>
              <p className="mt-1 text-sm text-bc-muted">Role badges, account state, stars, orders, and last login.</p>
            </div>
          </div>
          <Badge tone="acid">Database-backed</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead className="text-bc-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Supporter</th>
                <th className="px-4 py-3 font-semibold">Roles</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Stars</th>
                <th className="px-4 py-3 font-semibold">Orders</th>
                <th className="px-4 py-3 font-semibold">Last login</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.supporters.map((supporter) => (
                <tr className="border-t border-bc-line align-top" key={supporter.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-bc-pink" aria-hidden="true" />
                      <span className="font-semibold">{supporter.displayName}</span>
                    </div>
                    <p className="mt-1 text-xs text-bc-muted">{supporter.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {supporter.roles.map((role) => (
                        <Badge key={role} tone={roleBadgeTone(role)}>
                          {roleDisplayName(role, roleDisplayLabels)}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(supporter.status)}>{supporter.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-bc-muted">
                      <Wallet className="h-4 w-4" aria-hidden="true" />
                      {supporter.stars.toLocaleString("en-GB")}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-bc-muted">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                      {supporter.orders} / {formatMoney(supporter.spendPence)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-bc-muted">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      {formatDate(supporter.lastLoginAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <form action={removeSupporterRoleAction}>
                      <input name="userId" type="hidden" value={supporter.id} />
                      <Button size="sm" type="submit" variant="pink">
                        <X className="h-4 w-4" aria-hidden="true" />
                        Remove
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
              {!data.supporters.length ? (
                <tr className="border-t border-bc-line">
                  <td className="px-4 py-8 text-center text-bc-muted" colSpan={7}>
                    No supporter roles have been granted yet.
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
