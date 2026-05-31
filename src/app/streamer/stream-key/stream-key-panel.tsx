"use client";

import { useActionState, useState } from "react";
import { Copy, Plus, RefreshCw, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { streamKeyAction } from "@/app/streamer/stream-key/actions";
import { initialStreamKeyActionState, type StreamKeyActionState } from "@/app/streamer/stream-key/state";
import type { StreamKeySummary } from "@/lib/stream/stream-key-service";

type StreamKeyPanelProps = {
  initialKey: StreamKeySummary | null;
  ingestUrl: string;
};

function formatDate(date: string | null) {
  return date
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date))
    : "Not yet";
}

function maskedKey(fingerprint: string | null) {
  return fingerprint ? `bc_live_${fingerprint}_********************************` : "bc_live_********************************";
}

export function StreamKeyPanel({ initialKey, ingestUrl }: StreamKeyPanelProps) {
  const [state, formAction, pending] = useActionState<StreamKeyActionState, FormData>(
    streamKeyAction,
    initialStreamKeyActionState
  );
  const [copied, setCopied] = useState(false);
  const key = state.key !== undefined ? state.key : initialKey;
  const hasActiveKey = Boolean(key && key.status === "active" && !key.revokedAt);

  async function copyRawKey() {
    if (!state.rawKey) {
      return;
    }

    await navigator.clipboard.writeText(state.rawKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <Badge tone={hasActiveKey ? "acid" : "amber"}>{hasActiveKey ? "Active" : "No active key"}</Badge>
        <h3 className="mt-4 text-2xl font-black">Private stream key</h3>
        <p className="mt-2 text-sm text-bc-muted">
          Bouncecore stores only the key hash and fingerprint. Raw keys are shown immediately after create or rotate.
        </p>

        {state.message ? (
          <div
            className={`mt-5 rounded-md border p-3 text-sm ${
              state.status === "error"
                ? "border-bc-pink/30 bg-bc-pink/10 text-bc-pink"
                : "border-bc-acid/30 bg-bc-acid/10 text-bc-acid"
            }`}
          >
            {state.message}
          </div>
        ) : null}

        {state.rawKey ? (
          <div className="mt-5 rounded-md border border-bc-acid/35 bg-bc-acid/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone="acid">Copy now</Badge>
              <button className="inline-flex items-center gap-2 text-sm font-semibold text-bc-acid hover:text-white" onClick={copyRawKey} type="button">
                <Copy className="h-4 w-4" aria-hidden="true" />
                {copied ? "Copied" : "Copy key"}
              </button>
            </div>
            <p className="mt-3 break-all font-mono text-sm text-white">{state.rawKey}</p>
          </div>
        ) : (
          <div className="mt-5 rounded-md border border-dashed border-bc-line bg-bc-ink px-3 py-4 font-mono text-sm text-bc-muted">
            {maskedKey(key?.fingerprint ?? null)}
          </div>
        )}

        <dl className="mt-5 grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-md border border-bc-line bg-bc-ink p-3">
            <dt className="font-semibold">Fingerprint</dt>
            <dd className="mt-1 text-bc-muted">{key?.fingerprint ?? "None"}</dd>
          </div>
          <div className="rounded-md border border-bc-line bg-bc-ink p-3">
            <dt className="font-semibold">Created</dt>
            <dd className="mt-1 text-bc-muted">{formatDate(key?.createdAt ?? null)}</dd>
          </div>
          <div className="rounded-md border border-bc-line bg-bc-ink p-3">
            <dt className="font-semibold">Last used</dt>
            <dd className="mt-1 text-bc-muted">{formatDate(key?.lastUsedAt ?? null)}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-3">
          <form action={formAction}>
            <input name="intent" type="hidden" value="create" />
            <Button disabled={pending || hasActiveKey} type="submit" variant="ghost">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create
            </Button>
          </form>
          <form action={formAction}>
            <input name="intent" type="hidden" value="rotate" />
            <Button disabled={pending} type="submit" variant="dark">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Rotate
            </Button>
          </form>
          <form action={formAction}>
            <input name="intent" type="hidden" value="revoke" />
            <Button disabled={pending || !hasActiveKey} type="submit" variant="pink">
              <ShieldOff className="h-4 w-4" aria-hidden="true" />
              Revoke
            </Button>
          </form>
        </div>
      </section>

      <aside className="rounded-md border border-bc-line bg-bc-panel p-5">
        <Badge tone="cyan">OBS setup</Badge>
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="font-semibold">Server</dt>
            <dd className="mt-1 break-all text-bc-muted">{ingestUrl}</dd>
          </div>
          <div>
            <dt className="font-semibold">Stream key</dt>
            <dd className="mt-1 text-bc-muted">Use the private key shown after create or rotate.</dd>
          </div>
          <div>
            <dt className="font-semibold">Safety</dt>
            <dd className="mt-1 text-bc-muted">Rotating revokes previous active keys and creates an audit event.</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
