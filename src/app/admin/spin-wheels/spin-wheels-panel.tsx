"use client";

import { useActionState } from "react";
import { ArrowDown, ArrowUp, Gift, Plus, RotateCw, Save, Sparkles } from "lucide-react";
import { adminSpinWheelsAction } from "@/app/admin/spin-wheels/actions";
import {
  initialAdminSpinWheelsActionState,
  type AdminSpinWheelsActionState
} from "@/app/admin/spin-wheels/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminSpinWheelsData } from "@/lib/rewards/prize-service";

type AdminSpinWheelsPanelProps = {
  data: AdminSpinWheelsData;
};

const wheelStatusOptions = ["draft", "active", "paused", "archived"] as const;
const segmentStatusOptions = ["active", "disabled"] as const;
const prizeTypeOptions = ["none", "merch", "music", "vip", "manual"] as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusTone(status: string) {
  if (status === "active") {
    return "acid" as const;
  }

  if (status === "paused" || status === "draft") {
    return "amber" as const;
  }

  return "muted" as const;
}

function prizeTone(prizeType: string) {
  if (prizeType === "none") {
    return "muted" as const;
  }

  return "pink" as const;
}

export function AdminSpinWheelsPanel({ data }: AdminSpinWheelsPanelProps) {
  const [state, formAction, pending] = useActionState<AdminSpinWheelsActionState, FormData>(
    adminSpinWheelsAction,
    initialAdminSpinWheelsActionState
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Wheels</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.wheels}</p>
          <p className="mt-2 text-sm text-bc-muted">{data.stats.activeWheels} active.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Segments</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.segments}</p>
          <p className="mt-2 text-sm text-bc-muted">{data.stats.activeSegments} active.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Claims</Badge>
          <p className="mt-4 text-3xl font-black">{data.claimsPending}</p>
          <p className="mt-2 text-sm text-bc-muted">Pending or approved prize claims.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.stats.activeWheels > 0 && data.stats.activeSegments > 0 ? "acid" : "amber"}>Public spin</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.activeWheels > 0 && data.stats.activeSegments > 0 ? "Ready" : "Setup"}</p>
          <p className="mt-2 text-sm text-bc-muted">Active wheels with active weighted segments appear in account rewards.</p>
        </article>
      </div>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Wheel setup</Badge>
            <h3 className="mt-4 text-2xl font-black">Reward wheel control</h3>
            <p className="mt-2 max-w-3xl text-sm text-bc-muted">
              Configure active wheels and weighted prize segments here. User spins create prize claims for admin fulfilment when needed.
            </p>
          </div>
          <form action={formAction}>
            <input name="intent" type="hidden" value="ensure-default" />
            <Button disabled={pending} type="submit" variant="ghost">
              <RotateCw className="h-4 w-4" aria-hidden="true" />
              Ensure default
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
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <Badge tone="cyan">New wheel</Badge>
        <form action={formAction} className="mt-4 grid gap-4">
          <input name="intent" type="hidden" value="wheel" />
          <input name="costStars" type="hidden" value="0" />
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_160px]">
            <input
              className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              name="name"
              placeholder="Wheel name"
              required
            />
            <input
              className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              name="slug"
              placeholder="wheel-slug"
              required
            />
            <select className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white" name="status">
              {wheelStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)_auto]">
            <input
              className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              defaultValue="1440"
              min="0"
              name="cooldownMinutes"
              type="number"
            />
            <input
              className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              name="description"
              placeholder="Description"
            />
            <Button disabled={pending} type="submit" variant="primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create wheel
            </Button>
          </div>
        </form>
      </section>

      <div className="grid gap-4">
        {data.wheels.map((wheel) => {
          const nextSegmentSortOrder = wheel.segments.reduce((max, segment) => Math.max(max, segment.sortOrder), -10) + 10;

          return (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={wheel.id}>
            <form action={formAction} className="grid gap-4">
              <input name="intent" type="hidden" value="wheel" />
              <input name="wheelId" type="hidden" value={wheel.id} />
              <input name="costStars" type="hidden" value="0" />
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={statusTone(wheel.status)}>{wheel.status}</Badge>
                    <Badge tone="muted">/{wheel.slug}</Badge>
                    <Badge tone="cyan">{wheel.totalWeight} active weight</Badge>
                  </div>
                  <h3 className="mt-3 text-xl font-black">{wheel.name}</h3>
                  <p className="mt-1 text-sm text-bc-muted">
                    {wheel.description ?? "No description."} Created {formatDate(wheel.createdAt)}.
                  </p>
                </div>
                <Sparkles className="h-6 w-6 text-bc-pink" aria-hidden="true" />
              </div>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_160px_auto]">
                <input
                  className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                  defaultValue={wheel.name}
                  name="name"
                  required
                />
                <input
                  className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                  defaultValue={wheel.slug}
                  name="slug"
                  required
                />
                <select
                  className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                  defaultValue={wheel.status}
                  name="status"
                >
                  {wheelStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <Button disabled={pending} type="submit" variant="dark">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
                <input
                  className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                  defaultValue={wheel.cooldownMinutes}
                  min="0"
                  name="cooldownMinutes"
                  type="number"
                />
                <input
                  className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                  defaultValue={wheel.description ?? ""}
                  name="description"
                />
              </div>
            </form>

            <section className="mt-5 rounded-md border border-bc-line bg-bc-ink p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-bc-acid" aria-hidden="true" />
                  <h4 className="font-black">Segments</h4>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <p className="max-w-2xl text-xs text-bc-muted">
                    Wheel order controls where slices appear. Weight still controls slice size and chance.
                  </p>
                  <form action={formAction}>
                    <input name="intent" type="hidden" value="spread-segments" />
                    <input name="wheelId" type="hidden" value={wheel.id} />
                    <Button disabled={pending || wheel.segments.length < 3} size="sm" type="submit" variant="ghost">
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      Spread slices
                    </Button>
                  </form>
                </div>
              </div>
              <form action={formAction} className="mt-4 grid gap-3 xl:grid-cols-[1fr_140px_140px_120px_120px_120px_120px_auto]">
                <input name="intent" type="hidden" value="segment" />
                <input name="wheelId" type="hidden" value={wheel.id} />
                <input
                  className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  name="label"
                  placeholder="Prize label"
                  required
                />
                <select className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white" name="prizeType">
                  {prizeTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <input
                  className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue="0"
                  min="0"
                  name="starAmount"
                  type="number"
                />
                <input
                  className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue="1"
                  min="1"
                  name="weight"
                  type="number"
                />
                <input
                  className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={nextSegmentSortOrder}
                  min="0"
                  name="sortOrder"
                  placeholder="Order"
                  type="number"
                />
                <select className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white" name="status">
                  {segmentStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <input
                  className="min-h-10 rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  name="prizeValue"
                  placeholder="Value"
                />
                <Button disabled={pending} name="segmentAction" type="submit" value="save" variant="primary">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add
                </Button>
              </form>

              <div className="mt-4 grid gap-3">
                {wheel.segments.map((segment) => (
                  <form action={formAction} className="grid gap-3 rounded-md border border-bc-line bg-bc-panel p-3 xl:grid-cols-[1fr_140px_140px_120px_120px_120px_120px_120px]" key={segment.id}>
                    <input name="intent" type="hidden" value="segment" />
                    <input name="wheelId" type="hidden" value={wheel.id} />
                    <input name="segmentId" type="hidden" value={segment.id} />
                    <input
                      className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                      defaultValue={segment.label}
                      name="label"
                      required
                    />
                    <select
                      className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                      defaultValue={segment.prizeType}
                      name="prizeType"
                    >
                      {prizeTypeOptions.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <input
                      className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                      defaultValue={segment.starAmount}
                      min="0"
                      name="starAmount"
                      type="number"
                    />
                    <input
                      className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                      defaultValue={segment.weight}
                      min="1"
                      name="weight"
                      type="number"
                    />
                    <input
                      className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                      defaultValue={segment.sortOrder}
                      min="0"
                      name="sortOrder"
                      title="Wheel order"
                      type="number"
                    />
                    <select
                      className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                      defaultValue={segment.status}
                      name="status"
                    >
                      {segmentStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <input
                      className="min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                      defaultValue={segment.prizeValue ?? ""}
                      name="prizeValue"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        aria-label={`Move ${segment.label} up`}
                        disabled={pending}
                        name="segmentAction"
                        size="sm"
                        type="submit"
                        value="move-up"
                        variant="ghost"
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        aria-label={`Move ${segment.label} down`}
                        disabled={pending}
                        name="segmentAction"
                        size="sm"
                        type="submit"
                        value="move-down"
                        variant="ghost"
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button disabled={pending} name="segmentAction" size="sm" type="submit" value="save" variant="ghost">
                        <Save className="h-4 w-4" aria-hidden="true" />
                        Save
                      </Button>
                    </div>
                    <div className="xl:col-span-8 flex flex-wrap gap-2">
                      <Badge tone="cyan">order {segment.sortOrder}</Badge>
                      <Badge tone={statusTone(segment.status)}>{segment.status}</Badge>
                      <Badge tone={prizeTone(segment.prizeType)}>{segment.prizeType}</Badge>
                      <Badge tone="muted">{segment.claimCount} claims</Badge>
                    </div>
                  </form>
                ))}
                {!wheel.segments.length ? (
                  <div className="rounded-md border border-bc-line bg-bc-panel p-4 text-sm text-bc-muted">
                    No segments yet. Add at least one active segment before activating the wheel.
                  </div>
                ) : null}
              </div>
            </section>
          </article>
          );
        })}

        {!data.wheels.length ? (
          <article className="rounded-md border border-bc-line bg-bc-panel p-5">
            <Gift className="h-7 w-7 text-bc-electric" aria-hidden="true" />
            <h3 className="mt-4 text-xl font-black">No reward wheels yet</h3>
            <p className="mt-2 text-sm text-bc-muted">Use Ensure default or create a wheel manually.</p>
          </article>
        ) : null}
      </div>
    </div>
  );
}
