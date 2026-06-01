"use client";

import { useActionState } from "react";
import { Eye, EyeOff, Save, UserRound } from "lucide-react";
import { updateStreamerProfileAction } from "@/app/streamer/profile/actions";
import {
  initialStreamerProfileActionState,
  type StreamerProfileActionState
} from "@/app/streamer/profile/state";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { roleBadgeTone, roleDisplayName, type RoleDisplayNameMap } from "@/lib/auth/role-display";
import type { StreamerProfileData } from "@/lib/profile/dj-profile-service";

type ProfileFormProps = {
  profileData: StreamerProfileData;
  roleDisplayLabels: RoleDisplayNameMap;
};

export function ProfileForm({ profileData, roleDisplayLabels }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState<StreamerProfileActionState, FormData>(
    updateStreamerProfileAction,
    initialStreamerProfileActionState
  );
  const profileUrl = state.profileUrl ?? (profileData.profile.isPublic ? `/djs/${profileData.profile.slug}` : null);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="cyan">Profile editor</Badge>
            <h3 className="mt-4 text-2xl font-black">Public DJ profile</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Control the public identity shown in the DJ directory and on your profile page.
            </p>
          </div>
          <UserRound className="h-7 w-7 text-bc-electric" aria-hidden="true" />
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
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="slug">
                Profile slug
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={profileData.profile.slug}
                disabled={pending}
                id="slug"
                maxLength={48}
                name="slug"
                required
              />
              <p className="mt-2 text-xs text-bc-muted">Public URL: /djs/{profileData.profile.slug}</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="location">
                Location
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={profileData.profile.location ?? ""}
                disabled={pending}
                id="location"
                maxLength={80}
                name="location"
                placeholder="Birmingham, UK"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="bio">
              Bio
            </label>
            <textarea
              className="mt-2 min-h-32 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              defaultValue={profileData.profile.bio ?? ""}
              disabled={pending}
              id="bio"
              maxLength={600}
              name="bio"
              placeholder="Tell viewers what you play, where you are from, and what to expect from your sets."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="avatarUrl">
                Avatar URL
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={profileData.profile.avatarUrl ?? ""}
                disabled={pending}
                id="avatarUrl"
                name="avatarUrl"
                placeholder="https://..."
                type="url"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="websiteUrl">
                Website URL
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={profileData.profile.websiteUrl ?? ""}
                disabled={pending}
                id="websiteUrl"
                name="websiteUrl"
                placeholder="https://..."
                type="url"
              />
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-md border border-bc-line bg-bc-ink p-4">
            <input
              className="mt-1 h-4 w-4 accent-bc-electric"
              defaultChecked={profileData.profile.isPublic}
              disabled={pending}
              name="isPublic"
              type="checkbox"
            />
            <span>
              <span className="flex items-center gap-2 font-semibold">
                {profileData.profile.isPublic ? (
                  <Eye className="h-4 w-4 text-bc-acid" aria-hidden="true" />
                ) : (
                  <EyeOff className="h-4 w-4 text-bc-muted" aria-hidden="true" />
                )}
                Show profile publicly
              </span>
              <span className="mt-1 block text-sm text-bc-muted">
                Public profiles appear in the DJ directory and can show assigned stream slots.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={pending} type="submit" variant="primary">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save profile
            </Button>
            {profileUrl ? (
              <ButtonLink href={profileUrl} variant="ghost">
                View public page
              </ButtonLink>
            ) : null}
          </div>
        </form>
      </section>

      <aside className="space-y-5">
        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={profileData.profile.isPublic ? "acid" : "muted"}>{profileData.profile.isPublic ? "Public" : "Hidden"}</Badge>
          <h3 className="mt-4 text-xl font-black">{profileData.displayName}</h3>
          <p className="mt-2 text-sm text-bc-muted">{profileData.email}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {profileData.roles.map((role) => (
              <Badge key={role} tone={roleBadgeTone(role)}>
                {roleDisplayName(role, roleDisplayLabels)}
              </Badge>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={profileData.hasActiveStreamKey ? "acid" : "amber"}>
            {profileData.hasActiveStreamKey ? "Stream enabled" : "No stream key"}
          </Badge>
          <h3 className="mt-4 text-xl font-black">Profile signals</h3>
          <p className="mt-2 text-sm text-bc-muted">
            Public viewers can see profile content, role badges, active stream readiness, and upcoming assigned sets.
          </p>
        </section>

        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Upcoming</Badge>
          <h3 className="mt-4 text-xl font-black">{profileData.upcomingSchedules.length} assigned sets</h3>
          <p className="mt-2 text-sm text-bc-muted">
            Schedule slots assigned by admins are shown on public profiles when the profile is public.
          </p>
        </section>
      </aside>
    </div>
  );
}
