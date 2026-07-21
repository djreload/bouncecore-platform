"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Cookie, X } from "lucide-react";
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
  const dialogRef = useRef<HTMLElement>(null);

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

  useEffect(() => {
    if (!panelOpen) {
      return;
    }

    document.documentElement.classList.add("bc-cookie-consent-open");
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() =>
      dialogRef.current?.querySelector<HTMLButtonElement>("[data-cookie-primary]")?.focus()
    );

    function keepFocusInside(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();

        if (record) {
          setPanelOpen(false);
        }

        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const controls = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      const first = controls[0];
      const last = controls.at(-1);

      if (!first || !last) {
        event.preventDefault();
        dialogRef.current.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", keepFocusInside);

    return () => {
      document.documentElement.classList.remove("bc-cookie-consent-open");
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", keepFocusInside);
      previouslyFocused?.focus();
    };
  }, [panelOpen, record]);

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

  return panelOpen
    ? createPortal(
        <div className="bc-cookie-consent-backdrop grid place-items-center overflow-y-auto bg-black/75 p-4 text-white backdrop-blur-sm">
          <section
            aria-describedby="cookie-consent-description"
            aria-labelledby="cookie-consent-title"
            aria-modal="true"
            className="bc-cookie-consent-dialog my-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-md border border-bc-line bg-bc-void/98 p-4 shadow-[0_28px_100px_rgba(0,0,0,0.78),0_0_45px_rgba(0,213,255,0.12)] sm:p-5"
            ref={dialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2">
                  <Cookie className="h-5 w-5 text-bc-electric" aria-hidden="true" />
                  <h2 className="text-lg font-black" id="cookie-consent-title">
                    Privacy and cookie choices
                  </h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-bc-muted" id="cookie-consent-description">
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
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
              <Button data-cookie-primary onClick={() => persist(allAccepted)} size="sm" type="button" variant="primary">
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
        </div>,
        document.body
      )
    : null;
}
