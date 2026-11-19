import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { UserRole } from '@bosla/db';
import type { PermissionCode, SystemRoleCode } from '@bosla/shared';

export const ROLES_KEY = 'bosla_roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'bosla_permissions';
export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const ALLOW_PENDING_ENROLLMENT_KEY = 'bosla_allow_pending_enrollment';
export const AllowPendingEnrollment = () => SetMetadata(ALLOW_PENDING_ENROLLMENT_KEY, true);

export const SKIP_CSRF_KEY = 'bosla_skip_csrf';
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);

export interface AuthenticatedContextUser {
  id: string;
  sessionId: string;
  role: UserRole;
  roles: SystemRoleCode[];
  permissions: PermissionCode[];
  sellerId: string | null;
  organizationIds: string[];
  status: string;
  fullName: string;
  email: string | null;
  phoneE164: string | null;
  csrfSecret: string;
  lastRecentAuthAt: Date;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedContextUser | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.authUser;
  },
);
