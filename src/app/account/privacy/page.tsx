import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { DeleteAccountForm } from "@/app/account/settings/delete-account-form";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ConsentPreferencesButton } from "@/components/privacy/consent-preferences-button";
import { Badge } from "@/components/ui/badge";
import {
  accountDeletionHref,
  cookiePolicyHref,
  mobilePrivacyChoicesHref,
  privacyPolicyHref,
  privacyRequestsHref,
  termsHref
} from "@/lib/privacy/privacy-config";

const policyLinks = [
  { href: privacyPolicyHref, label: "Privacy Policy" },
  { href: cookiePolicyHref, label: "Cookie Policy" },
  { href: termsHref, label: "Terms of Use" },
  { href: mobilePrivacyChoicesHref, label: "Mobile privacy choices" },
  { href: privacyRequestsHref, label: "Submit a privacy request" },
  { href: accountDeletionHref, label: "Public account deletion page" }
];

export default function AccountPrivacyPage() {
  return (
    <DashboardShell
      title="Privacy and data"
      description="Review policies, change consent choices, request privacy help, or permanently remove your account."
    >
      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-6 w-6 text-bc-electric" aria-hidden="true" />
          <div>
            <Badge tone="cyan">Privacy controls</Badge>
            <h3 className="mt-3 text-xl font-black">Policies and consent</h3>
            <p className="mt-2 text-sm leading-6 text-bc-muted">
              Consent choices control optional analytics, marketing, and preference storage. Necessary account storage cannot be disabled.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {policyLinks.map((item) => (
            <Link
              className="bc-focus-ring rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm font-semibold hover:border-bc-electric/60"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="mt-4">
          <ConsentPreferencesButton />
        </div>
      </section>

      <section className="mt-5">
        <DeleteAccountForm />
      </section>
    </DashboardShell>
  );
}
