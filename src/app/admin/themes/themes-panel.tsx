"use client";

import { useActionState } from "react";
import { Palette, Save } from "lucide-react";
import { adminThemesAction } from "@/app/admin/themes/actions";
import { initialAdminSiteDesignActionState, type AdminSiteDesignActionState } from "@/app/admin/site-design-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminSiteThemeData } from "@/lib/admin/site-design-service";

type AdminThemesPanelProps = {
  data: AdminSiteThemeData;
};

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not saved";
}

export function AdminThemesPanel({ data }: AdminThemesPanelProps) {
  const [state, formAction, pending] = useActionState<AdminSiteDesignActionState, FormData>(
    adminThemesAction,
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
          <Badge tone="cyan">Tokens</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.total}</p>
          <p className="mt-2 text-sm text-bc-muted">Active CSS colour tokens.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.stats.changed ? "amber" : "acid"}>Changed</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.changed}</p>
          <p className="mt-2 text-sm text-bc-muted">Tokens different from the design-system defaults.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Editable theme</Badge>
            <h3 className="mt-4 text-2xl font-black">Colour tokens</h3>
            <p className="mt-2 max-w-3xl text-sm text-bc-muted">
              Saved values override the CSS variables used by the public, account, streamer, producer, and admin shells.
            </p>
          </div>
          <Palette className="h-7 w-7 text-bc-pink" aria-hidden="true" />
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
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.tokens.map((token) => (
              <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={token.key}>
                <input name="themeKey" type="hidden" value={token.key} />
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="h-12 w-12 shrink-0 rounded-md border border-white/15"
                    style={{ backgroundColor: token.value }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-black">{token.label}</h4>
                      <Badge tone={token.value === token.defaultValue ? "muted" : "amber"}>
                        {token.value === token.defaultValue ? "default" : "changed"}
                      </Badge>
                    </div>
                    <p className="mt-1 break-all text-xs text-bc-muted">{token.css}</p>
                    <p className="mt-2 text-sm text-bc-muted">{token.use}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-[64px_1fr]">
                  <input
                    aria-label={`${token.label} colour picker`}
                    className="min-h-10 w-full rounded-md border border-bc-line bg-bc-panel p-1"
                    defaultValue={token.value}
                    disabled={pending}
                    name={`value_${token.key}`}
                    type="color"
                  />
                  <input
                    className="min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                    defaultValue={token.value}
                    disabled={pending}
                    pattern="^#[0-9a-fA-F]{6}$"
                    readOnly
                  />
                </div>
                <p className="mt-2 text-xs text-bc-muted">Default: {token.defaultValue}</p>
              </article>
            ))}
          </div>

          <div>
            <Button disabled={pending} type="submit" variant="primary">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save theme settings
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
