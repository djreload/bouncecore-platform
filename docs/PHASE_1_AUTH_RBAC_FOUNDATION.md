# Phase 1 Auth and RBAC Foundation

## What This Adds

This slice creates the first concrete foundation for Bouncecore-owned identity and access control:

- Typed role catalogue.
- Typed permission catalogue.
- Role-to-permission grants.
- Navigation filtering helpers.
- Permission guard helpers.
- Password hashing and verification helpers using Node `scrypt`.
- Secret-token creation, hashing, and fingerprint helpers.
- Session cookie token-hash helper.
- Register, login, logout, and current-session API route scaffolding.
- Form-backed login and register pages.
- Dedicated account security page with session state and logout action.
- Prisma singleton.
- Prisma 7 PostgreSQL driver adapter setup with `@prisma/adapter-pg` and `pg`.
- Prisma auth/session/token/settings/audit model expansion.
- Seed script for roles, permissions, and baseline app setting.
- Admin Users, Roles, and Permissions pages.
- RBAC JSON endpoint for admin/debug integration.

## Security Rules Preserved

- Bouncecore owns login, users, roles, and permissions.
- Moderators are not granted raw stream-key visibility by default.
- Streamer users can manage and view only their own stream key.
- Raw secrets should be stored hashed or encrypted.
- Session tokens are represented by hashes, not raw tokens.
- Session cookies are HTTP-only, same-site lax, secure in production, and scoped to `/`.
- Audit logs include severity, actor, target, metadata, IP, and user-agent fields.

## Database Notes

The Prisma schema now includes:

- `UserStatus`
- `AuditSeverity`
- `AuthAccount`
- `AuthSession`
- `EmailVerificationToken`
- `PasswordResetToken`
- `AppSetting`
- expanded `User`, `Role`, `Permission`, `UserRole`, `Profile`, and `AuditLog`

Run after a real Bouncecore PostgreSQL database exists:

```powershell
npm.cmd run prisma:generate
npx prisma migrate dev --name phase_1_auth_rbac_foundation
npm.cmd run db:seed
```

Do not run migrations against unrelated databases.

## Still Needed

- Choose final auth runtime implementation: Better Auth, Auth.js, or custom session service.
- Apply migrations and seed the Bouncecore database so register/login/logout routes can persist real accounts.
- Replace temporary database-unavailable fallbacks with observed error handling once staging database health checks exist.
- Add server-side route guards for admin, streamer, producer, and account routes.
- Add CSRF protection for state-changing forms.
- Add rate limits for auth endpoints.
- Add invite and owner bootstrap flow.
- Add real user-management CRUD.
