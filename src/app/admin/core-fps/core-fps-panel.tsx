"use client";

import { useActionState } from "react";
import { Clock3, ExternalLink, Gamepad2, Map, Save, ShieldCheck } from "lucide-react";
import { adminCoreFpsAction } from "@/app/admin/core-fps/actions";
import { initialAdminCoreFpsActionState, type AdminCoreFpsActionState } from "@/app/admin/core-fps/state";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import type { getAdminCoreFpsData } from "@/lib/games/core-fps-settings-service";
import { coreFpsAvailableMaps } from "@/lib/games/core-fps-lobby-core";

type AdminCoreFpsPanelProps = {
  data: Awaited<ReturnType<typeof getAdminCoreFpsData>>;
};

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not saved";
}

export function AdminCoreFpsPanel({ data }: AdminCoreFpsPanelProps) {
  const [state, formAction, pending] = useActionState<AdminCoreFpsActionState, FormData>(
    adminCoreFpsAction,
    initialAdminCoreFpsActionState
  );

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.settings.enabled ? "acid" : "amber"}>Launcher</Badge>
          <p className="mt-4 text-3xl font-black">{data.settings.enabled ? "Enabled" : "Disabled"}</p>
          <p className="mt-2 text-sm text-bc-muted">Public Bouncecore game route.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.configured ? "acid" : "amber"}>Runtime</Badge>
          <p className="mt-4 text-3xl font-black">{data.configured ? "Ready" : "Setup"}</p>
          <p className="mt-2 text-sm text-bc-muted">URL and three isolated server secrets.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Source</Badge>
          <p className="mt-4 text-xl font-black">{data.source}</p>
          <p className="mt-2 text-sm text-bc-muted">{formatDate(data.updatedAt)}</p>
        </article>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">3D game service</Badge>
            <h2 className="mt-4 text-2xl font-black">Core FPS launcher</h2>
            <p className="mt-2 max-w-3xl text-sm text-bc-muted">
              Core runs on a separate hostname. Players receive signed, expiring access without sharing Bouncecore session cookies with the imported engine.
            </p>
          </div>
          <Gamepad2 className="h-8 w-8 text-bc-electric" aria-hidden="true" />
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

        <form action={formAction} className="mt-5 grid gap-5">
          <div>
            <label className="text-sm font-semibold" htmlFor="core-fps-public-url">
              Public game URL
            </label>
            <input
              className="mt-2 min-h-11 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-white"
              defaultValue={data.settings.publicUrl ?? ""}
              disabled={pending}
              id="core-fps-public-url"
              name="publicUrl"
              placeholder="https://core.example.com"
              type="url"
            />
            <p className="mt-1 text-xs text-bc-muted">
              Dedicated HTTPS origin routed to the Core gateway. Do not use the main Bouncecore hostname or a path below it.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold" htmlFor="core-fps-lobby-wait">
                <Clock3 className="h-4 w-4 text-bc-electric" aria-hidden="true" />
                Lobby wait time
              </label>
              <input
                className="mt-2 min-h-11 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-white"
                defaultValue={data.settings.lobbyWaitSeconds}
                disabled={pending}
                id="core-fps-lobby-wait"
                max={180}
                min={10}
                name="lobbyWaitSeconds"
                type="number"
              />
              <p className="mt-1 text-xs text-bc-muted">
                Seconds before a solo player starts with the AI. A second player shortens this to an eight-second ready countdown.
              </p>
            </div>

            <fieldset>
              <legend className="flex items-center gap-2 text-sm font-semibold">
                <Map className="h-4 w-4 text-bc-pink" aria-hidden="true" />
                Random map pool
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {coreFpsAvailableMaps.map((mapName) => (
                  <label className="flex min-h-11 items-center gap-2 rounded-md border border-bc-line bg-bc-ink px-3 py-2" key={mapName}>
                    <input
                      defaultChecked={data.settings.mapPool.includes(mapName)}
                      disabled={pending}
                      name="mapPool"
                      type="checkbox"
                      value={mapName}
                    />
                    <span className="text-sm font-semibold capitalize">{mapName}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-bc-muted">
                One enabled map is chosen once when a new lobby is created. Late joiners never restart it.
              </p>
            </fieldset>
          </div>

          <label className="flex items-start gap-3 rounded-md border border-bc-line bg-bc-ink p-4">
            <input className="mt-1" defaultChecked={data.settings.enabled} disabled={pending} name="enabled" type="checkbox" />
            <span>
              <span className="block font-semibold">Enable Core FPS</span>
              <span className="mt-1 block text-sm text-bc-muted">
                Makes `/games/core` launchable for signed-in users. Keep this off until the gateway checks below are ready.
              </span>
            </span>
          </label>

          <div>
            <Button disabled={pending} type="submit">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save game settings
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-bc-acid" aria-hidden="true" />
          <h2 className="text-xl font-black">Security and runtime checks</h2>
        </div>
        <div className="mt-4 grid gap-3">
          {data.checks.map((check) => (
            <article className="grid gap-2 border-t border-bc-line pt-3 md:grid-cols-[1fr_auto]" key={check.label}>
              <div>
                <p className="font-semibold">{check.label}</p>
                <p className="mt-1 break-all text-sm text-bc-muted">{check.detail}</p>
              </div>
              <Badge tone={check.ready ? "acid" : "amber"}>{check.ready ? "Ready" : "Required"}</Badge>
            </article>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/games/core" variant="ghost">
            <Gamepad2 className="h-4 w-4" aria-hidden="true" />
            Open launcher
          </ButtonLink>
          <a
            className="bc-button bc-button-ghost bc-focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-bc-line px-4 py-2 text-sm font-semibold text-white"
            href={data.sourceRepository}
            rel="noreferrer"
            target="_blank"
          >
            Source at {data.sourceRef.slice(0, 8)}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>
    </div>
  );
}
