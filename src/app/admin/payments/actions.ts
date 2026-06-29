"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/rbac";
import { requireSignedInUser } from "@/lib/auth/guards";
import { paidMusicDeliveryRecoveryMessage } from "@/lib/music/music-delivery-recovery-core";
import { repairPaidMusicPurchaseDelivery } from "@/lib/music/music-delivery-recovery-service";
import {
  paypalModeOptions,
  updatePayPalSettings,
  type PayPalMode,
  type PayPalSettingsInput
} from "@/lib/payments/paypal-service";
import { cancelStalePendingCheckouts } from "@/lib/payments/payment-reconciliation-service";
import { createProducerPayoutBatch, syncProducerPayoutBatch } from "@/lib/payments/producer-payout-service";
import { retryPayPalWebhookEvent } from "@/lib/payments/paypal-webhook-service";
import type { AdminPaymentsActionState } from "@/app/admin/payments/state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function isPayPalMode(value: string): value is PayPalMode {
  return paypalModeOptions.includes(value as PayPalMode);
}

function paypalInput(formData: FormData): PayPalSettingsInput {
  const mode = formString(formData, "mode");

  if (!isPayPalMode(mode)) {
    throw new Error("Invalid PayPal mode.");
  }

  return {
    clientId: formString(formData, "clientId"),
    merchantEmail: formString(formData, "merchantEmail"),
    merchantId: formString(formData, "merchantId"),
    mode,
    producerPayoutsEnabled: formBoolean(formData, "producerPayoutsEnabled"),
    shopEnabled: formBoolean(formData, "shopEnabled"),
    starsEnabled: formBoolean(formData, "starsEnabled"),
    webhookId: formString(formData, "webhookId")
  };
}

function revalidatePaymentViews() {
  revalidatePath("/admin/payments");
  revalidatePath("/admin/system-health");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/shop");
  revalidatePath("/rewards");
  revalidatePath("/music");
  revalidatePath("/producer");
  revalidatePath("/producer/sales");
  revalidatePath("/producer/profile");
}

export async function adminPaymentsAction(
  _previousState: AdminPaymentsActionState,
  formData: FormData
): Promise<AdminPaymentsActionState> {
  const actor = await requireSignedInUser();

  if (!hasPermission(actor, "payments.manage")) {
    return {
      status: "error",
      message: "You do not have permission to manage payment integrations."
    };
  }

  try {
    const intent = formString(formData, "intent");

    if (intent === "paypal-settings") {
      await updatePayPalSettings(paypalInput(formData), actor.id);
      revalidatePaymentViews();

      return {
        status: "success",
        message: "PayPal integration settings saved."
      };
    }

    if (intent === "producer-payout-create") {
      if (!formBoolean(formData, "confirmPayout")) {
        throw new Error("Confirm the PayPal payout batch before sending.");
      }

      const batch = await createProducerPayoutBatch(actor.id);
      revalidatePaymentViews();

      return {
        status: "success",
        message: `PayPal payout batch created for ${batch.itemCount} sale${batch.itemCount === 1 ? "" : "s"}.`
      };
    }

    if (intent === "producer-payout-sync") {
      const batchId = formString(formData, "batchId");

      if (!batchId) {
        throw new Error("Missing payout batch.");
      }

      const batch = await syncProducerPayoutBatch(actor.id, batchId);
      revalidatePaymentViews();

      return {
        status: "success",
        message: `PayPal payout batch synced with status ${batch.status}.`
      };
    }

    if (intent === "stale-pending-cancel") {
      const result = await cancelStalePendingCheckouts(actor.id, {
        confirmation: formString(formData, "confirmation"),
        olderThanHours: formString(formData, "olderThanHours")
      });

      revalidatePaymentViews();
      revalidatePath("/admin/orders");
      revalidatePath("/admin/stars");
      revalidatePath("/admin/tracks");

      return {
        status: "success",
        message: `${result.totalCancelled.toLocaleString("en-GB")} stale pending checkout record${
          result.totalCancelled === 1 ? "" : "s"
        } cancelled.`
      };
    }

    if (intent === "music-delivery-repair") {
      const result = await repairPaidMusicPurchaseDelivery(actor.id, {
        confirmation: formString(formData, "confirmation")
      });

      revalidatePaymentViews();
      revalidatePath("/admin/tracks");
      revalidatePath("/account/downloads");

      return {
        status: "success",
        message: paidMusicDeliveryRecoveryMessage(result)
      };
    }

    if (intent === "paypal-webhook-retry") {
      const webhookEventId = formString(formData, "webhookEventId");

      if (!webhookEventId) {
        throw new Error("Missing PayPal webhook event.");
      }

      const result = await retryPayPalWebhookEvent(actor.id, webhookEventId);
      revalidatePaymentViews();

      return {
        status: "success",
        message: `PayPal webhook ${result.paypalEventId} retried: ${result.previousStatus} -> ${result.processingStatus}.`
      };
    }

    return {
      status: "error",
      message: "Unknown payment action."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Payment action failed."
    };
  }
}
