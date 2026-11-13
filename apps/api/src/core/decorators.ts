import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { UserRole } from '@bosla/db';

export const ROLES_KEY = 'bosla_roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const ALLOW_PENDING_ENROLLMENT_KEY = 'bosla_allow_pending_enrollment';
export const AllowPendingEnrollment = () => SetMetadata(ALLOW_PENDING_ENROLLMENT_KEY, true);

export const SKIP_CSRF_KEY = 'bosla_skip_csrf';
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);

export interface AuthenticatedContextUser {
  id: string;
  sessionId: string;
  role: UserRole;
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
