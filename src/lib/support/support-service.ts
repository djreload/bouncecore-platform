import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/auth/audit";
import type { CurrentUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import {
  normalizeOption,
  normalizeSupportRequestInput,
  normalizeSupportResolutionNote,
  supportStatuses,
  type SupportRequestInput
} from "@/lib/support/support-request-core";

export { normalizeSupportRequestInput, supportCategories, supportPriorities, supportStatuses } from "@/lib/support/support-request-core";

export type SupportRequestContext = {
  ipAddress?: string | null;
  source?: string;
  user?: CurrentUser | null;
  userAgent?: string | null;
};

export type AdminSupportRequestSummary = {
  category: string;
  createdAt: string;
  email: string;
  id: string;
  message: string;
  name: string | null;
  priority: string;
  resolvedAt: string | null;
  resolvedByDisplayName: string | null;
  resolutionNote: string | null;
  status: string;
  subject: string;
  userDisplayName: string | null;
  userEmail: string | null;
};

export type AdminSupportRequestsData = {
  requests: AdminSupportRequestSummary[];
  stats: {
    dismissed: number;
    open: number;
    resolved: number;
    reviewing: number;
    total: number;
    waiting: number;
  };
};

export async function createSupportRequest(input: SupportRequestInput, context: SupportRequestContext = {}) {
  const data = normalizeSupportRequestInput(input, context.user?.email);

  const request = await prisma.supportRequest.create({
    data: {
      ...data,
      ipAddress: context.ipAddress ?? null,
      source: context.source ?? "web",
      userAgent: context.userAgent ?? null,
      userId: context.user?.id ?? null
    }
  });

  await writeAuditLog({
    actorId: context.user?.id ?? null,
    action: "support.request.create",
    ipAddress: context.ipAddress,
    metadata: {
      category: request.category,
      email: request.email,
      priority: request.priority,
      subject: request.subject
    } satisfies Prisma.InputJsonObject,
    severity: request.priority === "urgent" ? "warning" : "info",
    target: `support-request:${request.id}`,
    userAgent: context.userAgent
  });

  return request;
}

export async function getAdminSupportRequestsData(): Promise<AdminSupportRequestsData> {
  const requests = await prisma.supportRequest.findMany({
    include: {
      resolvedBy: {
        select: {
          displayName: true
        }
      },
      user: {
        select: {
          displayName: true,
          email: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 100
  });

  return {
    requests: requests.map((request) => ({
      category: request.category,
      createdAt: request.createdAt.toISOString(),
      email: request.email,
      id: request.id,
      message: request.message,
      name: request.name,
      priority: request.priority,
      resolvedAt: request.resolvedAt?.toISOString() ?? null,
      resolvedByDisplayName: request.resolvedBy?.displayName ?? null,
      resolutionNote: request.resolutionNote,
      status: request.status,
      subject: request.subject,
      userDisplayName: request.user?.displayName ?? null,
      userEmail: request.user?.email ?? null
    })),
    stats: {
      dismissed: requests.filter((request) => request.status === "dismissed").length,
      open: requests.filter((request) => request.status === "open").length,
      resolved: requests.filter((request) => request.status === "resolved").length,
      reviewing: requests.filter((request) => request.status === "reviewing").length,
      total: requests.length,
      waiting: requests.filter((request) => request.status === "waiting").length
    }
  };
}

export async function updateSupportRequestStatus(input: {
  actor: CurrentUser;
  requestId: string;
  resolutionNote?: string;
  status: string;
}) {
  const status = normalizeOption(input.status, supportStatuses, "reviewing");
  const resolutionNote = normalizeSupportResolutionNote(input.resolutionNote);
  const resolvedAt = status === "resolved" || status === "dismissed" ? new Date() : null;

  const request = await prisma.supportRequest.update({
    data: {
      resolutionNote,
      resolvedAt,
      resolvedById: resolvedAt ? input.actor.id : null,
      status
    },
    where: {
      id: input.requestId
    }
  });

  await writeAuditLog({
    actorId: input.actor.id,
    action: "support.request.status.update",
    metadata: {
      status,
      subject: request.subject
    } satisfies Prisma.InputJsonObject,
    severity: status === "resolved" || status === "dismissed" ? "info" : "warning",
    target: `support-request:${request.id}`
  });

  return request;
}

export async function clearSupportInbox(actor: CurrentUser) {
  const result = await prisma.supportRequest.deleteMany();

  await writeAuditLog({
    actorId: actor.id,
    action: "support.inbox.clear",
    metadata: {
      deletedRequests: result.count
    },
    severity: "warning",
    target: "support-inbox"
  });

  return result;
}
