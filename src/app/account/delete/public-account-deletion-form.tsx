"use client";

import { useActionState } from "react";
import { Send, ShieldAlert } from "lucide-react";
import { publicAccountDeletionRequestAction } from "@/app/account/delete/actions";
import {
  initialPublicAccountDeletionActionState,
  type PublicAccountDeletionActionState
} from "@/app/account/delete/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { accountDeletionConfirmationText } from "@/lib/account/account-deletion-core";

type PublicAccountDeletionFormProps = {
  defaultEmail?: string;
  defaultName?: string;
};

export function PublicAccountDeletionForm({ defaultEmail = "", defaultName = "" }: PublicAccountDeletionFormProps) {
  const [state, formAction, pending] = useActionState<PublicAccountDeletionActionState, FormData>(
    publicAccountDeletionRequestAction,
    initialPublicAccountDeletionActionState
  );

  return (
    <form action={formAction} className="grid gap-4 rounded-md border border-bc-line bg-bc-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge tone="pink">Deletion request</Badge>
          <h2 className="mt-3 text-2xl font-black">Request account deletion</h2>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="delete-name">
            Name
          </label>
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
            defaultValue={defaultName}
            disabled={pending}
            id="delete-name"
            maxLength={120}
            name="name"
          />
          <p className="mt-1 text-xs text-bc-muted">Optional name the operator can use when verifying the request.</p>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="delete-email">
            Account email
          </label>
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
            defaultValue={defaultEmail}
            disabled={pending}
            id="delete-email"
            maxLength={255}
            name="email"
            required
            type="email"
          />
          <p className="mt-1 text-xs text-bc-muted">Use the email address attached to the account you want deleted.</p>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="delete-reason">
          Reason
        </label>
        <textarea
          className="mt-2 min-h-32 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          disabled={pending}
          id="delete-reason"
          maxLength={1000}
          name="reason"
        />
        <p className="mt-1 text-xs text-bc-muted">Optional context for the deletion request.</p>
      </div>

      <div className="rounded-md border border-bc-pink/30 bg-bc-pink/10 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-bc-pink" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-white">Identity verification is required before staff deletes data.</p>
            <p className="mt-1 text-sm text-bc-muted">
              Some records may be retained for security, fraud prevention, payment, tax, or legal obligations.
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="delete-confirmation">
          Confirmation
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          disabled={pending}
          id="delete-confirmation"
          name="confirmation"
          required
        />
        <p className="mt-1 text-xs text-bc-muted">
          Type <span className="font-semibold text-white">{accountDeletionConfirmationText}</span> to submit this request.
        </p>
      </div>

      <div>
        <Button disabled={pending} type="submit" variant="pink">
          <Send className="h-4 w-4" aria-hidden="true" />
          Send deletion request
        </Button>
      </div>
    </form>
  );
}
