"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Cookie, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  consentCategories,
  cookieConsentStorageKey,
  createConsentRecord,
  defaultConsentPreferences,
  normalizeConsentRecord,
  type ConsentCategoryKey,
  type ConsentPreferences,
  type ConsentRecord
} from "@/lib/privacy/consent-core";
import {
  cookiePolicyHref,
  privacyChoicesEventName,
  privacyConsentUpdatedEventName,
  privacyPolicyHref
} from "@/lib/privacy/privacy-config";

function readStoredConsent() {
  try {
    return normalizeConsentRecord(JSON.parse(window.localStorage.getItem(cookieConsentStorageKey) ?? "null"));
  } catch {
    return null;
  }
}

function saveStoredConsent(preferences: ConsentPreferences) {
  const record = createConsentRecord(preferences);
  window.localStorage.setItem(cookieConsentStorageKey, JSON.stringify(record));
  window.dispatchEvent(new CustomEvent(privacyConsentUpdatedEventName, { detail: record }));
  return record;
}

export function CookieConsentManager() {
  const [loaded, setLoaded] = useState(false);
  const [record, setRecord] = useState<ConsentRecord | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [draft, setDraft] = useState<ConsentPreferences>(defaultConsentPreferences);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = readStoredConsent();
      setRecord(stored);
      setDraft(stored?.preferences ?? defaultConsentPreferences());
      setPanelOpen(!stored);
      setLoaded(true);
    });

    function openPreferences() {
      const latest = readStoredConsent();
      setRecord(latest);
      setDraft(latest?.preferences ?? defaultConsentPreferences());
      setCustomizing(true);
      setPanelOpen(true);
    }

    window.addEventListener(privacyChoicesEventName, openPreferences);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(privacyChoicesEventName, openPreferences);
    };
  }, []);

  const allAccepted = useMemo(
    () =>
      consentCategories.reduce<ConsentPreferences>(
        (preferences, category) => ({
          ...preferences,
          [category.key]: true
        }),
        defaultConsentPreferences()
      ),
    []
  );

  if (!loaded) {
    return null;
  }

  function persist(preferences: ConsentPreferences) {
    setRecord(saveStoredConsent(preferences));
    setDraft(preferences);
    setCustomizing(false);
    setPanelOpen(false);
  }

  function setCategory(key: ConsentCategoryKey, value: boolean) {
    if (key === "necessary") {
      return;
    }

    setDraft((current) => ({
      ...current,
      [key]: value,
      necessary: true
    }));
  }

  return (
    <>
      {record && !panelOpen ? (
        <button
          className="bc-focus-ring fixed bottom-4 left-4 z-[70] inline-flex min-h-9 items-center gap-2 rounded-md border border-bc-line bg-bc-panel/95 px-3 text-xs font-semibold text-white shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur hover:border-bc-electric/60"
          onClick={() => {
            setDraft(record.preferences);
            setCustomizing(true);
            setPanelOpen(true);
          }}
          type="button"
        >
          <ShieldCheck className="h-4 w-4 text-bc-acid" aria-hidden="true" />
          Privacy choices
        </button>
      ) : null}

      {panelOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-bc-line bg-bc-void/95 px-4 py-4 text-white shadow-[0_-20px_80px_rgba(0,0,0,0.7)] backdrop-blur">
          <section className="mx-auto max-w-5xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2">
                  <Cookie className="h-5 w-5 text-bc-electric" aria-hidden="true" />
                  <h2 className="text-lg font-black">Privacy and cookie choices</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-bc-muted">
                  Bouncecore uses necessary cookies and browser storage for sign-in, checkout, carts, chat, security, and app
                  operation. Optional analytics, marketing, and preference storage only run when enabled here.
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-bc-muted">
                  <Link className="bc-focus-ring rounded-sm hover:text-bc-electric" href={privacyPolicyHref}>
                    Privacy Policy
                  </Link>
                  <Link className="bc-focus-ring rounded-sm hover:text-bc-electric" href={cookiePolicyHref}>
                    Cookie Policy
                  </Link>
                </div>
              </div>
              {record ? (
                <button
                  aria-label="Close privacy choices"
                  className="bc-focus-ring grid h-9 w-9 place-items-center rounded-md border border-bc-line bg-bc-ink text-white"
                  onClick={() => setPanelOpen(false)}
                  type="button"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            {customizing ? (
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                {consentCategories.map((category) => (
                  <label className="rounded-md border border-bc-line bg-bc-panel p-3 text-sm" key={category.key}>
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-black">{category.label}</span>
                      <input
                        checked={draft[category.key]}
                        className="h-4 w-4 accent-bc-electric"
                        disabled={category.required}
                        onChange={(event) => setCategory(category.key, event.target.checked)}
                        type="checkbox"
                      />
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-bc-muted">{category.description}</span>
                  </label>
                ))}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => persist(allAccepted)} size="sm" type="button" variant="primary">
                <Check className="h-4 w-4" aria-hidden="true" />
                Accept all
              </Button>
              <Button onClick={() => persist(defaultConsentPreferences())} size="sm" type="button" variant="ghost">
                Necessary only
              </Button>
              {customizing ? (
                <Button onClick={() => persist(draft)} size="sm" type="button" variant="pink">
                  Save choices
                </Button>
              ) : (
                <Button onClick={() => setCustomizing(true)} size="sm" type="button" variant="ghost">
                  Customise
                </Button>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
