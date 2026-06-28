"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { supportRequestAction } from "@/app/support/actions";
import { initialSupportActionState, type SupportActionState } from "@/app/support/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supportCategories, supportPriorities } from "@/lib/support/support-request-core";

type SupportFormProps = {
  defaultEmail?: string;
  defaultName?: string;
};

function labelFromKey(value: string) {
  return value.replaceAll("-", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

export function SupportForm({ defaultEmail = "", defaultName = "" }: SupportFormProps) {
  const [state, formAction, pending] = useActionState<SupportActionState, FormData>(
    supportRequestAction,
    initialSupportActionState
  );

  return (
    <form action={formAction} className="grid gap-4 rounded-md border border-bc-line bg-bc-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge tone="pink">Support</Badge>
          <h2 className="mt-3 text-2xl font-black">Send a request</h2>
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
          <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="support-name">
            Name
          </label>
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
            defaultValue={defaultName}
            disabled={pending}
            id="support-name"
            maxLength={120}
            name="name"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="support-email">
            Email
          </label>
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
            defaultValue={defaultEmail}
            disabled={pending}
            id="support-email"
            maxLength={255}
            name="email"
            required
            type="email"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <div>
          <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="support-category">
            Category
          </label>
          <select
            className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
            defaultValue="account"
            disabled={pending}
            id="support-category"
            name="category"
          >
            {supportCategories.map((category) => (
              <option key={category} value={category}>
                {labelFromKey(category)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="support-priority">
            Priority
          </label>
          <select
            className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
            defaultValue="normal"
            disabled={pending}
            id="support-priority"
            name="priority"
          >
            {supportPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {labelFromKey(priority)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="support-subject">
          Subject
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          disabled={pending}
          id="support-subject"
          maxLength={140}
          name="subject"
          required
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="support-message">
          Message
        </label>
        <textarea
          className="mt-2 min-h-44 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white"
          disabled={pending}
          id="support-message"
          maxLength={4000}
          name="message"
          required
        />
      </div>

      <div>
        <Button disabled={pending} type="submit" variant="primary">
          <Send className="h-4 w-4" aria-hidden="true" />
          Send request
        </Button>
      </div>
    </form>
  );
}
