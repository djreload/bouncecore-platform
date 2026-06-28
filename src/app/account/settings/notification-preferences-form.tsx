"use client";

import { useActionState } from "react";
import { Bell, Mail, Save, Smartphone } from "lucide-react";
import { updateNotificationPreferencesAction } from "@/app/account/settings/actions";
import {
  initialNotificationPreferencesActionState,
  type NotificationPreferencesActionState
} from "@/app/account/settings/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  notificationPreferenceCategories,
  type NotificationPreferences
} from "@/lib/account/notification-preferences-core";

type NotificationPreferencesFormProps = {
  preferences: NotificationPreferences;
};

export function NotificationPreferencesForm({ preferences }: NotificationPreferencesFormProps) {
  const [state, formAction, pending] = useActionState<NotificationPreferencesActionState, FormData>(
    updateNotificationPreferencesAction,
    initialNotificationPreferencesActionState
  );

  return (
    <form action={formAction} className="rounded-md border border-bc-line bg-bc-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-bc-acid" aria-hidden="true" />
            <h3 className="text-xl font-black">Notification delivery</h3>
          </div>
          <p className="mt-2 text-sm text-bc-muted">Choose which updates can reach you by email and mobile push.</p>
        </div>
        <Badge tone="cyan">Preferences</Badge>
      </div>

      {state.message ? (
        <div
          className={`mt-4 rounded-md border p-3 text-sm ${
            state.status === "error"
              ? "border-bc-pink/30 bg-bc-pink/10 text-bc-pink"
              : "border-bc-acid/30 bg-bc-acid/10 text-bc-acid"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3">
        {notificationPreferenceCategories.map((category) => (
          <div
            className="grid gap-3 rounded-md border border-bc-line bg-bc-ink p-4 md:grid-cols-[1fr_auto]"
            key={category.key}
          >
            <div>
              <p className="font-semibold">{category.label}</p>
              <p className="mt-1 text-sm text-bc-muted">{category.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex min-h-9 items-center gap-2 rounded-md border border-bc-line bg-bc-panel px-3 text-sm font-semibold">
                <input
                  className="h-4 w-4 accent-bc-electric"
                  defaultChecked={preferences[category.key].email}
                  disabled={pending}
                  name={`${category.key}:email`}
                  type="checkbox"
                />
                <Mail className="h-4 w-4 text-bc-electric" aria-hidden="true" />
                Email
              </label>
              <label className="flex min-h-9 items-center gap-2 rounded-md border border-bc-line bg-bc-panel px-3 text-sm font-semibold">
                <input
                  className="h-4 w-4 accent-bc-acid"
                  defaultChecked={preferences[category.key].push}
                  disabled={pending}
                  name={`${category.key}:push`}
                  type="checkbox"
                />
                <Smartphone className="h-4 w-4 text-bc-acid" aria-hidden="true" />
                Push
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <Button disabled={pending} type="submit" variant="primary">
          <Save className="h-4 w-4" aria-hidden="true" />
          Save preferences
        </Button>
      </div>
    </form>
  );
}
