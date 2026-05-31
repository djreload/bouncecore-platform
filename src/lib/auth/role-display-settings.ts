import { writeAuditLog } from "@/lib/auth/audit";
import { roleDefinitions, type Role } from "@/lib/auth/rbac";
import type { RoleDisplayNameMap } from "@/lib/auth/role-display";
import { prisma } from "@/lib/db/prisma";

const roleDisplaySettingKey = "auth.role_display_labels";
const roleKeys = new Set<string>(roleDefinitions.map((role) => role.key));

function toDisplayLabelMap(value: unknown): RoleDisplayNameMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<RoleDisplayNameMap>((labels, [role, label]) => {
    if (roleKeys.has(role) && typeof label === "string" && label.trim()) {
      labels[role] = label.trim();
    }

    return labels;
  }, {});
}

function assertRoleKey(role: string): asserts role is Role {
  if (!roleKeys.has(role)) {
    throw new Error("Unknown role.");
  }
}

export async function getRoleDisplayNameOverrides() {
  const setting = await prisma.appSetting.findUnique({
    where: {
      key: roleDisplaySettingKey
    }
  });

  return toDisplayLabelMap(setting?.value);
}

export async function updateRoleDisplayName(role: string, displayName: string, actorId: string) {
  assertRoleKey(role);

  const label = displayName.trim();

  if (label.length < 2 || label.length > 40) {
    throw new Error("Role display label must be between 2 and 40 characters.");
  }

  const labels = await getRoleDisplayNameOverrides();
  const nextLabels: RoleDisplayNameMap = {
    ...labels,
    [role]: label
  };

  await prisma.appSetting.upsert({
    where: {
      key: roleDisplaySettingKey
    },
    update: {
      value: nextLabels,
      description: "Role badge display labels used in admin role views.",
      isSecret: false
    },
    create: {
      key: roleDisplaySettingKey,
      value: nextLabels,
      description: "Role badge display labels used in admin role views.",
      isSecret: false
    }
  });

  await writeAuditLog({
    actorId,
    action: "roles.display_label.update",
    target: `role:${role}`,
    severity: "info",
    metadata: {
      role,
      displayName: label
    }
  });
}
