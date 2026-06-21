"use client";

import { useActionState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { deleteOwnAccountAction } from "@/app/account/settings/actions";
import { initialAccountDeletionActionState, type AccountDeletionActionState } from "@/app/account/settings/state";
import { Button } from "@/components/ui/button";
import { accountDeletionConfirmationText } from "@/lib/account/account-deletion-core";

export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState<AccountDeletionActionState, FormData>(
    deleteOwnAccountAction,
    initialAccountDeletionActionState
  );

  return (
    <form
      action={formAction}
      className="rounded-md border border-bc-pink/35 bg-bc-panel p-5"
      id="delete-account"
      onSubmit={(event) => {
        if (!window.confirm("this action can't be undone, are you sure you want to continiue!")) {
          event.preventDefault();
        }
      }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-1 h-5 w-5 text-bc-pink" aria-hidden="true" />
        <div>
          <h3 className="text-xl font-black">Delete account</h3>
          <p className="mt-2 text-sm leading-6 text-bc-muted">
            Permanently delete your account and related site data. This removes your active sessions, roles, profile, chat data,
            notifications, mobile devices, purchases, orders, stream keys, and producer records from this instance.
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

      <label className="mt-5 block text-sm font-semibold" htmlFor="deletion-reason">
        Reason
      </label>
      <textarea
        className="mt-2 min-h-24 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm"
        id="deletion-reason"
        maxLength={1000}
        name="reason"
        placeholder="Optional note for the audit log"
      />
      <p className="mt-1 text-xs text-bc-muted">Optional. Maximum 1000 characters.</p>

      <label className="mt-4 block text-sm font-semibold" htmlFor="deletion-confirmation">
        Confirmation
      </label>
      <input
        className="mt-2 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm"
        id="deletion-confirmation"
        name="confirmation"
        placeholder={accountDeletionConfirmationText}
        required
      />
      <p className="mt-1 text-xs text-bc-muted">Type {accountDeletionConfirmationText} to permanently delete this account.</p>

      <Button className="mt-5" disabled={pending} type="submit" variant="pink">
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Delete my account permanently
      </Button>
    </form>
  );
}
