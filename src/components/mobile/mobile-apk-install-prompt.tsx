"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";

type PublicMobileConfig = {
  app?: string;
  version?: {
    latestVersionName?: string | null;
    updateUrl?: string | null;
  };
};

function isAndroidBrowser(userAgent: string) {
  const isAndroid = /Android/i.test(userAgent);
  const isWebView = /\bwv\b/i.test(userAgent) || /BouncecoreAndroid/i.test(userAgent);

  return isAndroid && !isWebView;
}

export function MobileApkInstallPrompt() {
  const [config, setConfig] = useState<PublicMobileConfig | null>(null);
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const updateUrl = config?.version?.updateUrl?.trim() ?? "";
  const appName = config?.app?.trim() || "Bouncecore";
  const latestVersionName = config?.version?.latestVersionName?.trim() ?? "";
  const dismissKey = useMemo(() => (updateUrl ? `bouncecore.mobileApkPrompt.dismissed:${updateUrl}` : null), [updateUrl]);

  useEffect(() => {
    if (!isAndroidBrowser(window.navigator.userAgent)) {
      return;
    }

    let active = true;

    async function loadConfig() {
      try {
        const response = await fetch("/api/mobile/v1/config", {
          cache: "no-store"
        });
        const payload = (await response.json()) as PublicMobileConfig;

        if (active && response.ok) {
          setConfig(payload);
        }
      } catch {
        // Keep the prompt hidden when the public mobile config cannot be read.
      }
    }

    void loadConfig();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!dismissKey) {
      return;
    }

    const timer = window.setTimeout(() => {
      setDismissed(window.localStorage.getItem(dismissKey) === "1");
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [dismissKey]);

  function dismiss() {
    if (dismissKey) {
      window.localStorage.setItem(dismissKey, "1");
    }

    setDismissed(true);
  }

  if (!updateUrl || dismissed !== false) {
    return null;
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-md rounded-md border border-bc-electric/40 bg-bc-panel/95 p-4 text-white shadow-[0_18px_55px_rgba(0,0,0,0.55)] backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-bc-electric/40 bg-bc-electric/10 text-bc-electric">
          <Smartphone className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-black">{appName} Android app</p>
          <p className="mt-1 text-sm text-bc-muted">
            Download the latest APK{latestVersionName ? ` (${latestVersionName})` : ""} for the full mobile experience.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              className="inline-flex min-h-9 items-center gap-2 rounded-md bg-bc-electric px-3 text-sm font-black text-bc-void transition hover:bg-bc-acid"
              href={updateUrl}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download APK
            </a>
            <button
              className="inline-flex min-h-9 items-center rounded-md border border-bc-line bg-bc-ink px-3 text-sm font-black text-white transition hover:border-bc-pink/60"
              onClick={dismiss}
              type="button"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          aria-label="Dismiss Android app prompt"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-bc-line bg-bc-ink text-bc-muted transition hover:border-bc-pink/60 hover:text-white"
          onClick={dismiss}
          type="button"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
