"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, Link2, Radio, Sparkles, Settings2, Signal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { hasStreamKeyPlaceholder, maskIngestUrl } from "@/lib/stream/ingest-url";
import type { StreamProfileSummary } from "@/lib/stream/stream-profile-service";

type ObsSetupPanelProps = {
  channelTitle: string | null;
  channelSlug: string | null;
  hasActiveKey: boolean;
  healthStatus: string;
  ingestConnected: boolean;
  ingestUrl: string;
  keyFingerprint: string | null;
  playbackUrl: string | null;
  streamProfile: StreamProfileSummary | null;
  streamProfiles: StreamProfileSummary[];
  starOverlayUrl: string;
};

type CopyTarget = "ingest" | "playback" | "starOverlay" | null;

function statusTone(status: string) {
  if (status === "healthy" || status === "live" || status === "connected") {
    return "acid" as const;
  }

  if (status === "warning" || status === "unknown" || status === "starting") {
    return "amber" as const;
  }

  return "muted" as const;
}

function CopyButton({ copied, disabled, onCopy }: { copied: boolean; disabled?: boolean; onCopy: () => void }) {
  return (
    <Button disabled={disabled} onClick={onCopy} size="sm" type="button" variant="ghost">
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export function ObsSetupPanel({
  channelSlug,
  channelTitle,
  hasActiveKey,
  healthStatus,
  ingestConnected,
  ingestUrl,
  keyFingerprint,
  playbackUrl,
  streamProfile,
  streamProfiles,
  starOverlayUrl
}: ObsSetupPanelProps) {
  const [copied, setCopied] = useState<CopyTarget>(null);
  const usesUrlTemplate = hasStreamKeyPlaceholder(ingestUrl);
  const visibleIngestUrl = maskIngestUrl(ingestUrl);

  async function copyValue(target: Exclude<CopyTarget, null>, value: string | null) {
    if (!value) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopied(target);
    window.setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <section className="rounded-md border border-bc-line bg-bc-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="cyan">Connection</Badge>
            <h3 className="mt-4 text-2xl font-black">OBS stream settings</h3>
            <p className="mt-2 max-w-2xl text-sm text-bc-muted">
              Use the service connection values with the private key from your stream-key page.
            </p>
          </div>
          <ButtonLink href="/streamer/stream-key" variant={hasActiveKey ? "ghost" : "primary"}>
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Stream key
          </ButtonLink>
        </div>

        <div className="mt-5 grid gap-4">
          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Signal className="h-4 w-4 text-bc-electric" aria-hidden="true" />
                <h4 className="font-semibold">Server</h4>
              </div>
              <CopyButton copied={copied === "ingest"} disabled={usesUrlTemplate} onCopy={() => copyValue("ingest", visibleIngestUrl)} />
            </div>
            <p className="mt-3 break-all font-mono text-sm text-bc-muted">{visibleIngestUrl}</p>
          </article>

          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-bc-electric" aria-hidden="true" />
                <h4 className="font-semibold">Stream key</h4>
              </div>
              <Badge tone={hasActiveKey ? "acid" : "amber"}>{hasActiveKey ? "Active" : "Create key"}</Badge>
            </div>
            <p className="mt-3 text-sm text-bc-muted">
              {keyFingerprint ? `Active key fingerprint ${keyFingerprint}. Raw keys are only shown immediately after create or rotate.` : "No active key yet."}
            </p>
          </article>

          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-bc-electric" aria-hidden="true" />
                <h4 className="font-semibold">Playback URL</h4>
              </div>
              <CopyButton copied={copied === "playback"} disabled={!playbackUrl} onCopy={() => copyValue("playback", playbackUrl)} />
            </div>
            <p className="mt-3 break-all font-mono text-sm text-bc-muted">{playbackUrl ?? "Playback URL is not configured yet."}</p>
          </article>

          <article className="rounded-md border border-bc-line bg-bc-ink p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-bc-acid" aria-hidden="true" />
                <h4 className="font-semibold">Star alert browser source</h4>
              </div>
              <CopyButton copied={copied === "starOverlay"} onCopy={() => copyValue("starOverlay", starOverlayUrl)} />
            </div>
            <p className="mt-3 break-all font-mono text-sm text-bc-muted">{starOverlayUrl}</p>
          </article>
        </div>
      </section>

      <aside className="space-y-5">
        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <Badge tone={statusTone(healthStatus)}>{healthStatus.toUpperCase()}</Badge>
          <h3 className="mt-4 text-xl font-black">Readiness</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink p-3">
              <span className="text-bc-muted">Channel</span>
              <span className="font-semibold">{channelTitle ? `${channelTitle} /${channelSlug}` : "Missing"}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink p-3">
              <span className="text-bc-muted">Ingest</span>
              <Badge tone={ingestConnected ? "acid" : "muted"}>{ingestConnected ? "connected" : "offline"}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink p-3">
              <span className="text-bc-muted">Private key</span>
              <Badge tone={hasActiveKey ? "acid" : "amber"}>{hasActiveKey ? "ready" : "needed"}</Badge>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-bc-pink" aria-hidden="true" />
            <h3 className="text-xl font-black">Output settings</h3>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-bc-muted">Profile</dt>
              <dd className="text-right font-semibold">{streamProfile?.label ?? "Not configured"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-bc-muted">Resolution</dt>
              <dd className="font-semibold">
                {streamProfile ? `${streamProfile.videoWidth}x${streamProfile.videoHeight}` : "Waiting"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-bc-muted">Rate control</dt>
              <dd className="font-semibold">CBR</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-bc-muted">Video bitrate</dt>
              <dd className="font-semibold">{streamProfile ? `${streamProfile.videoBitrateKbps} Kbps` : "Waiting"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-bc-muted">Keyframe interval</dt>
              <dd className="font-semibold">{streamProfile ? `${streamProfile.keyframeSeconds} seconds` : "Waiting"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-bc-muted">Audio bitrate</dt>
              <dd className="font-semibold">{streamProfile ? `${streamProfile.audioBitrateKbps} Kbps` : "Waiting"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-bc-muted">FPS</dt>
              <dd className="font-semibold">{streamProfile?.fps ?? "Waiting"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-bc-muted">Audio sample rate</dt>
              <dd className="font-semibold">48 kHz</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <h3 className="text-xl font-black">Profiles</h3>
          <div className="mt-4 space-y-2">
            {streamProfiles.map((profile) => (
              <div
                className="flex items-center justify-between gap-3 rounded-md border border-bc-line bg-bc-ink p-3 text-sm"
                key={profile.id}
              >
                <span className="font-semibold">{profile.label}</span>
                <Badge tone={profile.id === streamProfile?.id ? "acid" : "muted"}>
                  {profile.videoHeight}p{profile.fps} / {profile.videoBitrateKbps} Kbps
                </Badge>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-bc-line bg-bc-panel p-5">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-bc-electric" aria-hidden="true" />
            <h3 className="text-xl font-black">Before live</h3>
          </div>
          <ul className="mt-4 space-y-3 text-sm text-bc-muted">
            <li className="rounded-md border border-bc-line bg-bc-ink p-3">Confirm the active key fingerprint matches the latest key you copied.</li>
            <li className="rounded-md border border-bc-line bg-bc-ink p-3">Add the star alert URL as an OBS browser source with a transparent background.</li>
            <li className="rounded-md border border-bc-line bg-bc-ink p-3">Check stream health after OBS connects to verify ingest is detected.</li>
            <li className="rounded-md border border-bc-line bg-bc-ink p-3">Keep raw stream keys private; rotate the key if it has been shared.</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
