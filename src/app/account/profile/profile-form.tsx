"use client";

import Image from "next/image";
import { useActionState } from "react";
import { Eye, EyeOff, Save, Upload, UserRound } from "lucide-react";
import { updateAccountProfileAction } from "@/app/account/profile/actions";
import { initialAccountProfileActionState, type AccountProfileActionState } from "@/app/account/profile/state";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { roleBadgeTone, roleDisplayName, visibleRoleBadges, type RoleDisplayNameMap } from "@/lib/auth/role-display";
import type { AccountProfileData } from "@/lib/account/account-service";

type AccountProfileFormProps = {
  data: AccountProfileData;
  roleDisplayLabels: RoleDisplayNameMap;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

export function AccountProfileForm({ data, roleDisplayLabels }: AccountProfileFormProps) {
  const [state, formAction, pending] = useActionState<AccountProfileActionState, FormData>(
    updateAccountProfileAction,
    initialAccountProfileActionState
  );
  const profileUrl = state.profileUrl ?? (data.profile.isPublic ? `/djs/${data.profile.slug}` : null);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="cyan">Profile editor</Badge>
            <h3 className="mt-4 text-2xl font-black">Account identity</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Manage your display name, public profile slug, location, avatar, and profile visibility.
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

        <form action={formAction} className="mt-5 grid gap-4" encType="multipart/form-data">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="displayName">
                Display name
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.displayName}
                disabled={pending}
                id="displayName"
                maxLength={80}
                name="displayName"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="slug">
                Profile slug
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.profile.slug}
                disabled={pending}
                id="slug"
                maxLength={48}
                name="slug"
                required
              />
              <p className="mt-2 text-xs text-bc-muted">Public URL: /djs/{data.profile.slug}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="location">
                Location
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.profile.location ?? ""}
                disabled={pending}
                id="location"
                maxLength={80}
                name="location"
                placeholder="Birmingham, UK"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="websiteUrl">
                Website URL
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.profile.websiteUrl ?? ""}
                disabled={pending}
                id="websiteUrl"
                name="websiteUrl"
                placeholder="https://..."
                type="url"
              />
            </div>
          </div>

          <div className="grid gap-4 rounded-md border border-bc-line bg-bc-ink p-4 md:grid-cols-[88px_1fr]">
            <div className="h-20 w-20 overflow-hidden rounded-md border border-bc-line bg-bc-panel">
              {data.profile.avatarUrl ? (
                <Image
                  alt=""
                  className="h-full w-full object-cover"
                  height={80}
                  src={data.profile.avatarUrl}
                  unoptimized
                  width={80}
                />
              ) : (
                <span className="grid h-full w-full place-items-center text-bc-muted">
                  <UserRound className="h-8 w-8" aria-hidden="true" />
                </span>
              )}
            </div>
            <div className="grid gap-3">
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold uppercase text-bc-muted" htmlFor="avatarFile">
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  Upload avatar
                </label>
                <input
                  accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-bc-electric file:px-3 file:py-1 file:text-xs file:font-semibold file:text-bc-void"
                  disabled={pending}
                  id="avatarFile"
                  name="avatarFile"
                  type="file"
                />
                <p className="mt-2 text-xs text-bc-muted">PNG, JPG, or JPEG. Uploading a file replaces the URL below.</p>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="avatarUrl">
                  Avatar URL fallback
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={data.profile.avatarUrl ?? ""}
                  disabled={pending}
                  id="avatarUrl"
                  name="avatarUrl"
                  placeholder="https://..."
                  type="text"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="bio">
              Bio
            </label>
            <textarea
              className="mt-2 min-h-32 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              defaultValue={data.profile.bio ?? ""}
              disabled={pending}
              id="bio"
              maxLength={600}
              name="bio"
              placeholder="Tell people what you listen to, stream, produce, or support on Bouncecore."
            />
          </div>

          <label className="flex items-start gap-3 rounded-md border border-bc-line bg-bc-ink p-4">
            <input
              className="mt-1 h-4 w-4 accent-bc-electric"
              defaultChecked={data.profile.isPublic}
              disabled={pending}
              name="isPublic"
              type="checkbox"
            />
            <span>
              <span className="flex items-center gap-2 font-semibold">
                {data.profile.isPublic ? (
                  <Eye className="h-4 w-4 text-bc-acid" aria-hidden="true" />
                ) : (
                  <EyeOff className="h-4 w-4 text-bc-muted" aria-hidden="true" />
                )}
                Show profile publicly
              </span>
              <span className="mt-1 block text-sm text-bc-muted">
                Public profiles can appear on creator-facing public surfaces when your roles allow it.
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
          <Badge tone={data.profile.isPublic ? "acid" : "muted"}>{data.profile.isPublic ? "Public" : "Hidden"}</Badge>
          <h3 className="mt-4 text-xl font-black">{data.displayName}</h3>
          <p className="mt-2 text-sm text-bc-muted">{data.email}</p>
          <p className="mt-2 text-xs text-bc-muted">Joined {formatDate(data.createdAt)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {visibleRoleBadges(data.roles).map((role) => (
              <Badge key={role} tone={roleBadgeTone(role)}>
                {roleDisplayName(role, roleDisplayLabels)}
              </Badge>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Profile data</Badge>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-bc-muted">Slug</span>
              <span className="font-semibold">{data.profile.slug}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-bc-muted">Location</span>
              <span className="font-semibold">{data.profile.location ?? "Not set"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-bc-muted">Website</span>
              <span className="font-semibold">{data.profile.websiteUrl ? "Set" : "Not set"}</span>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}
