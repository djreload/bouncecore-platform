import { CalendarClock, Headphones, MapPin, Radio, UserRound } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { roleBadgeTone, roleDisplayName, visibleRoleBadges } from "@/lib/auth/role-display";
import { getRoleDisplayNameOverrides } from "@/lib/auth/role-display-settings";
import { getPublicDjProfiles } from "@/lib/profile/dj-profile-service";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function DjsPage() {
  const [profiles, roleDisplayLabels] = await Promise.all([getPublicDjProfiles(), getRoleDisplayNameOverrides()]);
  const streamEnabled = profiles.filter((profile) => profile.hasActiveStreamKey).length;
  const scheduledProfiles = profiles.filter((profile) => profile.schedules.length > 0).length;

  return (
    <PublicShell>
      <main className="mx-auto max-w-7xl px-4 py-10">
        <section className="rounded-md border border-bc-line bg-bc-panel p-6">
          <Badge tone="cyan">Streamer profiles</Badge>
          <h1 className="mt-4 text-4xl font-black">DJs</h1>
          <p className="mt-3 max-w-3xl text-bc-muted">
            Public DJ and streamer profiles with role badges, live readiness, profile details, and upcoming assigned sets.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="cyan">Profiles</Badge>
              <p className="mt-3 text-3xl font-black">{profiles.length}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="acid">Stream enabled</Badge>
              <p className="mt-3 text-3xl font-black">{streamEnabled}</p>
            </article>
            <article className="rounded-md border border-bc-line bg-bc-ink p-4">
              <Badge tone="pink">Scheduled</Badge>
              <p className="mt-3 text-3xl font-black">{scheduledProfiles}</p>
            </article>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {profiles.map((profile) => (
            <article className="rounded-md border border-bc-line bg-bc-panel p-5" key={profile.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge tone={profile.hasActiveStreamKey ? "acid" : "muted"}>
                    {profile.hasActiveStreamKey ? "Stream enabled" : "Profile only"}
                  </Badge>
                  <h2 className="mt-4 text-2xl font-black">{profile.displayName}</h2>
                  {profile.location ? (
                    <p className="mt-2 flex items-center gap-2 text-sm text-bc-muted">
                      <MapPin className="h-4 w-4" aria-hidden="true" />
                      {profile.location}
                    </p>
                  ) : null}
                </div>
                <Headphones className="h-7 w-7 text-bc-electric" aria-hidden="true" />
              </div>

              <p className="mt-4 text-sm text-bc-muted">{profile.bio ?? "This DJ has not added a bio yet."}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {visibleRoleBadges(profile.roles).map((role) => (
                  <Badge key={role} tone={roleBadgeTone(role)}>
                    {roleDisplayName(role, roleDisplayLabels)}
                  </Badge>
                ))}
              </div>

              <div className="mt-5 rounded-md border border-bc-line bg-bc-ink p-4">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-bc-pink" aria-hidden="true" />
                  <h3 className="font-semibold">Next set</h3>
                </div>
                {profile.schedules[0] ? (
                  <p className="mt-2 text-sm text-bc-muted">
                    {profile.schedules[0].title} on {formatDate(profile.schedules[0].startsAt)}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-bc-muted">No upcoming sets scheduled.</p>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <ButtonLink href={`/djs/${profile.slug}`} variant="primary">
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                  View profile
                </ButtonLink>
                <ButtonLink href="/live" variant="ghost">
                  <Radio className="h-4 w-4" aria-hidden="true" />
                  Live
                </ButtonLink>
              </div>
            </article>
          ))}

          {!profiles.length ? (
            <article className="rounded-md border border-bc-line bg-bc-panel p-5 md:col-span-2 xl:col-span-3">
              <Headphones className="h-7 w-7 text-bc-electric" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-black">No public DJ profiles yet</h2>
              <p className="mt-2 text-sm text-bc-muted">Streamer profiles appear here once they are set to public.</p>
            </article>
          ) : null}
        </section>
      </main>
    </PublicShell>
  );
}
