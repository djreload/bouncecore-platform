import { Prisma, type AuditSeverity } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type AuditInput = {
  actorId?: string | null;
  action: string;
  target?: string | null;
  severity?: AuditSeverity;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function writeAuditLog({
  actorId,
  action,
  target,
  severity = "info",
  metadata,
  ipAddress,
  userAgent
}: AuditInput) {
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      target,
      severity,
      metadata,
      ipAddress,
      userAgent
    }
  });
}
