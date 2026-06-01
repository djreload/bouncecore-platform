import { notFound } from "next/navigation";
import { CalendarClock, Globe, Headphones, MapPin, Radio } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { roleBadgeTone, roleDisplayName } from "@/lib/auth/role-display";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";
import { getPublicLiveState } from "@/lib/stream/stream-channel-service";
import { getPublicDjProfileBySlug } from "@/lib/profile/dj-profile-service";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusTone(status: string) {
  return status === "live" ? ("acid" as const) : ("cyan" as const);
}

export default async function DjProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [profile, roleDisplayLabels, liveState] = await Promise.all([
    getPublicDjProfileBySlug(slug),
    getRoleDisplayNameOverrides(),
    getPublicLiveState()
  ]);

  if (!profile) {
    notFound();
  }

  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <section className="rounded-md border border-bc-line bg-bc-panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <Badge tone={profile.hasActiveStreamKey ? "acid" : "cyan"}>
                {profile.hasActiveStreamKey ? "Stream enabled" : "Public DJ profile"}
              </Badge>
              <h1 className="mt-4 text-4xl font-black">{profile.displayName}</h1>
              <p className="mt-3 max-w-3xl text-bc-muted">
                {profile.bio ?? "This DJ has not added a public bio yet."}
              </p>
            </div>
            <Headphones className="h-10 w-10 text-bc-electric" aria-hidden="true" />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {profile.roles.map((role) => (
              <Badge key={role} tone={roleBadgeTone(role)}>
                {roleDisplayName(role, roleDisplayLabels)}
              </Badge>
            ))}
            {profile.location ? (
              <Badge tone="muted">
                <MapPin className="mr-1 h-3 w-3" aria-hidden="true" />
                {profile.location}
              </Badge>
            ) : null}
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/live">
              <Radio className="h-4 w-4" aria-hidden="true" />
              Watch live page
            </ButtonLink>
            {profile.websiteUrl ? (
              <ButtonLink href={profile.websiteUrl} variant="ghost">
                <Globe className="h-4 w-4" aria-hidden="true" />
                Website
              </ButtonLink>
            ) : null}
          </div>
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
          <section className="rounded-md border border-bc-line bg-bc-panel">
            <div className="border-b border-bc-line p-4">
              <h2 className="text-xl font-black">Upcoming sets</h2>
              <p className="mt-1 text-sm text-bc-muted">Assigned public schedule slots for this DJ.</p>
            </div>
            <div className="grid gap-4 p-4">
              {profile.schedules.map((schedule) => (
                <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={schedule.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={statusTone(schedule.status)}>{schedule.status}</Badge>
                      <Badge tone="muted">/{schedule.channelSlug}</Badge>
                    </div>
                    <CalendarClock className="h-5 w-5 text-bc-pink" aria-hidden="true" />
                  </div>
                  <h3 className="mt-3 text-lg font-black">{schedule.title}</h3>
                  <p className="mt-2 text-sm text-bc-muted">
                    {formatDate(schedule.startsAt)} to {formatDate(schedule.endsAt)}
                  </p>
                  <p className="mt-1 text-xs text-bc-muted">Channel: {schedule.channelTitle}</p>
                </article>
              ))}

              {!profile.schedules.length ? (
                <article className="rounded-md border border-bc-line bg-bc-ink p-4">
                  <CalendarClock className="h-6 w-6 text-bc-pink" aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-black">No upcoming sets</h3>
                  <p className="mt-2 text-sm text-bc-muted">New assigned shows will appear here automatically.</p>
                </article>
              ) : null}
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-md border border-bc-line bg-bc-panel p-5">
              <Badge tone={liveState.status === "live" ? "acid" : "muted"}>{liveState.status.toUpperCase()}</Badge>
              <h2 className="mt-4 text-xl font-black">Live status</h2>
              <p className="mt-2 text-sm text-bc-muted">
                {liveState.viewerCount} viewers on {liveState.channel?.title ?? "the live channel"}.
              </p>
            </section>

            <section className="rounded-md border border-bc-line bg-bc-panel p-5">
              <Badge tone={profile.hasActiveStreamKey ? "acid" : "muted"}>
                {profile.hasActiveStreamKey ? "Ready" : "Profile only"}
              </Badge>
              <h2 className="mt-4 text-xl font-black">Stream readiness</h2>
              <p className="mt-2 text-sm text-bc-muted">
                Public profile pages never expose private stream keys, only safe readiness signals.
              </p>
            </section>
          </aside>
        </div>
      </main>
    </PublicShell>
  );
}
