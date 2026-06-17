import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import { prisma } from "@/lib/db/prisma";
import { mailIsConfigured, sendMail } from "@/lib/mail/smtp-service";

export type AccountNotificationEmailInput = {
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
    await prisma.notification.create({
      data: {
        body: input.body,
        dedupeKey: input.dedupeKey,
        title: input.title,
        type: input.type,
        userId: input.user.id
      }
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return false;
    }

    throw error;
  }
}

export async function notifyAccountUserOnce(input: AccountNotificationEmailInput) {
  const created = await createNotificationOnce(input);

  if (!created) {
    return;
  }

  let mailResult:
    | Awaited<ReturnType<typeof sendMail>>
    | {
        configured: true;
        reason: string;
        sent: false;
      };

  try {
    mailResult = await sendMail({
      html: emailHtml(input.subject, input.htmlLines),
      subject: input.subject,
      text: input.textLines.join("\n"),
      to: input.user.email
    });
  } catch (error) {
    mailResult = {
      configured: mailIsConfigured(),
      reason: error instanceof Error ? error.message : "Email send failed.",
      sent: false
    };
  }

  const metadata: Record<string, boolean | string> = {
    configured: mailResult.configured,
    type: input.type
  };

  if ("reason" in mailResult) {
    metadata.reason = mailResult.reason;
  }

  const auditActionPrefix = input.auditActionPrefix ?? "account.notification";

  await writeAuditLog({
    actorId: input.user.id,
    action: `${auditActionPrefix}.${mailResult.sent ? "email_sent" : "email_not_sent"}`,
    target: input.dedupeKey,
    severity: mailResult.sent ? "info" : "warning",
    metadata: metadata as Prisma.InputJsonObject
  });
}
