import { writeAuditLog } from "@/lib/auth/audit";
import { normalizeEmailAddress } from "@/lib/mail/email-address";
import { mailIsConfigured, sendMail } from "@/lib/mail/smtp-service";

type AdminSmtpTestInput = {
  actorDisplayName: string;
  actorId: string;
  recipientEmail: string;
};

function testEmailHtml(actorDisplayName: string) {
  const escapedActorName = actorDisplayName.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      '"': "&quot;",
      "&": "&amp;",
      "'": "&#39;",
      "<": "&lt;",
      ">": "&gt;"
    };

    return replacements[character] ?? character;
  });

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h1 style="font-size:22px">Bouncecore SMTP test</h1>
      <p>This test email was sent from the Bouncecore admin integrations page.</p>
      <p>Triggered by: <strong>${escapedActorName}</strong></p>
      <p style="font-size:13px;color:#555">If you did not expect this test, review the admin audit logs.</p>
    </div>
  `;
}

export async function sendAdminSmtpTestEmail(input: AdminSmtpTestInput) {
  const recipientEmail = normalizeEmailAddress(input.recipientEmail, "Recipient email");
  const configured = mailIsConfigured();

  try {
    const result = await sendMail({
      html: testEmailHtml(input.actorDisplayName),
      subject: "Bouncecore SMTP test",
      text: [
        "Bouncecore SMTP test",
        "",
        "This test email was sent from the Bouncecore admin integrations page.",
        `Triggered by: ${input.actorDisplayName}`,
        "",
        "If you did not expect this test, review the admin audit logs."
      ].join("\n"),
      to: recipientEmail
    });

    await writeAuditLog({
      action: `integrations.mail_test.${result.sent ? "email_sent" : "email_not_sent"}`,
      actorId: input.actorId,
      metadata: result.sent
        ? {
            configured: result.configured,
            messageId: result.messageId,
            type: "admin.smtp_test"
          }
        : {
            configured: result.configured,
            reason: result.reason,
            type: "admin.smtp_test"
          },
      severity: result.sent ? "info" : "warning",
      target: `email:${recipientEmail}`
    });

    if (!result.sent) {
      throw new Error(result.reason);
    }

    return {
      messageId: result.messageId,
      recipientEmail
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "SMTP test failed.";

    if (configured) {
      await writeAuditLog({
        action: "integrations.mail_test.email_not_sent",
        actorId: input.actorId,
        metadata: {
          configured,
          reason,
          type: "admin.smtp_test"
        },
        severity: "critical",
        target: `email:${recipientEmail}`
      });
    }

    throw new Error(`SMTP test email failed: ${reason}`);
  }
}
