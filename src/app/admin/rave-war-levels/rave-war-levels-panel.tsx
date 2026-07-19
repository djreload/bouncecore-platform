"use client";

import Image from "next/image";
import { useActionState } from "react";
import { CheckCircle2, ImagePlus, Map, MapPin, Play, Trash2 } from "lucide-react";
import { adminRaveWarLevelsAction } from "@/app/admin/rave-war-levels/actions";
import { initialAdminRaveWarLevelsActionState } from "@/app/admin/rave-war-levels/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminRaveWarLevelsData } from "@/lib/rave-wars/rave-war-level-service";

type AdminRaveWarLevelsPanelProps = {
  data: AdminRaveWarLevelsData;
};

const inputClassName = "min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white";

function FieldNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs leading-5 text-bc-muted">{children}</p>;
}

function percent(value: number, total: number) {
  return `${Math.max(0, Math.min(100, (value / total) * 100))}%`;
}

export function AdminRaveWarLevelsPanel({ data }: AdminRaveWarLevelsPanelProps) {
  const [state, formAction, pending] = useActionState(
    adminRaveWarLevelsAction,
    initialAdminRaveWarLevelsActionState
  );
  const activeLevel = data.levels.find((entry) => entry.isActive);

  return (
    <div className="grid gap-5">
      {state.message ? (
        <div
          className={`rounded-md border p-3 text-sm ${
            state.status === "error"
              ? "border-bc-pink/35 bg-bc-pink/10 text-bc-pink"
              : "border-bc-acid/35 bg-bc-acid/10 text-bc-acid"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <section className="border-y border-bc-line bg-bc-panel px-4 py-5 sm:rounded-md sm:border">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-bc-electric">
              <Map className="h-5 w-5" aria-hidden="true" />
              <h3 className="text-lg font-black text-white">Active battlefield</h3>
            </div>
            <p className="mt-1 text-sm text-bc-muted">New challenges use this level. Existing wars keep their original level.</p>
          </div>
          <Badge tone="acid">{activeLevel?.level.name ?? "Built-in fallback"}</Badge>
        </div>
      </section>

      <section className="border-y border-bc-line bg-bc-panel px-4 py-5 sm:rounded-md sm:border">
        <div className="mb-5">
          <div className="flex items-center gap-2">
            <ImagePlus className="h-5 w-5 text-bc-electric" aria-hidden="true" />
            <h3 className="text-lg font-black">Upload terrain</h3>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-bc-muted">
            Upload a terrain-only PNG with transparent sky and opaque ground. The server normalizes it to 2048 by 1024,
            generates collision samples every 16 pixels, and chooses stable left and right spawn points.
          </p>
        </div>

        <form action={formAction} className="grid gap-4 lg:grid-cols-2">
          <input name="intent" type="hidden" value="create" />
          <label className="block">
            <span className="text-xs font-black uppercase text-bc-muted">Level name</span>
            <input className={inputClassName} maxLength={60} name="name" placeholder="Neon Canyon" required />
            <FieldNote>The name players will see in challenges and on the battlefield.</FieldNote>
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase text-bc-muted">Theme label</span>
            <input className={inputClassName} defaultValue="Custom" maxLength={40} name="theme" required />
            <FieldNote>A short internal style label, such as Arena, Space, Castle, or Warehouse.</FieldNote>
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase text-bc-muted">Terrain PNG</span>
            <input className={inputClassName} accept="image/png,.png" name="terrainFile" required type="file" />
            <FieldNote>PNG only, up to 100MB. Keep sky transparent and avoid opaque floating decorations above the ground.</FieldNote>
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase text-bc-muted">Background image</span>
            <input className={inputClassName} accept="image/jpeg,image/png,image/webp,image/avif,image/gif" name="backgroundFile" type="file" />
            <FieldNote>Optional non-destructible scenery, up to 100MB. The built-in rave arena is used when left empty.</FieldNote>
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase text-bc-muted">Empty-area colour</span>
            <input className={`${inputClassName} h-11 p-1`} defaultValue="#10151d" name="backgroundColor" type="color" />
            <FieldNote>Shown behind the background while images load or if they contain transparent areas.</FieldNote>
          </label>
          <label className="flex min-h-11 items-center gap-3 self-start rounded-md border border-bc-line bg-bc-ink px-3 py-2">
            <input className="h-4 w-4 accent-bc-electric" name="makeActive" type="checkbox" value="true" />
            <span>
              <span className="block text-sm font-black">Use for new challenges</span>
              <span className="block text-xs text-bc-muted">Makes this battlefield active immediately after processing.</span>
            </span>
          </label>
          <div className="lg:col-span-2">
            <Button disabled={pending} type="submit">
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              {pending ? "Processing terrain..." : "Generate level"}
            </Button>
          </div>
        </form>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-lg font-black">Available battlefields</h3>
            <p className="mt-1 text-sm text-bc-muted">Preview generated collision alignment and adjust custom spawn positions.</p>
          </div>
          <Badge>{data.levels.length} levels</Badge>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {data.levels.map(({ isActive, isBuiltIn, level, usageCount }) => {
            const coverage = Math.round(
              (level.terrain.surfaceY.filter((surface) => surface < level.height).length / level.terrain.surfaceY.length) * 100
            );

            return (
              <article className="overflow-hidden rounded-md border border-bc-line bg-bc-panel" key={level.key}>
                <div className="relative aspect-[2/1] overflow-hidden" style={{ backgroundColor: level.backgroundColor }}>
                  <Image alt="" className="object-cover" fill sizes="(max-width: 1280px) 100vw, 50vw" src={level.backgroundImageUrl} unoptimized />
                  <Image alt={`${level.name} destructible terrain`} className="object-fill" fill sizes="(max-width: 1280px) 100vw, 50vw" src={level.mapImageUrl} unoptimized />
                  {level.spawns.map((spawn, index) => (
                    <span
                      className={`absolute grid h-7 w-7 -translate-x-1/2 -translate-y-full place-items-center rounded-full border-2 text-[10px] font-black shadow-lg ${
                        index === 0 ? "border-bc-electric bg-bc-electric text-bc-void" : "border-bc-pink bg-bc-pink text-white"
                      }`}
                      key={`${level.key}-spawn-${index}`}
                      style={{ left: percent(spawn.x, level.width), top: percent(spawn.y, level.height) }}
                      title={`Player ${index + 1} spawn at ${spawn.x}, ${spawn.y}`}
                    >
                      {index + 1}
                    </span>
                  ))}
                </div>

                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="font-black">{level.name}</h4>
                      <p className="mt-1 text-xs text-bc-muted">{level.theme} / {level.width}×{level.height} / {coverage}% terrain coverage</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {isActive ? <Badge tone="acid">Active</Badge> : null}
                      {isBuiltIn ? <Badge>Built in</Badge> : <Badge tone="pink">Custom</Badge>}
                      <Badge>{usageCount} wars</Badge>
                    </div>
                  </div>

                  {!isActive ? (
                    <form action={formAction} className="mt-4">
                      <input name="intent" type="hidden" value="activate" />
                      <input name="levelKey" type="hidden" value={level.key} />
                      <Button disabled={pending} size="sm" type="submit" variant="ghost">
                        <Play className="h-3.5 w-3.5" aria-hidden="true" />
                        Use for new wars
                      </Button>
                    </form>
                  ) : (
                    <div className="mt-4 inline-flex items-center gap-2 text-xs font-black text-bc-acid">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Selected for new challenges
                    </div>
                  )}

                  {!isBuiltIn ? (
                    <>
                      <form action={formAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                        <input name="intent" type="hidden" value="spawns" />
                        <input name="levelKey" type="hidden" value={level.key} />
                        <label>
                          <span className="flex items-center gap-1 text-xs font-black uppercase text-bc-muted">
                            <MapPin className="h-3.5 w-3.5 text-bc-electric" aria-hidden="true" /> Player 1 X
                          </span>
                          <input className={inputClassName} defaultValue={level.spawns[0].x} max={2006} min={42} name="firstSpawnX" required type="number" />
                          <FieldNote>Horizontal start position for the challenger.</FieldNote>
                        </label>
                        <label>
                          <span className="flex items-center gap-1 text-xs font-black uppercase text-bc-muted">
                            <MapPin className="h-3.5 w-3.5 text-bc-pink" aria-hidden="true" /> Player 2 X
                          </span>
                          <input className={inputClassName} defaultValue={level.spawns[1].x} max={2006} min={42} name="secondSpawnX" required type="number" />
                          <FieldNote>Horizontal start position for the challenged player.</FieldNote>
                        </label>
                        <Button className="sm:col-span-2 sm:w-fit" disabled={pending} size="sm" type="submit" variant="dark">
                          Save spawn positions
                        </Button>
                      </form>

                      <form
                        action={formAction}
                        className="mt-4 border-t border-bc-line pt-4"
                        onSubmit={(event) => {
                          if (!window.confirm(`Delete ${level.name}? This cannot be undone.`)) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input name="intent" type="hidden" value="delete" />
                        <input name="confirmation" type="hidden" value="DELETE LEVEL" />
                        <input name="levelKey" type="hidden" value={level.key} />
                        <Button disabled={pending || usageCount > 0} size="sm" title={usageCount > 0 ? "Levels referenced by wars are retained for replay and server physics." : "Delete unused custom level"} type="submit" variant="ghost">
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Delete level
                        </Button>
                        {usageCount > 0 ? <FieldNote>Deletion is locked because completed or active wars reference this terrain.</FieldNote> : null}
                      </form>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-ink p-4 text-sm leading-6 text-bc-muted">
        <p className="font-black text-white">Terrain rules</p>
        <p className="mt-1">
          Collision uses the first opaque pixel from the top at each X position. Hills and valleys work well. Caves,
          floating islands, and opaque decorations above the ground are treated as the walkable surface because this
          version uses one terrain height per horizontal position.
        </p>
      </section>
    </div>
  );
}

