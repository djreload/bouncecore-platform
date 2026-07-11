"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { privacyRightsRequestAction } from "@/app/privacy/requests/actions";
import {
  initialPrivacyRightsActionState,
  type PrivacyRightsActionState
} from "@/app/privacy/requests/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  privacyRightsRequestTypeLabel,
  privacyRightsRequestTypes,
  type PrivacyRightsRequestType
} from "@/lib/privacy/privacy-rights-core";

type PrivacyRightsFormProps = {
  defaultEmail?: string;
  defaultName?: string;
};

export function PrivacyRightsForm({ defaultEmail = "", defaultName = "" }: PrivacyRightsFormProps) {
  const [state, formAction, pending] = useActionState<PrivacyRightsActionState, FormData>(
    privacyRightsRequestAction,
    initialPrivacyRightsActionState
  );

  return (
    <form action={formAction} className="grid gap-4 rounded-md border border-bc-line bg-bc-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge tone="cyan">Privacy request</Badge>
          <h2 className="mt-3 text-2xl font-black">Send a privacy request</h2>
        </div>
        {state.referenceId ? <Badge tone="acid">{state.referenceId}</Badge> : null}
      </div>

      {state.message ? (
        <div
          className={`rounded-md border p-3 text-sm ${
            state.status === "error" ? "border-bc-pink/30 bg-bc-pink/10 text-bc-pink" : "border-bc-acid/30 bg-bc-acid/10 text-bc-acid"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="privacy-request-type">
          Request type
        </label>
        <select
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          defaultValue="access"
          disabled={pending}
          id="privacy-request-type"
          name="requestType"
        >
          {privacyRightsRequestTypes.map((requestType) => (
            <option key={requestType} value={requestType}>
              {privacyRightsRequestTypeLabel(requestType as PrivacyRightsRequestType)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-bc-muted">Choose the privacy right or data question you want the operator to review.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="privacy-name">
            Name
          </label>
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
            defaultValue={defaultName}
            disabled={pending}
            id="privacy-name"
            maxLength={120}
            name="name"
          />
          <p className="mt-1 text-xs text-bc-muted">Optional name staff can use while verifying the request.</p>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="privacy-email">
            Account email
          </label>
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
            defaultValue={defaultEmail}
            disabled={pending}
            id="privacy-email"
            maxLength={255}
            name="email"
            required
            type="email"
          />
          <p className="mt-1 text-xs text-bc-muted">Use the email address connected to the account or request.</p>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="privacy-message">
          Request details
        </label>
        <textarea
          className="mt-2 min-h-40 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          disabled={pending}
          id="privacy-message"
          maxLength={2000}
          name="message"
          required
        />
        <p className="mt-1 text-xs text-bc-muted">
          Include enough detail to locate the relevant account, order, upload, chat, or device record.
        </p>
      </div>

      <div className="rounded-md border border-bc-line bg-bc-ink p-4 text-sm text-bc-muted">
        Staff must verify identity before disclosing, exporting, deleting, correcting, or restricting personal data.
      </div>

      <div>
        <Button disabled={pending} type="submit" variant="primary">
          <Send className="h-4 w-4" aria-hidden="true" />
          Send privacy request
        </Button>
      </div>
    </form>
  );
}
