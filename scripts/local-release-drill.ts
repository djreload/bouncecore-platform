#!/usr/bin/env node
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { reconcileCompletedPaymentRefund } from "@/lib/payments/payment-refund-service";
import { getPayPalSettings } from "@/lib/payments/paypal-service";
import { getSquareSettings } from "@/lib/payments/square-service";
import { processStoredSquareWebhookEvent, recordSquareWebhookEvent } from "@/lib/payments/square-webhook-service";
import { assertLocalReleaseDrillSafety } from "@/lib/release/release-drill-safety";
import {
  acceptRaveWarChallenge,
  createRaveWarChallenge,
  declineRaveWarChallenge,
  fireRaveWarShot,
  getRaveWarForUser,
  moveRaveWarPlayer,
  reconcileRaveWarDeadlines,
  surrenderRaveWar
} from "@/lib/rave-wars/rave-war-service";
import { grantAutomaticSupporterRole } from "@/lib/rewards/supporter-role-service";

type Check = { detail: string; name: string; passed: boolean };

const startedAt = new Date();
const runId = randomUUID().replaceAll("-", "").slice(0, 12);
const checks: Check[] = [];
const createdUserIds: string[] = [];
let createdProductId: string | null = null;
let createdPayoutBatchId: string | null = null;
let createdRoomId: string | null = null;
let originalRaveWarSetting: { value: Prisma.JsonValue } | null = null;

function check(name: string, condition: unknown, detail: string) {
  assert.ok(condition, `${name}: ${detail}`);
  checks.push({ detail, name, passed: true });
}

function squareRefundPayload(input: { amountPence: number; eventId: string; orderId: string; paymentId: string }) {
  return {
    data: {
      object: {
        refund: {
          amount_money: { amount: input.amountPence, currency: "GBP" },
          id: `refund-${input.eventId}`,
          order_id: input.orderId,
          payment_id: input.paymentId,
          status: "COMPLETED"
        }
      }
    },
    event_id: input.eventId,
    type: "refund.updated"
  };
}

async function createDrillUser(label: string) {
  const user = await prisma.user.create({
    data: {
      displayName: `Release Drill ${label}`,
      email: `release-drill-${label.toLowerCase()}-${runId}@bouncecore.local`,
      emailVerifiedAt: new Date(),
      status: "active"
    }
  });
  createdUserIds.push(user.id);
  await prisma.authSession.create({
    data: {
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      tokenHash: `release-drill-${label.toLowerCase()}-${runId}`,
      userId: user.id
    }
  });
  return user;
}

async function runRaveWarMatrix() {
  const challenger = await createDrillUser("Challenger");
  const target = await createDrillUser("Target");
  const room = await prisma.chatRoom.create({ data: { name: `Release Drill ${runId}`, slug: `release-drill-${runId}` } });
  createdRoomId = room.id;
  await prisma.starWallet.create({ data: { balance: 100, userId: challenger.id } });

  originalRaveWarSetting = await prisma.appSetting.findUnique({ select: { value: true }, where: { key: "chat.rave_wars" } });
  await prisma.appSetting.upsert({
    create: {
      key: "chat.rave_wars",
      value: {
        challengeTtlSeconds: 60,
        cooldownSeconds: 0,
        costStars: 20,
        enabled: true,
        matchDurationSeconds: 300,
        turnDurationSeconds: 60
      }
    },
    update: {
      value: {
        challengeTtlSeconds: 60,
        cooldownSeconds: 0,
        costStars: 20,
        enabled: true,
        matchDurationSeconds: 300,
        turnDurationSeconds: 60
      }
    },
    where: { key: "chat.rave_wars" }
  });

  const pending = await createRaveWarChallenge(room.id, challenger.id, target.id);
  const chargedWallet = await prisma.starWallet.findUniqueOrThrow({ where: { userId: challenger.id } });
  check("Rave War entry charge", chargedWallet.balance === 80 && pending.status === "pending", "20 stars charged once when challenge was created.");
  check(
    "Rave War challenge notification",
    await prisma.notification.findFirst({ where: { userId: target.id, type: "chat.rave_war.challenge" } }),
    "Target received the persisted challenge notification."
  );

  const active = await acceptRaveWarChallenge(pending.id, target.id);
  check("Rave War acceptance", active.status === "active" && active.turnUserId === challenger.id, "Challenge became an active two-player match.");

  const moved = await moveRaveWarPlayer(active.id, challenger.id, { actionId: `move-${runId}`, direction: "right" });
  const duplicateMove = await moveRaveWarPlayer(active.id, challenger.id, { actionId: `move-${runId}`, direction: "right" });
  check("Rave War idempotent movement", duplicateMove.state.revision === moved.state.revision, "A repeated client action ID did not move twice.");

  const fired = await fireRaveWarShot(active.id, challenger.id, {
    actionId: `fire-${runId}`,
    angle: 81,
    facing: "right",
    power: 65,
    weaponId: "bazooka"
  });
  check("Rave War firing and turn handoff", fired.state.lastShot && fired.turnUserId === target.id, "Authoritative shot was recorded and the turn changed.");

  const staleState = { ...fired.state, turnEndsAt: new Date(Date.now() - 1000).toISOString() };
  await prisma.raveWar.update({ data: { state: staleState as Prisma.InputJsonValue }, where: { id: active.id } });
  const reconciliation = await reconcileRaveWarDeadlines();
  const afterTimeout = await getRaveWarForUser(active.id, target.id);
  check("Rave War turn timeout", reconciliation.advancedTurnCount >= 1 && afterTimeout?.turnUserId === challenger.id, "Expired turn advanced without client activity.");

  await prisma.authSession.updateMany({ data: { updatedAt: new Date(Date.now() - 10 * 60 * 1000) }, where: { userId: target.id } });
  await prisma.authSession.updateMany({ data: { updatedAt: new Date() }, where: { userId: target.id } });
  const recovered = await getRaveWarForUser(active.id, target.id);
  check("Rave War reconnect recovery", recovered?.id === active.id && recovered.status === "active", "Returning participant recovered authoritative active state.");

  const finished = await surrenderRaveWar(active.id, challenger.id);
  check("Rave War completion", finished.status === "finished" && finished.winnerUserId === target.id, "Match completed and selected the other player as winner.");

  const refundable = await createRaveWarChallenge(room.id, challenger.id, target.id);
  const beforeRefund = await prisma.starWallet.findUniqueOrThrow({ where: { userId: challenger.id } });
  await declineRaveWarChallenge(refundable.id, target.id);
  const afterRefund = await prisma.starWallet.findUniqueOrThrow({ where: { userId: challenger.id } });
  const refundedWar = await prisma.raveWar.findUniqueOrThrow({ where: { id: refundable.id } });
  check(
    "Rave War declined refund",
    beforeRefund.balance === 60 && afterRefund.balance === 80 && refundedWar.entryStarsRefundedAt,
    "Declined paid challenge returned exactly 20 stars once."
  );

  return { challenger, target };
}

async function runPaymentMatrix(buyerId: string) {
  const wallet = await prisma.starWallet.findUniqueOrThrow({ where: { userId: buyerId } });
  await prisma.starWallet.update({ data: { balance: 100 }, where: { id: wallet.id } });
  await grantAutomaticSupporterRole(buyerId);
  check(
    "Supporter assignment",
    await prisma.userRole.findFirst({ where: { userId: buyerId, role: { name: "supporter" } } }),
    "Successful stars path grants Supporter/VIP idempotently."
  );

  const squareOrderId = `square-order-${runId}`;
  const squarePaymentId = `square-payment-${runId}`;
  await prisma.starPurchase.create({
    data: {
      completedAt: new Date(),
      packageLabel: "Release Drill Stars",
      paymentProvider: "square",
      squareOrderId,
      squarePaymentId,
      stars: 100,
      status: "paid",
      totalPence: 1000,
      userId: buyerId
    }
  });

  const firstPayload = squareRefundPayload({ amountPence: 500, eventId: `square-event-a-${runId}`, orderId: squareOrderId, paymentId: squarePaymentId });
  const firstRecord = await recordSquareWebhookEvent(firstPayload);
  await processStoredSquareWebhookEvent(firstRecord.event.id);
  const duplicateRecord = await recordSquareWebhookEvent(firstPayload);
  const duplicateResult = await processStoredSquareWebhookEvent(duplicateRecord.event.id);
  const partialWallet = await prisma.starWallet.findUniqueOrThrow({ where: { userId: buyerId } });
  check("Square duplicate webhook", duplicateRecord.duplicate && duplicateResult.action === "duplicate" && partialWallet.balance === 50, "Duplicate refund event did not remove stars twice.");

  const secondPayload = squareRefundPayload({ amountPence: 500, eventId: `square-event-b-${runId}`, orderId: squareOrderId, paymentId: squarePaymentId });
  const secondRecord = await recordSquareWebhookEvent(secondPayload);
  await processStoredSquareWebhookEvent(secondRecord.event.id);
  const refundedStars = await prisma.starPurchase.findUniqueOrThrow({ where: { squareOrderId } });
  const finalWallet = await prisma.starWallet.findUniqueOrThrow({ where: { userId: buyerId } });
  check("Square cumulative refund", refundedStars.status === "refunded" && refundedStars.refundedStars === 100 && finalWallet.balance === 0, "Two partial events produced one full cumulative refund.");

  const product = await prisma.product.create({
    data: {
      name: `Release Drill Product ${runId}`,
      slug: `release-drill-product-${runId}`,
      status: "active",
      variants: { create: { name: "Test", pricePence: 500, sku: `DRILL-${runId}`, stock: 5 } }
    },
    include: { variants: true }
  });
  createdProductId = product.id;
  const variant = product.variants[0];
  const captureId = `paypal-shop-capture-${runId}`;
  const order = await prisma.order.create({
    data: {
      completedAt: new Date(),
      currency: "GBP",
      items: {
        create: {
          productName: product.name,
          productVariantId: variant.id,
          quantity: 2,
          sku: variant.sku,
          totalPence: 1000,
          unitPricePence: 500,
          variantName: variant.name
        }
      },
      paymentProvider: "paypal",
      paypalCaptureId: captureId,
      status: "paid",
      totalPence: 1000,
      userId: buyerId
    }
  });
  await reconcileCompletedPaymentRefund({ amountPence: 1000, currency: "GBP", paypalCaptureId: captureId, provider: "paypal", providerEventId: `paypal-shop-refund-${runId}` });
  await reconcileCompletedPaymentRefund({ amountPence: 1000, currency: "GBP", paypalCaptureId: captureId, provider: "paypal", providerEventId: `paypal-shop-refund-duplicate-${runId}` });
  const refundedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  const restockedVariant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
  check("PayPal merch refund", refundedOrder.status === "refunded" && restockedVariant.stock === 7, "Full refund restocked two units exactly once.");

  const producer = await createDrillUser("Producer");
  const producerProfile = await prisma.producerProfile.create({ data: { name: "Release Drill Producer", slug: `release-drill-producer-${runId}`, userId: producer.id } });
  const track = await prisma.digitalTrack.create({
    data: { downloadUrl: "/uploads/release-drill.mp3", pricePence: 700, producerId: producerProfile.id, slug: `release-drill-track-${runId}`, status: "approved", title: "Release Drill Track" }
  });
  const trackCaptureId = `paypal-track-capture-${runId}`;
  const purchase = await prisma.digitalTrackPurchase.create({
    data: {
      buyerId,
      completedAt: new Date(),
      downloadUrl: track.downloadUrl,
      paypalCaptureId: trackCaptureId,
      pricePence: 700,
      producerEarningsPence: 560,
      producerId: producerProfile.id,
      producerName: producerProfile.name,
      status: "paid",
      trackId: track.id,
      trackTitle: track.title
    }
  });
  const payoutBatch = await prisma.producerPayoutBatch.create({ data: { currency: "GBP", itemCount: 1, senderBatchId: `drill-batch-${runId}`, status: "pending", totalPence: 560 } });
  createdPayoutBatchId = payoutBatch.id;
  await prisma.producerPayoutItem.create({
    data: { amountPence: 560, batchId: payoutBatch.id, producerId: producerProfile.id, purchaseId: purchase.id, recipientEmail: producer.email, senderItemId: `drill-item-${runId}`, status: "pending" }
  });
  await reconcileCompletedPaymentRefund({ amountPence: 700, currency: "GBP", paypalCaptureId: trackCaptureId, provider: "paypal", providerEventId: `paypal-track-refund-${runId}` });
  const refundedTrack = await prisma.digitalTrackPurchase.findUniqueOrThrow({ where: { id: purchase.id } });
  const blockedPayout = await prisma.producerPayoutItem.findUniqueOrThrow({ where: { senderItemId: `drill-item-${runId}` } });
  check("PayPal music refund", refundedTrack.status === "refunded" && !refundedTrack.downloadUrl && blockedPayout.status === "blocked", "Refund revoked download and blocked unpaid producer payout.");
}

async function cleanup() {
  if (createdPayoutBatchId) await prisma.producerPayoutBatch.deleteMany({ where: { id: createdPayoutBatchId } });
  if (createdRoomId) await prisma.chatRoom.deleteMany({ where: { id: createdRoomId } });
  if (createdProductId) await prisma.product.deleteMany({ where: { id: createdProductId } });
  if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.squareWebhookEvent.deleteMany({ where: { squareEventId: { contains: runId } } });
  await prisma.auditLog.deleteMany({ where: { createdAt: { gte: startedAt }, target: { contains: runId } } });

  if (originalRaveWarSetting) {
    await prisma.appSetting.update({ data: { value: originalRaveWarSetting.value as Prisma.InputJsonValue }, where: { key: "chat.rave_wars" } });
  } else {
    await prisma.appSetting.deleteMany({ where: { key: "chat.rave_wars" } });
  }
}

async function main() {
  const [paypal, square] = await Promise.all([getPayPalSettings(), getSquareSettings()]);
  const safety = assertLocalReleaseDrillSafety({
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
    confirmation: process.env.RELEASE_DRILL_CONFIRM ?? "",
    databaseUrl: process.env.DATABASE_URL ?? "",
    paypalMode: paypal.mode,
    squareMode: square.mode
  });

  try {
    const users = await runRaveWarMatrix();
    await runPaymentMatrix(users.challenger.id);
    console.log(JSON.stringify({ checks, runId, safety, status: "passed" }, null, 2));
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Local release drill failed.");
    process.exit(1);
  });
