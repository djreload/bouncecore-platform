"use client";

import { useActionState } from "react";
import { Ban, Plus, Save, Trash2, X } from "lucide-react";
import {
  addAdminUserRoleAction,
  deleteAdminUserAction,
  removeAdminUserRoleAction,
  revokeAdminUserInviteAction,
  updateAdminUserStatusAction
} from "@/app/admin/users/actions";
import {
  initialAdminUserManagementActionState,
  type AdminUserManagementActionState
} from "@/app/admin/users/state";
import { Button } from "@/components/ui/button";

function InlineActionMessage({ state }: { state: AdminUserManagementActionState }) {
  if (!state.message) {
    return null;
  }

  return <p className={`text-xs ${state.status === "error" ? "text-bc-pink" : "text-bc-acid"}`}>{state.message}</p>;
}

export function UserStatusForm({
  statuses,
  userId,
  value
}: {
  statuses: string[];
  userId: string;
  value: string;
}) {
  const [state, formAction, pending] = useActionState<AdminUserManagementActionState, FormData>(
    updateAdminUserStatusAction,
    initialAdminUserManagementActionState
  );

  return (
    <form action={formAction} className="mt-3 grid gap-2">
      <input name="userId" type="hidden" value={userId} />
      <div className="flex flex-wrap gap-2">
        <select
          className="min-h-9 rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-xs text-white"
          defaultValue={value}
          name="status"
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <Button disabled={pending} size="sm" type="submit" variant="ghost">
          <Save className="h-4 w-4" aria-hidden="true" />
          {pending ? "Saving" : "Save"}
        </Button>
      </div>
      <InlineActionMessage state={state} />
    </form>
  );
}

export function AddUserRoleForm({
  roles,
  userId
}: {
  roles: Array<{
    id: string;
    label: string;
    value: string;
  }>;
  userId: string;
}) {
  const [state, formAction, pending] = useActionState<AdminUserManagementActionState, FormData>(
    addAdminUserRoleAction,
    initialAdminUserManagementActionState
  );

  return (
    <form action={formAction} className="grid gap-2">
      <input name="userId" type="hidden" value={userId} />
      <div className="flex flex-wrap gap-2">
        <select className="min-h-9 max-w-[220px] rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-xs text-white" name="role">
          {roles.map((role) => (
            <option key={role.id} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
        <Button disabled={pending} size="sm" type="submit" variant="primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {pending ? "Adding" : "Add role"}
        </Button>
      </div>
      <InlineActionMessage state={state} />
    </form>
  );
}

export function RemoveUserRoleForm({ role, userId }: { role: string; userId: string }) {
  const [state, formAction, pending] = useActionState<AdminUserManagementActionState, FormData>(
    removeAdminUserRoleAction,
    initialAdminUserManagementActionState
  );

  return (
    <form action={formAction} className="grid gap-1">
      <input name="userId" type="hidden" value={userId} />
      <input name="role" type="hidden" value={role} />
      <Button disabled={pending} size="sm" type="submit" variant="dark">
        <X className="h-4 w-4" aria-hidden="true" />
        {pending ? "Removing" : "Remove"}
      </Button>
      <InlineActionMessage state={state} />
    </form>
  );
}

export function DeleteUserForm({ email, userId }: { email: string; userId: string }) {
  const [state, formAction, pending] = useActionState<AdminUserManagementActionState, FormData>(
    deleteAdminUserAction,
    initialAdminUserManagementActionState
  );

  return (
    <form action={formAction} className="grid gap-2">
      <input name="userId" type="hidden" value={userId} />
      <label className="text-xs font-semibold text-bc-muted" htmlFor={`delete-${userId}`}>
        Type this user&apos;s email to delete the account and related data.
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          autoComplete="off"
          className="min-h-9 max-w-[260px] rounded-md border border-bc-line bg-bc-ink px-3 py-2 text-xs text-white"
          id={`delete-${userId}`}
          name="confirmation"
          placeholder={email}
          type="email"
        />
        <Button disabled={pending} size="sm" type="submit" variant="pink">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {pending ? "Deleting" : "Delete"}
        </Button>
      </div>
      <InlineActionMessage state={state} />
    </form>
  );
}

export function RevokeInviteForm({ inviteId }: { inviteId: string }) {
  const [state, formAction, pending] = useActionState<AdminUserManagementActionState, FormData>(
    revokeAdminUserInviteAction,
    initialAdminUserManagementActionState
  );

  return (
    <form action={formAction} className="grid gap-2">
      <input name="inviteId" type="hidden" value={inviteId} />
      <Button disabled={pending} size="sm" type="submit" variant="dark">
        <Ban className="h-4 w-4" aria-hidden="true" />
        {pending ? "Revoking" : "Revoke"}
      </Button>
      <InlineActionMessage state={state} />
    </form>
  );
}
