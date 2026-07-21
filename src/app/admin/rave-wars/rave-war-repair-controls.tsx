"use client";

import { useActionState } from "react";
import { OctagonX, RefreshCw, RotateCcw, Wrench } from "lucide-react";
import { adminRaveWarRepairAction } from "@/app/admin/rave-wars/actions";
import {
  initialAdminRaveWarRepairActionState,
  type AdminRaveWarRepairActionState
} from "@/app/admin/rave-wars/state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { raveWarAdminRepairConfirmationText } from "@/lib/rave-wars/rave-war-admin-repair-core";

type RaveWarRepairControlsProps = {
  entryStars: number;
  entryStarsRefundedAt: Date | null;
  stalled: boolean;
  status: string;
  warId: string;
};

function ActionFeedback({ state }: { state: AdminRaveWarRepairActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={`text-xs font-semibold ${state.status === "error" ? "text-bc-pink" : "text-bc-acid"}`}
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.message}
    </p>
  );
}

export function RaveWarRepairControls({ entryStars, entryStarsRefundedAt, stalled, status, warId }: RaveWarRepairControlsProps) {
  const [resyncState, resyncAction, resyncPending] = useActionState(
    adminRaveWarRepairAction,
    initialAdminRaveWarRepairActionState
  );
  const [forceEndState, forceEndAction, forceEndPending] = useActionState(
    adminRaveWarRepairAction,
    initialAdminRaveWarRepairActionState
  );
  const [refundState, refundAction, refundPending] = useActionState(
    adminRaveWarRepairAction,
    initialAdminRaveWarRepairActionState
  );
  const canResync = status === "active" && stalled;
  const canForceEnd = status === "active" || status === "pending";
  const canRefund = entryStars > 0 && !entryStarsRefundedAt && ["cancelled", "declined", "expired"].includes(status);
  const resyncConfirmation = raveWarAdminRepairConfirmationText("resync", warId);
  const forceEndConfirmation = raveWarAdminRepairConfirmationText("force-end", warId);
  const refundConfirmation = raveWarAdminRepairConfirmationText("refund-entry", warId);

  return (
    <section className="rounded-md border border-bc-amber/40 bg-bc-panel" aria-labelledby="rave-war-repair-heading">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-bc-line p-4">
        <div>
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-bc-amber" aria-hidden="true" />
            <h2 className="text-xl font-black" id="rave-war-repair-heading">
              Match repair controls
            </h2>
          </div>
          <p className="mt-1 text-sm text-bc-muted">
            Restricted operational actions. Every successful repair records the operator, reason, state change, and event id.
          </p>
        </div>
        <Badge tone={stalled ? "pink" : "muted"}>{stalled ? "Server activity stalled" : "No stale lock detected"}</Badge>
      </div>

      <div className="grid divide-y divide-bc-line xl:grid-cols-3 xl:divide-x xl:divide-y-0">
        <form action={resyncAction} className="grid content-start gap-3 p-4">
          <input name="intent" type="hidden" value="resync" />
          <input name="warId" type="hidden" value={warId} />
          <div>
            <h3 className="font-black">Resync stalled match</h3>
            <p className="mt-1 text-xs leading-5 text-bc-muted">
              Preserves health, weapons, ammo, craters, and the match deadline. It resets the active turn timer, movement allowance,
              and stuck projectile state. Available only after 150 seconds without server activity.
            </p>
          </div>
          <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="rave-war-resync-reason">
            Operational reason
          </label>
          <input
            autoComplete="off"
            className="min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white disabled:opacity-55"
            disabled={!canResync || resyncPending}
            id="rave-war-resync-reason"
            maxLength={240}
            minLength={5}
            name="reason"
            placeholder="Example: both clients stopped receiving turn updates"
            required
          />
          <p className="text-xs text-bc-muted">Stored in the audit record and repair event. Use 5 to 240 characters.</p>
          <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="rave-war-resync-confirmation">
            Exact confirmation
          </label>
          <input
            autoComplete="off"
            className="min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 font-mono text-xs text-white disabled:opacity-55"
            disabled={!canResync || resyncPending}
            id="rave-war-resync-confirmation"
            name="confirmation"
            placeholder={resyncConfirmation}
            required
          />
          <p className="break-all text-xs text-bc-muted">
            Type <span className="font-mono font-semibold text-white">{resyncConfirmation}</span> exactly.
          </p>
          <Button disabled={!canResync || resyncPending} type="submit" variant="ghost">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {resyncPending ? "Resyncing..." : "Resync match"}
          </Button>
          {!canResync ? (
            <p className="text-xs text-bc-muted">
              {status !== "active" ? "Resync is only available for active matches." : "This active match still has recent server activity."}
            </p>
          ) : null}
          <ActionFeedback state={resyncState} />
        </form>

        <form action={forceEndAction} className="grid content-start gap-3 p-4">
          <input name="intent" type="hidden" value="force-end" />
          <input name="warId" type="hidden" value={warId} />
          <div>
            <h3 className="font-black text-bc-pink">Force end match</h3>
            <p className="mt-1 text-xs leading-5 text-bc-muted">
              Immediately terminates a pending or active match without declaring a winner. Connected players return to Live and a
              system notice is posted in chat.
            </p>
          </div>
          <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="rave-war-force-end-reason">
            Operational reason
          </label>
          <input
            autoComplete="off"
            className="min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white disabled:opacity-55"
            disabled={!canForceEnd || forceEndPending}
            id="rave-war-force-end-reason"
            maxLength={240}
            minLength={5}
            name="reason"
            placeholder="Example: unrecoverable state after client disconnect"
            required
          />
          <p className="text-xs text-bc-muted">Stored permanently with the administrative audit event.</p>
          <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="rave-war-force-end-confirmation">
            Exact confirmation
          </label>
          <input
            autoComplete="off"
            className="min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 font-mono text-xs text-white disabled:opacity-55"
            disabled={!canForceEnd || forceEndPending}
            id="rave-war-force-end-confirmation"
            name="confirmation"
            placeholder={forceEndConfirmation}
            required
          />
          <p className="break-all text-xs text-bc-muted">
            Type <span className="font-mono font-semibold text-white">{forceEndConfirmation}</span> exactly.
          </p>
          <Button disabled={!canForceEnd || forceEndPending} type="submit" variant="pink">
            <OctagonX className="h-4 w-4" aria-hidden="true" />
            {forceEndPending ? "Ending..." : "Force end match"}
          </Button>
          {!canForceEnd ? <p className="text-xs text-bc-muted">This match is already terminal and cannot be ended again.</p> : null}
          <ActionFeedback state={forceEndState} />
        </form>

        <form action={refundAction} className="grid content-start gap-3 p-4">
          <input name="intent" type="hidden" value="refund-entry" />
          <input name="warId" type="hidden" value={warId} />
          <div>
            <h3 className="font-black text-bc-amber">Refund entry stars</h3>
            <p className="mt-1 text-xs leading-5 text-bc-muted">
              Returns {entryStars.toLocaleString("en-GB")} stars to the challenger. The atomic refund marker prevents duplicate credit.
            </p>
          </div>
          <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="rave-war-refund-reason">Refund reason</label>
          <input
            autoComplete="off"
            className="min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-sm text-white disabled:opacity-55"
            disabled={!canRefund || refundPending}
            id="rave-war-refund-reason"
            maxLength={240}
            minLength={5}
            name="reason"
            placeholder="Example: automatic refund missed during an outage"
            required
          />
          <p className="text-xs text-bc-muted">Only terminal challenges that never started can be refunded.</p>
          <label className="text-xs font-semibold uppercase text-bc-muted" htmlFor="rave-war-refund-confirmation">Exact confirmation</label>
          <input
            autoComplete="off"
            className="min-h-10 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2 font-mono text-xs text-white disabled:opacity-55"
            disabled={!canRefund || refundPending}
            id="rave-war-refund-confirmation"
            name="confirmation"
            placeholder={refundConfirmation}
            required
          />
          <p className="break-all text-xs text-bc-muted">Type <span className="font-mono font-semibold text-white">{refundConfirmation}</span> exactly.</p>
          <Button disabled={!canRefund || refundPending} type="submit" variant="ghost">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {refundPending ? "Refunding..." : "Refund entry stars"}
          </Button>
          {!canRefund ? (
            <p className="text-xs text-bc-muted">
              {entryStarsRefundedAt ? "Entry stars have already been refunded." : entryStars <= 0 ? "This challenge had no entry charge." : "Refunds are available after cancellation, decline, or expiry."}
            </p>
          ) : null}
          <ActionFeedback state={refundState} />
        </form>
      </div>
    </section>
  );
}
