import { writeAuditLog } from "@/lib/auth/audit";
import { hashPassword } from "@/lib/auth/passwords";
import { createSecretToken, hashSecretToken, tokenFingerprint } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db/prisma";
import { appOrigin } from "@/lib/http/app-url";
import { mailIsConfigured, sendMail } from "@/lib/mail/smtp-service";

const verificationTokenMaxAgeMs = 24 * 60 * 60 * 1000;
const passwordResetTokenMaxAgeMs = 60 * 60 * 1000;

type VerificationEmailInput = {
  displayName: string;
  email: string;
  origin?: string;
};

function configuredOrigin() {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!value) {
    return "http://localhost:3000";
  }

  try {
    return new URL(value).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export function verificationOrigin(request?: Request) {
  return request ? appOrigin(request) : configuredOrigin();
}

function verificationUrl(token: string, origin: string) {
  const url = new URL("/api/auth/verify-email", origin);

  url.searchParams.set("token", token);

  return url.toString();
}

function passwordResetUrl(token: string, origin: string) {
  const url = new URL("/auth/reset-password", origin);

  url.searchParams.set("token", token);

  return url.toString();
}

function verificationEmailBody(input: VerificationEmailInput, token: string) {
  const origin = input.origin ?? configuredOrigin();
  const link = verificationUrl(token, origin);
  const text = [
    `Hi ${input.displayName},`,
    "",
    "Confirm your Bouncecore account email by opening this link:",
    link,
    "",
    "This link expires in 24 hours. If you did not create this account, you can ignore this email."
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h1 style="font-size:22px">Confirm your Bouncecore email</h1>
      <p>Hi ${escapeHtml(input.displayName)},</p>
      <p>Confirm your Bouncecore account email by opening the link below.</p>
      <p><a href="${link}" style="display:inline-block;background:#00d5ff;color:#051015;padding:12px 16px;border-radius:6px;font-weight:700;text-decoration:none">Verify email</a></p>
      <p style="font-size:13px;color:#555">This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>
    </div>
  `;

  return {
    html,
    text
  };
}

function inviteEmailBody(input: VerificationEmailInput & { inviteUrl: string; roles: string[] }) {
  const text = [
    `Hi ${input.displayName},`,
    "",
    "You have been invited to Bouncecore.",
    `Open this invite link to create your account: ${input.inviteUrl}`,
    "",
    `Assigned roles: ${input.roles.join(", ")}`,
    "",
    "After registration, Bouncecore will ask you to verify this email address."
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h1 style="font-size:22px">Bouncecore invite</h1>
      <p>Hi ${escapeHtml(input.displayName)},</p>
      <p>You have been invited to Bouncecore.</p>
      <p><a href="${input.inviteUrl}" style="display:inline-block;background:#ff2bd6;color:#fff;padding:12px 16px;border-radius:6px;font-weight:700;text-decoration:none">Accept invite</a></p>
      <p style="font-size:13px;color:#555">Assigned roles: ${escapeHtml(input.roles.join(", "))}</p>
      <p style="font-size:13px;color:#555">After registration, Bouncecore will ask you to verify this email address.</p>
    </div>
  `;

  return {
    html,
    text
  };
}

function passwordResetEmailBody(input: VerificationEmailInput, token: string) {
  const origin = input.origin ?? configuredOrigin();
  const link = passwordResetUrl(token, origin);
  const text = [
    `Hi ${input.displayName},`,
    "",
    "A password reset was requested for your Bouncecore account.",
    `Open this link to set a new password: ${link}`,
    "",
    "This link expires in 1 hour. If you did not request this, you can ignore this email."
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h1 style="font-size:22px">Reset your Bouncecore password</h1>
      <p>Hi ${escapeHtml(input.displayName)},</p>
      <p>A password reset was requested for your Bouncecore account.</p>
      <p><a href="${link}" style="display:inline-block;background:#00d5ff;color:#051015;padding:12px 16px;border-radius:6px;font-weight:700;text-decoration:none">Reset password</a></p>
      <p style="font-size:13px;color:#555">This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
    </div>
  `;

  return {
    html,
    text
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function issueEmailVerification(input: VerificationEmailInput) {
  const token = createSecretToken("bc_verify");
  const tokenHash = hashSecretToken(token);

  await prisma.emailVerificationToken.updateMany({
    where: {
      email: input.email,
      usedAt: null
    },
    data: {
      usedAt: new Date()
    }
  });

  await prisma.emailVerificationToken.create({
    data: {
      email: input.email,
      expiresAt: new Date(Date.now() + verificationTokenMaxAgeMs),
      tokenHash
    }
  });

  const body = verificationEmailBody(input, token);
  const result = await sendMail({
    html: body.html,
    subject: "Verify your Bouncecore email",
    text: body.text,
    to: input.email
  }).catch((error) => ({
    configured: mailIsConfigured(),
    reason: error instanceof Error ? error.message : "SMTP send failed.",
    sent: false
  }));

  await writeAuditLog({
    action: result.sent ? "auth.email_verification.send" : "auth.email_verification.skip",
    target: `email:${input.email}`,
    severity: result.sent ? "info" : "warning",
    metadata: {
      configured: result.configured,
      reason: result.sent ? null : result.reason,
      tokenFingerprint: tokenFingerprint(token)
    }
  });

  return result;
}

export async function resendEmailVerification(email: string, origin?: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return {
      sent: false,
      status: "missing-email"
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail
    },
    select: {
      displayName: true,
      email: true,
      emailVerifiedAt: true,
      status: true
    }
  });

  if (!user || user.emailVerifiedAt || user.status === "banned" || user.status === "suspended") {
    return {
      sent: false,
      status: "accepted"
    };
  }

  const result = await issueEmailVerification({
    displayName: user.displayName,
    email: user.email,
    origin
  });

  return {
    sent: result.sent,
    status: result.sent ? "sent" : "not-configured"
  };
}

export async function verifyEmailToken(token: string) {
  const tokenHash = hashSecretToken(token.trim());
  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: {
      tokenHash
    }
  });

  if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt <= new Date()) {
    return {
      ok: false,
      status: "invalid"
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      email: verificationToken.email
    }
  });

  if (!user || user.status === "banned" || user.status === "suspended") {
    return {
      ok: false,
      status: "invalid"
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: user.id
      },
      data: {
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        status: user.status === "pending" ? "active" : user.status
      }
    });

    await tx.emailVerificationToken.updateMany({
      where: {
        email: verificationToken.email,
        usedAt: null
      },
      data: {
        usedAt: new Date()
      }
    });
  });

  await writeAuditLog({
    actorId: user.id,
    action: "auth.email_verification.complete",
    target: `user:${user.id}`,
    severity: "info",
    metadata: {
      tokenFingerprint: tokenFingerprint(token)
    }
  });

  return {
    ok: true,
    status: "verified"
  };
}

export async function sendInviteEmail(input: { email: string; inviteUrl: string; roles: string[] }) {
  if (!mailIsConfigured()) {
    return {
      configured: false,
      reason: "SMTP is not configured.",
      sent: false
    } as const;
  }

  const body = inviteEmailBody({
    displayName: input.email,
    email: input.email,
    inviteUrl: input.inviteUrl,
    roles: input.roles
  });

  return sendMail({
    html: body.html,
    subject: "You have been invited to Bouncecore",
    text: body.text,
    to: input.email
  });
}

export async function requestPasswordReset(email: string, origin?: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return {
      sent: false,
      status: "missing-email"
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail
    },
    select: {
      displayName: true,
      email: true,
      status: true
    }
  });

  if (!user || user.status === "banned" || user.status === "suspended") {
    return {
      sent: false,
      status: "accepted"
    };
  }

  const token = createSecretToken("bc_reset");

  await prisma.passwordResetToken.updateMany({
    where: {
      email: user.email,
      usedAt: null
    },
    data: {
      usedAt: new Date()
    }
  });

  await prisma.passwordResetToken.create({
    data: {
      email: user.email,
      expiresAt: new Date(Date.now() + passwordResetTokenMaxAgeMs),
      tokenHash: hashSecretToken(token)
    }
  });

  const body = passwordResetEmailBody(
    {
      displayName: user.displayName,
      email: user.email,
      origin
    },
    token
  );
  const result = await sendMail({
    html: body.html,
    subject: "Reset your Bouncecore password",
    text: body.text,
    to: user.email
  }).catch((error) => ({
    configured: mailIsConfigured(),
    reason: error instanceof Error ? error.message : "SMTP send failed.",
    sent: false
  }));

  await writeAuditLog({
    action: result.sent ? "auth.password_reset.send" : "auth.password_reset.skip",
    target: `email:${user.email}`,
    severity: result.sent ? "info" : "warning",
    metadata: {
      configured: result.configured,
      reason: result.sent ? null : result.reason,
      tokenFingerprint: tokenFingerprint(token)
    }
  });

  return {
    sent: result.sent,
    status: result.sent ? "sent" : "not-configured"
  };
}

export async function resetPasswordWithToken(token: string, password: string) {
  const trimmedToken = token.trim();

  if (!trimmedToken || password.length < 12 || password.length > 128) {
    return {
      ok: false,
      status: "invalid-input"
    };
  }

  const tokenHash = hashSecretToken(trimmedToken);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: {
      tokenHash
    }
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
    return {
      ok: false,
      status: "invalid-token"
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      email: resetToken.email
    }
  });

  if (!user || user.status === "banned" || user.status === "suspended") {
    return {
      ok: false,
      status: "invalid-token"
    };
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: user.id
      },
      data: {
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        passwordHash,
        status: user.status === "pending" ? "active" : user.status
      }
    });

    await tx.passwordResetToken.updateMany({
      where: {
        email: resetToken.email,
        usedAt: null
      },
      data: {
        usedAt: new Date()
      }
    });

    await tx.authSession.updateMany({
      where: {
        revokedAt: null,
        userId: user.id
      },
      data: {
        revokedAt: new Date()
      }
    });
  });

  await writeAuditLog({
    actorId: user.id,
    action: "auth.password_reset.complete",
    target: `user:${user.id}`,
    severity: "warning",
    metadata: {
      tokenFingerprint: tokenFingerprint(trimmedToken)
    }
  });

  return {
    ok: true,
    status: "reset"
  };
}
