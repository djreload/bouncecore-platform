"use client";

import { useActionState } from "react";
import { Navigation, Save } from "lucide-react";
import { adminMenusAction } from "@/app/admin/menus/actions";
import { initialAdminSiteDesignActionState, type AdminSiteDesignActionState } from "@/app/admin/site-design-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminSiteMenusData } from "@/lib/admin/site-design-service";

type AdminMenusPanelProps = {
  data: AdminSiteMenusData;
};

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not saved";
}

export function AdminMenusPanel({ data }: AdminMenusPanelProps) {
  const [state, formAction, pending] = useActionState<AdminSiteDesignActionState, FormData>(
    adminMenusAction,
    initialAdminSiteDesignActionState
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.source === "database" ? "acid" : "amber"}>Source</Badge>
          <p className="mt-4 text-3xl font-black capitalize">{data.source}</p>
          <p className="mt-2 text-sm text-bc-muted">{formatDate(data.stats.updatedAt)}</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Menu items</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.total}</p>
          <p className="mt-2 text-sm text-bc-muted">Public header links available to edit.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Visible</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.enabled}</p>
          <p className="mt-2 text-sm text-bc-muted">Links currently shown in the public header.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Editable menu</Badge>
            <h3 className="mt-4 text-2xl font-black">Public header navigation</h3>
            <p className="mt-2 max-w-3xl text-sm text-bc-muted">
              These labels, order values, and visibility toggles are applied to the public site header.
            </p>
          </div>
          <Navigation className="h-7 w-7 text-bc-pink" aria-hidden="true" />
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

        <form action={formAction} className="mt-5 grid gap-3">
          {data.items.map((item) => (
            <article className="grid gap-4 rounded-md border border-bc-line bg-bc-ink p-4 lg:grid-cols-[90px_1fr_120px_160px]" key={item.key}>
              <input name="menuKey" type="hidden" value={item.key} />
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`order-${item.key}`}>
                  Order
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={item.order}
                  disabled={pending}
                  id={`order-${item.key}`}
                  min={1}
                  name={`order_${item.key}`}
                  type="number"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`label-${item.key}`}>
                  Label
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={item.label}
                  disabled={pending}
                  id={`label-${item.key}`}
                  name={`label_${item.key}`}
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-bc-muted">Icon</p>
                <div className="mt-2 min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-bc-muted">{item.icon}</div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-bc-muted">Visibility</p>
                <label className="mt-2 flex min-h-10 items-center gap-2 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm">
                  <input defaultChecked={item.enabled} disabled={pending} name={`enabled_${item.key}`} type="checkbox" />
                  Show in header
                </label>
              </div>
              <p className="text-sm text-bc-muted lg:col-span-4">{item.href}</p>
            </article>
          ))}

          <div>
            <Button disabled={pending} type="submit" variant="primary">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save menu settings
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
