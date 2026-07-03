"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { BadgeDollarSign, BellRing, Download, Megaphone, Save, Settings2, Smartphone, Upload, Wrench } from "lucide-react";
import { adminMobileAction } from "@/app/admin/mobile/actions";
import { initialAdminMobileActionState, type AdminMobileActionState } from "@/app/admin/mobile/state";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { uploadAdminMedia } from "@/lib/media/admin-upload-client";
import type { AdminMobileConfigData, MobileFeatureKey } from "@/lib/admin/mobile-service";

type AdminMobilePanelProps = {
  data: AdminMobileConfigData;
  repairFilter?: AdminMobileRepairFilter | null;
};

type AdminMobileRepairFilter = "update-url";

const mobileFeatureKeys = ["live", "chat", "shop", "music", "rewards", "ads", "push"] as const satisfies readonly MobileFeatureKey[];
const mobileThemeModes = ["dark", "light"] as const;
const appOpenInterstitialFrequencies = ["every_open", "once_per_session", "disabled"] as const;

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not saved";
}

function checkTone(status: string) {
  return status === "ready" ? ("acid" as const) : ("amber" as const);
}

function featureLabel(value: string) {
  return value.replaceAll("-", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function frequencyLabel(value: string) {
  return featureLabel(value.replaceAll("_", " "));
}

function repairLabel() {
  return {
    detail:
      "Review the Android update URL and save a valid HTTPS APK or release page URL. Invalid saved URLs are hidden from the public mobile config.",
    title: "Android update URL"
  };
}

function formFile(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

function absoluteUrl(pathOrUrl: string) {
  if (/^https:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return new URL(pathOrUrl, window.location.origin).toString();
}

export function AdminMobilePanel({ data, repairFilter = null }: AdminMobilePanelProps) {
  const [state, formAction, pending] = useActionState<AdminMobileActionState, FormData>(
    adminMobileAction,
    initialAdminMobileActionState
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const activeRepair = repairFilter === "update-url" ? repairLabel() : null;
  const busy = pending || uploading;

  async function handleConfigSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const apkFile = formFile(formData, "androidApkFile");

    setUploadError(null);

    try {
      if (apkFile) {
        setUploading(true);
        formData.set("androidUpdateUrl", absoluteUrl(await uploadAdminMedia("mobile-apk", apkFile)));
      }

      formData.delete("androidApkFile");

      startTransition(() => {
        formAction(formData);
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "APK upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Endpoint</Badge>
          <p className="mt-4 text-3xl font-black">{data.config.apiVersion}</p>
          <p className="mt-2 break-all text-sm text-bc-muted">{data.stats.publicEndpoint}</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Features</Badge>
          <p className="mt-4 text-3xl font-black">
            {data.stats.enabledFeatures}/{mobileFeatureKeys.length}
          </p>
          <p className="mt-2 text-sm text-bc-muted">Enabled for the mobile API.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.config.maintenance.enabled ? "amber" : "acid"}>Maintenance</Badge>
          <p className="mt-4 text-3xl font-black">{data.config.maintenance.enabled ? "On" : "Off"}</p>
          <p className="mt-2 text-sm text-bc-muted">{data.config.maintenance.message ?? "Normal operation."}</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={data.source === "database" ? "acid" : "amber"}>Saved</Badge>
          <p className="mt-4 text-3xl font-black capitalize">{data.source}</p>
          <p className="mt-2 text-sm text-bc-muted">{formatDate(data.stats.updatedAt)}</p>
        </article>
      </div>

      {activeRepair ? (
        <section className="rounded-md border border-bc-acid/35 bg-bc-acid/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge tone="acid">Repair focus</Badge>
              <h3 className="mt-2 text-xl font-black">{activeRepair.title}</h3>
              <p className="mt-1 max-w-3xl text-sm text-bc-muted">{activeRepair.detail}</p>
            </div>
            <ButtonLink href="/admin/mobile" size="sm" variant="ghost">
              Clear focus
            </ButtonLink>
          </div>
        </section>
      ) : null}

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="pink">Mobile API</Badge>
            <h3 className="mt-4 text-2xl font-black">App configuration</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              These values are returned by the public mobile config endpoint and can be consumed by native app clients.
            </p>
          </div>
          <Smartphone className="h-7 w-7 text-bc-pink" aria-hidden="true" />
        </div>

        {uploadError || state.message ? (
          <div
            className={`mt-5 rounded-md border p-3 text-sm ${
              uploadError || state.status === "error"
                ? "border-bc-pink/30 bg-bc-pink/10 text-bc-pink"
                : "border-bc-acid/30 bg-bc-acid/10 text-bc-acid"
            }`}
          >
            {uploadError ?? state.message}
          </div>
        ) : null}

        <form action={formAction} className="mt-5 grid gap-5" encType="multipart/form-data" onSubmit={handleConfigSubmit}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-app-name">
                App name
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.config.appName}
                disabled={pending}
                id="mobile-app-name"
                name="appName"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-environment">
                Environment label
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.config.environment}
                disabled={pending}
                id="mobile-environment"
                name="environmentLabel"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-support-email">
                Support email
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.config.supportEmail ?? ""}
                disabled={pending}
                id="mobile-support-email"
                name="supportEmail"
                type="email"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-theme-mode">
                Theme mode
              </label>
              <select
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
                defaultValue={data.config.theme.mode}
                disabled={pending}
                id="mobile-theme-mode"
                name="themeMode"
              >
                {mobileThemeModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-accent">
              Accent
            </label>
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
              defaultValue={data.config.theme.accent}
              disabled={pending}
              id="mobile-accent"
              name="accent"
            />
          </div>

          <div className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-bc-electric" aria-hidden="true" />
              <h4 className="font-black">Feature flags</h4>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {mobileFeatureKeys.map((feature) => (
                <label className="flex items-center gap-3 rounded-md border border-bc-line bg-bc-panel p-3 text-sm" key={feature}>
                  <input
                    defaultChecked={data.config.features[feature]}
                    disabled={pending}
                    name={`feature_${feature}`}
                    type="checkbox"
                  />
                  {featureLabel(feature)}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-bc-pink" aria-hidden="true" />
                <h4 className="font-black">Android push</h4>
              </div>
              <Badge tone={data.config.push.enabled ? "acid" : "muted"}>
                {data.config.push.enabled ? "enabled" : "disabled"}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-bc-muted">
              These public Firebase Android values let the native app request an FCM token and register it after the user logs in.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-4">
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-firebase-project-id">
                  Firebase project ID
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={data.config.push.firebaseAndroid.projectId ?? ""}
                  disabled={pending}
                  id="mobile-firebase-project-id"
                  name="firebaseProjectId"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-firebase-sender-id">
                  Sender ID
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={data.config.push.firebaseAndroid.messagingSenderId ?? ""}
                  disabled={pending}
                  id="mobile-firebase-sender-id"
                  name="firebaseMessagingSenderId"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-firebase-app-id">
                  Android app ID
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={data.config.push.firebaseAndroid.appId ?? ""}
                  disabled={pending}
                  id="mobile-firebase-app-id"
                  name="firebaseAndroidAppId"
                  placeholder="1:000000000000:android:abc123"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-firebase-api-key">
                  Android API key
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={data.config.push.firebaseAndroid.apiKey ?? ""}
                  disabled={pending}
                  id="mobile-firebase-api-key"
                  name="firebaseAndroidApiKey"
                />
              </div>
            </div>
          </div>

          <div className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BadgeDollarSign className="h-5 w-5 text-bc-acid" aria-hidden="true" />
                <h4 className="font-black">LevelPlay ads</h4>
              </div>
              <Badge tone={data.config.ads.enabled ? "acid" : "muted"}>
                {data.config.ads.enabled ? "enabled" : "disabled"}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-bc-muted">
              These public native app values are returned by the mobile config endpoint and consumed by the Android wrapper.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-levelplay-app-key">
                  App key
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={data.config.ads.levelPlay.appKey ?? ""}
                  disabled={pending}
                  id="mobile-levelplay-app-key"
                  name="levelPlayAppKey"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-levelplay-banner-id">
                  Banner ad unit ID
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={data.config.ads.levelPlay.bannerAdUnitId ?? ""}
                  disabled={pending}
                  id="mobile-levelplay-banner-id"
                  name="levelPlayBannerAdUnitId"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-levelplay-interstitial-id">
                  Interstitial ad unit ID
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={data.config.ads.levelPlay.interstitialAdUnitId ?? ""}
                  disabled={pending}
                  id="mobile-levelplay-interstitial-id"
                  name="levelPlayInterstitialAdUnitId"
                />
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <label className="flex items-center gap-3 rounded-md border border-bc-line bg-bc-panel p-3 text-sm">
                <input
                  defaultChecked={data.config.ads.behavior.bannerEnabled}
                  disabled={pending}
                  name="levelPlayBannerEnabled"
                  type="checkbox"
                />
                Show banner ads
              </label>
              <label className="flex items-center gap-3 rounded-md border border-bc-line bg-bc-panel p-3 text-sm">
                <input
                  defaultChecked={data.config.ads.behavior.appOpenInterstitialEnabled}
                  disabled={pending}
                  name="levelPlayAppOpenInterstitialEnabled"
                  type="checkbox"
                />
                Show app-open interstitials
              </label>
              <div>
                <label
                  className="text-xs font-semibold uppercase text-bc-muted"
                  htmlFor="mobile-levelplay-app-open-frequency"
                >
                  App-open frequency
                </label>
                <select
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={data.config.ads.behavior.appOpenInterstitialFrequency}
                  disabled={pending}
                  id="mobile-levelplay-app-open-frequency"
                  name="levelPlayAppOpenInterstitialFrequency"
                >
                  {appOpenInterstitialFrequencies.map((frequency) => (
                    <option key={frequency} value={frequency}>
                      {frequencyLabel(frequency)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="mt-4 flex items-center gap-3 rounded-md border border-bc-line bg-bc-panel p-3 text-sm">
              <input
                defaultChecked={data.config.ads.levelPlay.testSuiteEnabled}
                disabled={pending}
                name="levelPlayTestSuiteEnabled"
                type="checkbox"
              />
              Launch LevelPlay test suite on app start
            </label>
          </div>

          <div className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-bc-electric" aria-hidden="true" />
                <h4 className="font-black">Android app updates</h4>
              </div>
              <Badge tone={data.config.version.minimumSupportedVersionCode > 1 ? "amber" : "acid"}>
                min build {data.config.version.minimumSupportedVersionCode}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-bc-muted">
              The native Android wrapper blocks outdated APKs when their build number is below the minimum supported build.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-4">
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-android-min-version">
                  Minimum build
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={data.config.version.minimumSupportedVersionCode}
                  disabled={pending}
                  id="mobile-android-min-version"
                  min={1}
                  name="androidMinimumVersionCode"
                  type="number"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-android-latest-version">
                  Latest build
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={data.config.version.latestVersionCode ?? ""}
                  disabled={pending}
                  id="mobile-android-latest-version"
                  min={1}
                  name="androidLatestVersionCode"
                  type="number"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-android-latest-name">
                  Latest version name
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={data.config.version.latestVersionName ?? ""}
                  disabled={pending}
                  id="mobile-android-latest-name"
                  name="androidLatestVersionName"
                  placeholder="1.0.0"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-android-update-url">
                  Update URL
                </label>
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                  defaultValue={data.config.version.updateUrl ?? ""}
                  disabled={pending}
                  id="mobile-android-update-url"
                  name="androidUpdateUrl"
                  placeholder="Paste HTTPS APK update URL"
                  type="url"
                />
              </div>
            </div>
            <div className="mt-4 rounded-md border border-bc-line bg-bc-panel p-3">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-bc-electric" aria-hidden="true" />
                <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-android-apk-file">
                  Upload APK
                </label>
              </div>
              <input
                accept=".apk,application/vnd.android.package-archive,application/octet-stream"
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-bc-electric file:px-3 file:py-1 file:text-sm file:font-semibold file:text-bc-void"
                disabled={busy}
                id="mobile-android-apk-file"
                name="androidApkFile"
                type="file"
              />
              <p className="mt-2 text-xs text-bc-muted">
                Upload a signed `.apk` to this site and save its generated HTTPS URL as the mobile update/download URL.
              </p>
            </div>
            <label className="mt-4 block text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-android-update-message">
              Required update message
            </label>
            <textarea
              className="mt-2 min-h-20 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
              defaultValue={data.config.version.updateMessage}
              disabled={pending}
              id="mobile-android-update-message"
              name="androidUpdateMessage"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-bc-line bg-bc-ink p-4">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-bc-amber" aria-hidden="true" />
                <h4 className="font-black">Maintenance</h4>
              </div>
              <label className="mt-4 flex items-center gap-3 rounded-md border border-bc-line bg-bc-panel p-3 text-sm">
                <input
                  defaultChecked={data.config.maintenance.enabled}
                  disabled={pending}
                  name="maintenanceEnabled"
                  type="checkbox"
                />
                Enable maintenance mode
              </label>
              <label className="mt-4 block text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-maintenance-message">
                Maintenance message
              </label>
              <textarea
                className="mt-2 min-h-28 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                defaultValue={data.config.maintenance.message ?? ""}
                disabled={pending}
                id="mobile-maintenance-message"
                name="maintenanceMessage"
              />
            </div>

            <div className="rounded-md border border-bc-line bg-bc-ink p-4">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-bc-pink" aria-hidden="true" />
                <h4 className="font-black">Announcement</h4>
              </div>
              <label className="mt-4 block text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-announcement-title">
                Announcement title
              </label>
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                defaultValue={data.config.announcement?.title ?? ""}
                disabled={pending}
                id="mobile-announcement-title"
                name="announcementTitle"
              />
              <label className="mt-4 block text-xs font-semibold uppercase text-bc-muted" htmlFor="mobile-announcement-body">
                Announcement body
              </label>
              <textarea
                className="mt-2 min-h-24 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
                defaultValue={data.config.announcement?.body ?? ""}
                disabled={pending}
                id="mobile-announcement-body"
                name="announcementBody"
              />
            </div>
          </div>

          <div>
            <Button disabled={busy} type="submit" variant="primary">
              <Save className="h-4 w-4" aria-hidden="true" />
              {uploading ? "Uploading APK..." : "Save app config"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-xl font-black">Readiness</h3>
          <Badge tone="muted">mobile-v1</Badge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {data.checks.map((check) => (
            <div className="rounded-md border border-bc-line bg-bc-ink p-3" key={check.label}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold">{check.label}</p>
                <Badge tone={checkTone(check.status)}>{check.value}</Badge>
              </div>
              <p className="mt-2 text-sm text-bc-muted">{check.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
