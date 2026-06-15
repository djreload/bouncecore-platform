import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import { getPayPalSettings } from "@/lib/payments/paypal-service";
import {
  certUrlIsAllowedPayPalUrl,
  extractPayPalWebhookHeaders,
  verifyPayPalWebhookSignature,
  type PayPalWebhookSignatureHeaders
} from "@/lib/payments/paypal-webhook-signature";

const certificateCache = new Map<string, string>();
const maxWebhookBodyBytes = 1_000_000;

export type PayPalWebhookEventSummary = {
  createdAt: string;
  errorMessage: string | null;
  eventType: string;
  id: string;
  paypalEventId: string;
  processingStatus: string;
  resourceId: string | null;
  resourceType: string | null;
  transmissionId: string | null;
  verificationStatus: string;
};

type PayPalWebhookRecordInput = {
  event: Record<string, unknown>;
  headers: PayPalWebhookSignatureHeaders;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function eventSummary(event: Record<string, unknown>) {
  const resource = asRecord(event.resource);
  const eventId = stringValue(event.id);

  if (!eventId) {
    throw new Error("PayPal webhook event ID is missing.");
  }

  return {
    eventType: stringValue(event.event_type) ?? "UNKNOWN",
    paypalEventId: eventId,
    resourceId: stringValue(resource.id),
    resourceType: stringValue(event.resource_type)
  };
}

async function fetchPayPalCertificate(certUrl: string) {
  if (!certUrlIsAllowedPayPalUrl(certUrl)) {
    throw new Error("PayPal webhook certificate URL was not from an allowed PayPal host.");
  }

  const cached = certificateCache.get(certUrl);

  if (cached) {
    return cached;
  }

  const response = await fetch(certUrl, {
    headers: {
      Accept: "application/x-pem-file, text/plain, */*"
    }
  });

  if (!response.ok) {
    throw new Error(`PayPal webhook certificate download failed with ${response.status}.`);
  }

  const certificate = await response.text();

  if (!certificate.includes("BEGIN CERTIFICATE")) {
    throw new Error("PayPal webhook certificate response was not a PEM certificate.");
  }

  certificateCache.set(certUrl, certificate);

  return certificate;
}

async function verifyWebhookRequest(headers: PayPalWebhookSignatureHeaders, rawBody: string) {
  const settings = await getPayPalSettings();
  const certificatePem = await fetchPayPalCertificate(headers.certUrl);

  return verifyPayPalWebhookSignature(headers, settings.webhookId, rawBody, certificatePem);
}

async function recordPayPalWebhookEvent({ event, headers }: PayPalWebhookRecordInput) {
  const summary = eventSummary(event);
  const existing = await prisma.payPalWebhookEvent.findUnique({
    where: {
      paypalEventId: summary.paypalEventId
    }
  });

  if (existing) {
    return {
      eventId: existing.id,
      processingStatus: "duplicate" as const
    };
  }

  const created = await prisma.payPalWebhookEvent.create({
    data: {
      eventType: summary.eventType,
      payload: jsonValue(event),
      paypalEventId: summary.paypalEventId,
      processedAt: new Date(),
      processingStatus: "recorded",
      resourceId: summary.resourceId,
      resourceType: summary.resourceType,
      transmissionId: headers.transmissionId,
      verificationStatus: "verified"
    }
  });

  await writeAuditLog({
    action: "payments.paypal.webhook.received",
    metadata: {
      eventType: created.eventType,
      paypalEventId: created.paypalEventId,
      processingStatus: created.processingStatus,
      resourceId: created.resourceId,
      resourceType: created.resourceType,
      transmissionId: created.transmissionId
    },
    severity: "info",
    target: `paypal-webhook:${created.paypalEventId}`
  });

  return {
    eventId: created.id,
    processingStatus: "recorded" as const
  };
}

export async function ingestPayPalWebhook(request: Request) {
  const rawBody = await request.text();

  if (Buffer.byteLength(rawBody, "utf8") > maxWebhookBodyBytes) {
    throw new Error("PayPal webhook payload is too large.");
  }

  const headers = extractPayPalWebhookHeaders(request.headers);
  const parsed = JSON.parse(rawBody) as unknown;
  const event = asRecord(parsed);
  const verified = await verifyWebhookRequest(headers, rawBody);

  if (!verified) {
    throw new Error("PayPal webhook signature verification failed.");
  }

  return recordPayPalWebhookEvent({
    event,
    headers
  });
}

export async function getRecentPayPalWebhookEvents(limit = 8): Promise<PayPalWebhookEventSummary[]> {
  const events = await prisma.payPalWebhookEvent.findMany({
    orderBy: {
      receivedAt: "desc"
    },
    select: {
      errorMessage: true,
      eventType: true,
      id: true,
      paypalEventId: true,
      processingStatus: true,
      receivedAt: true,
      resourceId: true,
      resourceType: true,
      transmissionId: true,
      verificationStatus: true
    },
    take: limit
  });

  return events.map((event) => ({
    createdAt: event.receivedAt.toISOString(),
    errorMessage: event.errorMessage,
    eventType: event.eventType,
    id: event.id,
    paypalEventId: event.paypalEventId,
    processingStatus: event.processingStatus,
    resourceId: event.resourceId,
    resourceType: event.resourceType,
    transmissionId: event.transmissionId,
    verificationStatus: event.verificationStatus
  }));
}
