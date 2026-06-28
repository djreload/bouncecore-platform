import Link from "next/link";
import { PublicShell } from "@/components/layout/public-shell";
import { ButtonLink } from "@/components/ui/button";
import { cookiePolicyHref, privacyPolicyHref } from "@/lib/privacy/privacy-config";

export default function MobilePrivacyChoicesPage() {
  return (
    <PublicShell>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <section className="rounded-md border border-bc-line bg-bc-panel p-6">
          <p className="text-sm font-semibold uppercase text-bc-electric">Mobile app privacy</p>
          <h1 className="mt-2 text-3xl font-black">Mobile privacy choices</h1>
          <p className="mt-4 leading-7 text-bc-muted">
            The Android app stores native choices for mobile advertising and notification permissions on the device. Open this page
            inside the Bouncecore Android app to change mobile ad consent.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <ButtonLink href={privacyPolicyHref} variant="primary">
              Privacy Policy
            </ButtonLink>
            <ButtonLink href={cookiePolicyHref} variant="ghost">
              Cookie Policy
            </ButtonLink>
          </div>
          <p className="mt-5 text-sm text-bc-muted">
            Notification delivery can also be changed from{" "}
            <Link className="font-semibold text-bc-electric hover:text-white" href="/account/settings">
              account settings
            </Link>{" "}
            and from Android system app settings.
          </p>
        </section>
      </main>
    </PublicShell>
  );
}
