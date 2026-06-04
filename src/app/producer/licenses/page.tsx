import { BadgeCheck, FileText, Users } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { requireUserPermission } from "@/lib/auth/guards";
import { getProducerLicensesData } from "@/lib/music/music-service";

export const dynamic = "force-dynamic";

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function ProducerLicensesPage() {
  const user = await requireUserPermission("producer.dashboard");
  const data = await getProducerLicensesData(user.id);

  return (
    <DashboardShell mode="producer" title="Licenses" description="Issued music licenses from paid Bouncecore track purchases.">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">Issued</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.issuedLicenses}</p>
          <p className="mt-2 text-sm text-bc-muted">Paid purchase licenses.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="acid">Downloaded</Badge>
          <p className="mt-4 text-3xl font-black">{data.stats.downloadedLicenses}</p>
          <p className="mt-2 text-sm text-bc-muted">Licenses with delivery clicks.</p>
        </article>
        <article className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="pink">Gross</Badge>
          <p className="mt-4 text-3xl font-black">{formatMoney(data.stats.grossPence)}</p>
          <p className="mt-2 text-sm text-bc-muted">Gross license sale value.</p>
        </article>
      </div>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel">
        <div className="border-b border-bc-line p-4">
          <h3 className="text-xl font-black">Issued licenses</h3>
          <p className="mt-1 text-sm text-bc-muted">Each paid track purchase creates a buyer license record.</p>
        </div>
        <div className="grid gap-4 p-4">
          {data.licenses.map((license) => (
            <article className="rounded-md border border-bc-line bg-bc-ink p-4" key={license.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="acid">paid</Badge>
                    <Badge tone="cyan">{license.licenseType}</Badge>
                    <Badge tone="muted">#{license.id.slice(0, 8)}</Badge>
                  </div>
                  <h4 className="mt-3 text-lg font-black">{license.trackTitle}</h4>
                  <p className="mt-1 text-sm text-bc-muted">
                    {license.buyerName} / {license.buyerEmail}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black">{license.downloadCount}</p>
                  <p className="mt-1 text-xs text-bc-muted">Downloads</p>
                </div>
              </div>
              <div className="mt-4 rounded-md border border-bc-line bg-bc-panel p-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-bc-acid" aria-hidden="true" />
                  <p className="text-sm font-semibold">{formatDate(license.completedAt)}</p>
                </div>
                <p className="mt-2 text-sm text-bc-muted">
                  {license.licenseSummary ??
                    "Personal listening and DJ set use. Redistribution, resale, and re-uploading are not included unless agreed separately."}
                </p>
              </div>
            </article>
          ))}

          {!data.licenses.length ? (
            <article className="rounded-md border border-bc-line bg-bc-ink p-5">
              <Users className="h-7 w-7 text-bc-acid" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-black">No licenses issued yet</h3>
              <p className="mt-2 text-sm text-bc-muted">Paid music purchases will create license records here.</p>
            </article>
          ) : null}
        </div>
      </section>

      <section className="mt-5 rounded-md border border-bc-line bg-bc-panel p-5">
        <BadgeCheck className="h-7 w-7 text-bc-acid" aria-hidden="true" />
        <h3 className="mt-4 text-xl font-black">License source</h3>
        <p className="mt-2 text-sm text-bc-muted">
          License terms are snapshotted when checkout starts. If a legacy purchase has no snapshot, the current track license terms are shown.
        </p>
      </section>
    </DashboardShell>
  );
}
