import { Copy, RefreshCw, ShieldOff } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function StreamKeyPage() {
  return (
    <DashboardShell
      mode="streamer"
      title="My stream key"
      description="Secure self-service area for DJ/Streamer stream keys. Raw keys must only be shown in authenticated dashboard views."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="amber">Private</Badge>
          <h3 className="mt-4 text-2xl font-black">Stream key placeholder</h3>
          <p className="mt-2 text-sm text-bc-muted">
            In production this view will reveal the current user&apos;s active key once, require auth, avoid logs, and
            store only a hash or encrypted secret.
          </p>
          <div className="mt-5 rounded-md border border-dashed border-bc-line bg-bc-ink px-3 py-4 font-mono text-sm text-bc-muted">
            bc_live_••••••••••••••••••••••••••••
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="button" variant="ghost">
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy
            </Button>
            <Button type="button" variant="dark">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Rotate
            </Button>
            <Button type="button" variant="pink">
              <ShieldOff className="h-4 w-4" aria-hidden="true" />
              Revoke
            </Button>
          </div>
        </section>
        <aside className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone="cyan">OBS setup</Badge>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="font-semibold">Server</dt>
              <dd className="mt-1 text-bc-muted">rtmp://develop.k-nrg.co.uk/live</dd>
            </div>
            <div>
              <dt className="font-semibold">Stream key</dt>
              <dd className="mt-1 text-bc-muted">Use your private key, never share it publicly.</dd>
            </div>
          </dl>
        </aside>
      </div>
    </DashboardShell>
  );
}
