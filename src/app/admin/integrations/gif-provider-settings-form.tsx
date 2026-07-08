"use client";

import { useActionState } from "react";
import { Image as ImageIcon, Save } from "lucide-react";
import { adminGifProviderSettingsAction } from "@/app/admin/integrations/actions";
import { initialAdminIntegrationsActionState, type AdminIntegrationsActionState } from "@/app/admin/integrations/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminGifProviderSettingsData } from "@/lib/chat/gif-provider-service";

type GifProviderSettingsFormProps = {
  data: AdminGifProviderSettingsData;
};

function configuredLabel(configured: boolean, envConfigured: boolean) {
  if (configured && envConfigured) {
    return "Stored/env";
  }

  return configured ? "Stored" : "Missing";
}

export function GifProviderSettingsForm({ data }: GifProviderSettingsFormProps) {
  const [state, formAction, pending] = useActionState<AdminIntegrationsActionState, FormData>(
    adminGifProviderSettingsAction,
    initialAdminIntegrationsActionState
  );

  return (
    <form action={formAction} className="mt-5 rounded-md border border-bc-line bg-bc-ink p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-bc-electric" aria-hidden="true" />
            <h4 className="font-black">GIF provider credentials</h4>
          </div>
          <p className="mt-2 text-sm text-bc-muted">
            Keys are used only by the server-side GIF search endpoint. Leave a provider blank to disable it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={data.configured.giphy ? "acid" : "amber"}>
            GIPHY: {configuredLabel(data.configured.giphy, data.envConfigured.giphy)}
          </Badge>
          <Badge tone={data.configured.klipy ? "acid" : "amber"}>
            KLIPY: {configuredLabel(data.configured.klipy, data.envConfigured.klipy)}
          </Badge>
          <Badge tone={data.configured.imgur ? "acid" : "amber"}>
            Imgur: {configuredLabel(data.configured.imgur, data.envConfigured.imgur)}
          </Badge>
        </div>
      </div>

      {state.message ? (
        <div
          className={`mt-4 rounded-md border p-3 text-sm ${
            state.status === "error"
              ? "border-bc-pink/30 bg-bc-pink/10 text-bc-pink"
              : "border-bc-acid/30 bg-bc-acid/10 text-bc-acid"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div>
          <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="giphy-api-key">
            GIPHY API key
          </label>
          <input
            autoComplete="off"
            className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
            disabled={pending}
            id="giphy-api-key"
            name="giphyApiKey"
            placeholder={data.configured.giphy ? "Stored - leave blank to keep" : "GIPHY API key"}
            type="password"
          />
          <p className="mt-1 text-xs text-bc-muted">Used for GIPHY Search API calls with PG-13 rating filtering.</p>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="klipy-api-key">
            KLIPY API key
          </label>
          <input
            autoComplete="off"
            className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
            disabled={pending}
            id="klipy-api-key"
            name="klipyApiKey"
            placeholder={data.configured.klipy ? "Stored - leave blank to keep" : "KLIPY API key"}
            type="password"
          />
          <p className="mt-1 text-xs text-bc-muted">Used for KLIPY/Tenor-style search requests with medium filtering.</p>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="imgur-client-id">
            Imgur client ID
          </label>
          <input
            autoComplete="off"
            className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
            disabled={pending}
            id="imgur-client-id"
            name="imgurClientId"
            placeholder={data.configured.imgur ? "Stored - leave blank to keep" : "Imgur client ID"}
            type="password"
          />
          <p className="mt-1 text-xs text-bc-muted">Used with Imgur Client-ID auth for gallery GIF search.</p>
        </div>
      </div>

      <div className="mt-4">
        <Button disabled={pending} type="submit" variant="primary">
          <Save className="h-4 w-4" aria-hidden="true" />
          Save GIF providers
        </Button>
      </div>
    </form>
  );
}
