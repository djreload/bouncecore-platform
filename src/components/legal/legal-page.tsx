import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { getPublicLegalPageData } from "@/lib/admin/site-settings-service";
import type { LegalPageKey } from "@/lib/admin/legal-pages-core";

type LegalPageProps = {
  pageKey: LegalPageKey;
};

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(value)) : "Default policy";
}

function paragraphsFromPlainText(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export async function LegalPage({ pageKey }: LegalPageProps) {
  const { page, siteSettings, updatedAt } = await getPublicLegalPageData(pageKey);

  if (!page?.enabled) {
    notFound();
  }

  return (
    <PublicShell siteSettings={siteSettings}>
      <main className="border-b border-bc-line bg-bc-void">
        <section className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
          <Badge tone="cyan">Policy</Badge>
          <div className="mt-5 flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-bc-electric/35 bg-bc-electric/10 text-bc-electric">
              <FileText className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-4xl font-black sm:text-5xl">{page.title}</h1>
              <p className="mt-3 text-sm text-bc-muted">Last updated: {formatDate(updatedAt)}</p>
            </div>
          </div>

          <div className="mt-8 space-y-5 rounded-md border border-bc-line bg-bc-panel p-5 text-base leading-7 text-bc-muted sm:p-6">
            {paragraphsFromPlainText(page.body).map((paragraph, index) => (
              <p className="whitespace-pre-line" key={index}>
                {paragraph}
              </p>
            ))}
            {siteSettings.supportEmail ? (
              <p>
                Contact:{" "}
                <a className="bc-focus-ring rounded-sm text-white hover:text-bc-electric" href={`mailto:${siteSettings.supportEmail}`}>
                  {siteSettings.supportEmail}
                </a>
              </p>
            ) : null}
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
