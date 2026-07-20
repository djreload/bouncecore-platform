import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import { mailIsConfigured, sendMail } from "@/lib/mail/smtp-service";
import { queueMobilePushForNotification } from "@/lib/mobile/account-notification-push-service";
import { getNotificationDeliveryPreferencesForUser } from "@/lib/account/notification-preferences-service";

export type AccountNotificationEmailInput = {
  actionUrl?: string | null;
  auditActionPrefix?: string;
  body: string;
  dedupeKey: string;
  htmlLines: string[];
  subject: string;
  textLines: string[];
  title: string;
  type: string;
  user: {
    displayName: string;
    email: string;
    id: string;
  };
};

export function formatMoney(pence: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    currency,
    style: "currency"
  }).format(pence / 100);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emailHtml(title: string, lines: string[]) {
  return `<main style="font-family:Arial,sans-serif;line-height:1.5;color:#111827"><h1>${escapeHtml(
    title
  )}</h1>${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</main>`;
}

async function createNotificationOnce(input: AccountNotificationEmailInput) {
  const existing = await prisma.notification.findUnique({
    select: {
      id: true
    },
    where: {
      dedupeKey: input.dedupeKey
    }
  });

  if (existing) {
    return false;
  }

  try {
    const notification = await prisma.notification.create({
      select: {
        id: true
      },
      data: {
        actionUrl: input.actionUrl ?? null,
        body: input.body,
        dedupeKey: input.dedupeKey,
        title: input.title,
        type: input.type,
        userId: input.user.id
      }
    });

    return notification.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return null;
    }

    throw error;
  }
}

export async function notifyAccountUserOnce(input: AccountNotificationEmailInput) {
  const notificationId = await createNotificationOnce(input);

  if (!notificationId) {
    return false;
  }

  const deliveryPreferences = await getNotificationDeliveryPreferencesForUser(input.user.id, input.type);
  let pushResult:
    | Awaited<ReturnType<typeof queueMobilePushForNotification>>
    | {
        error: string;
      }
    | {
        reason: string;
        skipped: true;
      };

  try {
    pushResult = deliveryPreferences.push
      ? await queueMobilePushForNotification({
          notificationId,
          userId: input.user.id
        })
      : {
          reason: "Push disabled by notification preferences.",
          skipped: true
        };
  } catch (error) {
    pushResult = {
      error: error instanceof Error ? error.message : "Mobile push queueing failed."
    };
  }

  let mailResult:
    | Awaited<ReturnType<typeof sendMail>>
    | {
        configured: boolean;
        reason: string;
        sent: false;
        skipped?: true;
      };

  try {
    mailResult = deliveryPreferences.email
      ? await sendMail({
          html: emailHtml(input.subject, input.htmlLines),
          subject: input.subject,
          text: input.textLines.join("\n"),
          to: input.user.email
        })
      : {
          configured: mailIsConfigured(),
          reason: "Email disabled by notification preferences.",
          sent: false,
          skipped: true
        };
  } catch (error) {
    mailResult = {
      configured: mailIsConfigured(),
      reason: error instanceof Error ? error.message : "Email send failed.",
      sent: false
    };
  }

  const metadata: Record<string, Prisma.InputJsonValue> = {
    configured: mailResult.configured,
    deliveryPreferences,
    push: pushResult as Prisma.InputJsonValue,
    type: input.type
  };

  const metadataWithReason =
    "reason" in mailResult
      ? {
          ...metadata,
          reason: mailResult.reason
        }
      : metadata;

  const auditActionPrefix = input.auditActionPrefix ?? "account.notification";
  const emailSkipped = "skipped" in mailResult && mailResult.skipped;
  const emailAction = mailResult.sent ? "email_sent" : emailSkipped ? "email_skipped" : "email_not_sent";
  const pushFailed = "error" in pushResult;

  await writeAuditLog({
    actorId: input.user.id,
    action: `${auditActionPrefix}.${emailAction}`,
    target: input.dedupeKey,
    severity: (mailResult.sent || emailSkipped) && !pushFailed ? "info" : "warning",
    metadata: metadataWithReason
  });

  return true;
}
