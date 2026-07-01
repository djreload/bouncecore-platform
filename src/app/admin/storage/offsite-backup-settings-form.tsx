"use client";

import { useActionState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { syncOffsiteBackupConfigAction, updateOffsiteBackupSettingsAction } from "@/app/admin/storage/actions";
import { initialAdminStorageActionState, type AdminStorageActionState } from "@/app/admin/storage/state";
import { Button } from "@/components/ui/button";
import type { OffsiteBackupSettings } from "@/lib/admin/offsite-backup-settings";

type OffsiteBackupSettingsFormProps = {
  configFilePresent: boolean;
  configVolumePath: string;
  settings: OffsiteBackupSettings;
};

const inputClasses = "min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white";

export function OffsiteBackupSettingsForm({ configFilePresent, configVolumePath, settings }: OffsiteBackupSettingsFormProps) {
  const [state, formAction, pending] = useActionState<AdminStorageActionState, FormData>(
    updateOffsiteBackupSettingsAction,
    initialAdminStorageActionState
  );
  const [syncState, syncAction, syncPending] = useActionState<AdminStorageActionState, FormData>(
    syncOffsiteBackupConfigAction,
    initialAdminStorageActionState
  );

  return (
    <div className="grid gap-4">
      <form action={formAction} className="grid gap-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-white">
            rclone destination
            <input
              className={inputClasses}
              defaultValue={settings.rcloneRemote ?? ""}
              name="rcloneRemote"
              placeholder="remote:bucket/path"
            />
            <span className="text-xs font-normal leading-5 text-bc-muted">
              External backup location. The named rclone remote must already exist on the server running the backup timer.
            </span>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-white">
            age public recipient
            <input
              className={inputClasses}
              defaultValue={settings.ageRecipient ?? ""}
              name="ageRecipient"
              placeholder="age1..."
            />
            <span className="text-xs font-normal leading-5 text-bc-muted">
              Paste only the public recipient. Keep the private age identity key off this web server.
            </span>
          </label>
        </div>

        <label className="grid gap-2 text-sm font-semibold text-white">
          Local encrypted export directory
          <input
            className={inputClasses}
            defaultValue={settings.outputDir ?? ""}
            name="outputDir"
            placeholder="/srv/bouncecore-backups/offsite"
          />
          <span className="text-xs font-normal leading-5 text-bc-muted">
            Optional. Leave blank to use the backup root&apos;s offsite folder before upload.
          </span>
        </label>

        <div className="grid gap-3 rounded-md border border-bc-line bg-bc-ink p-4">
          <label className="flex items-start gap-3 text-sm font-semibold text-white">
            <input className="mt-1 h-4 w-4 accent-bc-electric" defaultChecked={settings.enabled} name="enabled" type="checkbox" />
            <span>
              Enable encrypted off-server backup export
              <span className="mt-1 block text-xs font-normal leading-5 text-bc-muted">
                Scheduled backups automatically read this saved config from uploads volume path {configVolumePath}.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm font-semibold text-white">
            <input
              className="mt-1 h-4 w-4 accent-bc-electric"
              defaultChecked={settings.removeLocalAfterUpload}
              name="removeLocalAfterUpload"
              type="checkbox"
            />
            <span>
              Remove local encrypted package after successful upload
              <span className="mt-1 block text-xs font-normal leading-5 text-bc-muted">
                Keep this off unless the rclone destination has been tested and monitored.
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={pending} type="submit" variant="primary">
            <Save className="h-4 w-4" aria-hidden="true" />
            {pending ? "Saving..." : "Save external backup location"}
          </Button>
          {state.message ? (
            <p className={`text-xs ${state.status === "error" ? "text-bc-pink" : "text-bc-acid"}`}>{state.message}</p>
          ) : null}
        </div>
      </form>

      <form action={syncAction} className="flex flex-wrap items-center gap-3 rounded-md border border-bc-line bg-bc-ink p-3">
        <Button disabled={syncPending} size="sm" type="submit" variant="ghost">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {syncPending ? "Rewriting..." : "Rewrite generated config"}
        </Button>
        <span className={`text-xs ${configFilePresent ? "text-bc-acid" : "text-bc-amber"}`}>
          Generated config file is {configFilePresent ? "present" : "missing"}.
        </span>
        {syncState.message ? (
          <p className={`text-xs ${syncState.status === "error" ? "text-bc-pink" : "text-bc-acid"}`}>{syncState.message}</p>
        ) : null}
      </form>
    </div>
  );
}
