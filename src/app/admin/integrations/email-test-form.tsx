"use client";

import { useActionState } from "react";
import { MailCheck, Send } from "lucide-react";
import { adminEmailTestAction } from "@/app/admin/integrations/actions";
import { initialAdminIntegrationsActionState, type AdminIntegrationsActionState } from "@/app/admin/integrations/state";
import { Button } from "@/components/ui/button";

type AdminEmailTestFormProps = {
  defaultRecipientEmail: string;
};

export function AdminEmailTestForm({ defaultRecipientEmail }: AdminEmailTestFormProps) {
  const [state, formAction, pending] = useActionState<AdminIntegrationsActionState, FormData>(
    adminEmailTestAction,
    initialAdminIntegrationsActionState
  );

  return (
    <div className="mt-5 rounded-md border border-bc-line bg-bc-ink p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MailCheck className="h-5 w-5 text-bc-acid" aria-hidden="true" />
            <h4 className="font-black">SMTP test email</h4>
          </div>
          <p className="mt-2 text-sm text-bc-muted">
            Sends one diagnostic email and records the delivery outcome in notification logs.
          </p>
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

      <form action={formAction} className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="smtp-test-recipient">
            Recipient email
          </label>
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-panel px-3 py-2 text-sm text-white"
            defaultValue={defaultRecipientEmail}
            disabled={pending}
            id="smtp-test-recipient"
            name="recipientEmail"
            type="email"
          />
        </div>
        <div className="flex items-end">
          <Button disabled={pending} type="submit" variant="ghost">
            <Send className="h-4 w-4" aria-hidden="true" />
            Send test
          </Button>
        </div>
      </form>
    </div>
  );
}
