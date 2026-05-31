import { NextResponse } from "next/server";
import { permissionDefinitions, roleDefinitions, rolePermissions } from "@/lib/auth/rbac";

export function GET() {
  return NextResponse.json({
    roles: roleDefinitions,
    permissions: permissionDefinitions,
    rolePermissions
  });
}
