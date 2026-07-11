"use client";

import { useActionState, useMemo, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { syncOffsiteBackupConfigAction, updateOffsiteBackupSettingsAction } from "@/app/admin/storage/actions";
import { initialAdminStorageActionState, type AdminStorageActionState } from "@/app/admin/storage/state";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  googleDriveDefaultFolder,
  googleDriveDefaultRemoteName,
  googleDriveRcloneDestination,
  type OffsiteBackupDestinationType
} from "@/lib/admin/offsite-backup-targets";
import {
  type OffsiteBackupSettings
} from "@/lib/admin/offsite-backup-settings";
import type { GoogleDriveBackupConnection } from "@/lib/admin/google-drive-backup-oauth";

type OffsiteBackupSettingsFormProps = {
  configFilePresent: boolean;
  configVolumePath: string;
  googleDriveConnection: GoogleDriveBackupConnection;
  googleDriveMessage: string;
  googleDriveOAuthRedirectUri: string;
  googleDriveStatus: string;
  settings: OffsiteBackupSettings;
};

const inputClasses = "min-h-10 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white";

function googleDriveStatusText(status: string, message: string) {
  if (status === "connected") {
    return "Google Drive connected. Save and enable the external backup location when the age recipient is ready.";
  }

  if (status === "missing-oauth") {
    return message || "Google Drive OAuth credentials are missing.";
  }

  if (status === "denied") {
    return "Google Drive authorization was cancelled or denied.";
  }

  if (status === "state-error") {
    return message || "Google Drive authorization expired. Start the connection again.";
  }

  if (status === "failed" || status === "missing-code") {
    return message || "Google Drive authorization could not be completed.";
  }

  return "";
}

export function OffsiteBackupSettingsForm({
  configFilePresent,
  configVolumePath,
  googleDriveConnection,
  googleDriveMessage,
  googleDriveOAuthRedirectUri,
  googleDriveStatus,
  settings
}: OffsiteBackupSettingsFormProps) {
  const [destinationType, setDestinationType] = useState<OffsiteBackupDestinationType>(settings.destinationType);
  const [googleDriveRemoteName, setGoogleDriveRemoteName] = useState(settings.googleDriveRemoteName ?? googleDriveDefaultRemoteName);
  const [googleDriveFolder, setGoogleDriveFolder] = useState(settings.googleDriveFolder ?? googleDriveDefaultFolder);
  const [state, formAction, pending] = useActionState<AdminStorageActionState, FormData>(
    updateOffsiteBackupSettingsAction,
    initialAdminStorageActionState
  );
  const [syncState, syncAction, syncPending] = useActionState<AdminStorageActionState, FormData>(
    syncOffsiteBackupConfigAction,
    initialAdminStorageActionState
  );
  const googleDriveDestination = useMemo(() => {
    try {
      return googleDriveRcloneDestination(googleDriveRemoteName, googleDriveFolder);
    } catch {
      return `${googleDriveRemoteName || googleDriveDefaultRemoteName}:${googleDriveFolder || googleDriveDefaultFolder}`;
    }
  }, [googleDriveFolder, googleDriveRemoteName]);
  const googleDriveConnectHref = useMemo(() => {
    const params = new URLSearchParams({
      folder: googleDriveFolder || googleDriveDefaultFolder,
      remoteName: googleDriveRemoteName || googleDriveDefaultRemoteName
    });

    return `/admin/storage/google-drive/connect?${params.toString()}`;
  }, [googleDriveFolder, googleDriveRemoteName]);
  const googleDriveStatusMessage = googleDriveStatusText(googleDriveStatus, googleDriveMessage);

  return (
    <div className="grid gap-4">
      <form action={formAction} className="grid gap-4">
        <label className="grid gap-2 text-sm font-semibold text-white">
          Backup destination type
          <select
            className={inputClasses}
            name="destinationType"
            onChange={(event) => setDestinationType(event.target.value === "rclone" ? "rclone" : "google-drive")}
            value={destinationType}
          >
            <option value="google-drive">Google Drive</option>
            <option value="rclone">Custom rclone destination</option>
          </select>
          <span className="text-xs font-normal leading-5 text-bc-muted">
            Google Drive uses a configured rclone Drive remote on the server. Custom rclone can still target S3, R2, SFTP, or another provider.
          </span>
        </label>

        {destinationType === "google-drive" ? (
          <div className="grid gap-3 rounded-md border border-bc-line bg-bc-ink p-4 lg:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-white">
              Google Drive rclone remote name
              <input
                className={inputClasses}
                name="googleDriveRemoteName"
                onChange={(event) => setGoogleDriveRemoteName(event.target.value)}
                placeholder={googleDriveDefaultRemoteName}
                value={googleDriveRemoteName}
              />
              <span className="text-xs font-normal leading-5 text-bc-muted">
                Name of the rclone Google Drive remote configured on the server. Recommended: {googleDriveDefaultRemoteName}.
              </span>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-white">
              Google Drive folder
              <input
                className={inputClasses}
                name="googleDriveFolder"
                onChange={(event) => setGoogleDriveFolder(event.target.value)}
                placeholder={googleDriveDefaultFolder}
                value={googleDriveFolder}
              />
              <span className="text-xs font-normal leading-5 text-bc-muted">
                Folder path inside Google Drive for encrypted backup packages.
              </span>
            </label>

            <div className="lg:col-span-2">
              <p className="rounded-md border border-bc-line bg-black/20 px-3 py-2 text-xs text-bc-muted">
                Generated rclone destination: <span className="font-semibold text-white">{googleDriveDestination}</span>
              </p>
            </div>

            <div className="grid gap-3 rounded-md border border-bc-line bg-black/20 p-3 lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={googleDriveConnection.oauthConfigured ? "acid" : "amber"}>
                      OAuth {googleDriveConnection.oauthConfigured ? "configured" : "missing"}
                    </Badge>
                    <Badge tone={googleDriveConnection.connected ? "acid" : "amber"}>
                      Drive {googleDriveConnection.connected ? "connected" : "not connected"}
                    </Badge>
                    <Badge tone={googleDriveConnection.configFilePresent ? "acid" : "amber"}>
                      Token config {googleDriveConnection.configFilePresent ? "present" : "missing"}
                    </Badge>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-bc-muted">{googleDriveConnection.setupDetail}</p>
                  <p className="mt-2 break-all text-xs text-bc-muted">
                    Redirect URI for Google Cloud OAuth:{" "}
                    <span className="font-semibold text-white">{googleDriveOAuthRedirectUri}</span>
                  </p>
                  {googleDriveConnection.connectedAt ? (
                    <p className="mt-2 text-xs text-bc-muted">Connected at {googleDriveConnection.connectedAt}</p>
                  ) : null}
                  <p className="mt-2 break-all text-xs text-bc-muted">
                    Generated token config path: {googleDriveConnection.volumePath}
                  </p>
                </div>
                {googleDriveConnection.oauthConfigured ? (
                  <ButtonLink href={googleDriveConnectHref} size="sm" variant="primary">
                    Connect Google Drive
                  </ButtonLink>
                ) : (
                  <Button disabled size="sm" type="button" variant="ghost">
                    Connect Google Drive
                  </Button>
                )}
              </div>
              {googleDriveStatusMessage ? (
                <p
                  className={`rounded-md border px-3 py-2 text-xs ${
                    googleDriveStatus === "connected"
                      ? "border-bc-acid/40 bg-bc-acid/10 text-bc-acid"
                      : "border-bc-amber/40 bg-bc-amber/10 text-bc-amber"
                  }`}
                >
                  {googleDriveStatusMessage}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <input name="googleDriveRemoteName" type="hidden" value={googleDriveRemoteName} />
            <input name="googleDriveFolder" type="hidden" value={googleDriveFolder} />
          </>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-white">
            Custom rclone destination
            <input
              className={inputClasses}
              disabled={destinationType === "google-drive"}
              defaultValue={settings.rcloneRemote ?? ""}
              name="rcloneRemote"
              placeholder="remote:bucket/path"
            />
            <span className="text-xs font-normal leading-5 text-bc-muted">
              Used only for custom rclone mode. For Google Drive, Bouncecore generates this from the remote name and folder above.
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
