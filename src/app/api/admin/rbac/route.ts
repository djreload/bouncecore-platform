import { NextResponse } from "next/server";
import { permissionDefinitions, roleDefinitions, rolePermissions } from "@/lib/auth/rbac";
import { getApiUserWithPermission } from "@/lib/auth/guards";

export async function GET() {
  const user = await getApiUserWithPermission("admin.access");

  if (!user) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    roles: roleDefinitions,
    permissions: permissionDefinitions,
    rolePermissions
  });
}
