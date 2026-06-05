"use client";

import { useActionState } from "react";
import { FileText, Save } from "lucide-react";
import { adminPagesAction } from "@/app/admin/pages/actions";
import { initialAdminSiteDesignActionState, type AdminSiteDesignActionState } from "@/app/admin/site-design-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminSitePagesData } from "@/lib/admin/site-design-service";

type AdminPagesPanelProps = {
  data: AdminSitePagesData;
};

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not saved";
}

export function AdminPagesPanel({ data }: AdminPagesPanelProps) {
  const [state, formAction, pending] = useActionState<AdminSiteDesignActionState, FormData>(
    adminPagesAction,
    initialAdminSiteDesignActionState
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.source === "database" ? "acid" : "amber"}>Source</Badge>
          <p className="mt-4 text-3xl font-black capitalize">{data.source}</p>
          <p className="mt-2 text-sm text-bc-muted">{formatDate(data.stats.updatedAt)}</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Pages</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.total}</p>
          <p className="mt-2 text-sm text-bc-muted">Public routes in the stage-1 registry.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Enabled</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.enabled}</p>
          <p className="mt-2 text-sm text-bc-muted">Pages marked active for public presentation.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Featured</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.featured}</p>
          <p className="mt-2 text-sm text-bc-muted">Cards shown on the homepage module grid.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Editable pages</Badge>
            <h3 className="mt-4 text-2xl font-black">Public page registry</h3>
            <p className="mt-2 max-w-3xl text-sm text-bc-muted">
              Titles and descriptions feed the homepage feature cards. Enabled and featured flags control which cards appear.
            </p>
          </div>
          <FileText className="h-7 w-7 text-bc-pink" aria-hidden="true" />
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

        <form action={formAction} className="mt-5 grid gap-4">
          {data.pages.map((page) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={page.key}>
              <input name="pageKey" type="hidden" value={page.key} />
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Badge tone={page.tone}>{page.href}</Badge>
                  <h4 className="mt-3 text-lg font-black">{page.defaultTitle}</h4>
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <label className="flex items-center gap-2 rounded-md border border-bc-line bg-bc-panel px-3 py-2">
                    <input defaultChecked={page.enabled} disabled={pending} name={`enabled_${page.key}`} type="checkbox" />
                    Enabled
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-bc-line bg-bc-panel px-3 py-2">
                    <input defaultChecked={page.featured} disabled={pending} name={`featured_${page.key}`} type="checkbox" />
                    Homepage card
                  </label>
                </div>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
                <div>
                  <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`title-${page.key}`}>
                    Page title
                  </label>
                  <input
                    className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={page.title}
                    disabled={pending}
                    id={`title-${page.key}`}
                    name={`title_${page.key}`}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor={`description-${page.key}`}>
                    Description
                  </label>
                  <textarea
                    className="mt-2 min-h-24 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={page.description}
                    disabled={pending}
                    id={`description-${page.key}`}
                    name={`description_${page.key}`}
                  />
                </div>
              </div>
            </article>
          ))}

          <div>
            <Button disabled={pending} type="submit" variant="primary">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save page settings
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
