"use client";

import { useActionState } from "react";
import { Music, Save } from "lucide-react";
import { producerAction } from "@/app/producer/actions";
import { initialProducerActionState, type ProducerActionState } from "@/app/producer/state";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import type { ProducerWorkspaceData } from "@/lib/music/music-service";

type ProducerProfileFormProps = {
  data: ProducerWorkspaceData;
};

export function ProducerProfileForm({ data }: ProducerProfileFormProps) {
  const [state, formAction, pending] = useActionState<ProducerActionState, FormData>(
    producerAction,
    initialProducerActionState
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="acid">Producer profile</Badge>
            <h3 className="mt-4 text-2xl font-black">Public producer identity</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              This profile powers the public producer directory and approved track catalogue.
            </p>
          </div>
          <Music className="h-7 w-7 text-bc-acid" aria-hidden="true" />
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
          <input name="intent" type="hidden" value="profile" />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="name">
                Producer name
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.profile?.name ?? ""}
                disabled={pending}
                id="name"
                maxLength={100}
                name="name"
                placeholder="Artist or label name"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="slug">
                Producer slug
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.profile?.slug ?? ""}
                disabled={pending}
                id="slug"
                maxLength={58}
                name="slug"
                placeholder="producer-name"
                required
              />
              <p className="mt-2 text-xs text-bc-muted">Public URL: /producers/{data.profile?.slug ?? "producer-name"}</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="bio">
              Bio
            </label>
            <textarea
              className="mt-2 min-h-32 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              defaultValue={data.profile?.bio ?? ""}
              disabled={pending}
              id="bio"
              maxLength={600}
              name="bio"
              placeholder="Tell listeners about your sound, releases, and production style."
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button disabled={pending} type="submit" variant="primary">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save profile
            </Button>
            {data.profile ? (
              <ButtonLink href={`/producers/${data.profile.slug}`} variant="ghost">
                View public page
              </ButtonLink>
            ) : null}
          </div>
        </form>
      </section>

      <aside className="space-y-5">
        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.profile ? "acid" : "amber"}>{data.profile ? "Profile ready" : "Setup needed"}</Badge>
          <h3 className="mt-4 text-xl font-black">{data.profile?.name ?? "No producer profile yet"}</h3>
          <p className="mt-2 text-sm text-bc-muted">
            Producer profiles become public as soon as they are created. Approved tracks appear in the music catalogue.
          </p>
        </section>
        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Catalogue</Badge>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-bc-muted">Total tracks</span>
              <span className="font-semibold">{data.stats.totalTracks}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-bc-muted">Approved</span>
              <span className="font-semibold">{data.stats.approvedTracks}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-bc-muted">Pending</span>
              <span className="font-semibold">{data.stats.pendingTracks}</span>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}
