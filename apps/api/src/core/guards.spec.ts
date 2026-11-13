import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import {
  ALLOW_PENDING_ENROLLMENT_KEY,
  ROLES_KEY,
  SKIP_CSRF_KEY,
} from './decorators';
import { CsrfGuard, hashSessionToken, RolesGuard, SESSION_COOKIE_NAME, SessionAuthGuard } from './guards';
import type { PrismaService } from './prisma.service';

function createHttpContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('Core Auth, RBAC, and CSRF Guards', () => {
  it('hashes session tokens deterministically using SHA-256 hex', () => {
    const hashA = hashSessionToken('raw-token-value');
    const hashB = hashSessionToken('raw-token-value');
    const hashC = hashSessionToken('other-token-value');
    expect(hashA).toMatch(/^[a-f0-9]{64}$/);
    expect(hashA).toBe(hashB);
    expect(hashA).not.toBe(hashC);
  });

  it('enforces @Roles metadata via RolesGuard', () => {
    const reflector = {
      getAllAndOverride: (key: string) => (key === ROLES_KEY ? ['ADMIN'] : undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(createHttpContext({}))).toThrow(UnauthorizedException);
    expect(() =>
      guard.canActivate(createHttpContext({ authUser: { role: 'STUDENT' } })),
    ).toThrow(ForbiddenException);
    expect(
      guard.canActivate(createHttpContext({ authUser: { role: 'ADMIN' } })),
    ).toBe(true);
  });

  it('enforces CSRF header for mutating authenticated requests unless @SkipCsrf() is set', () => {
    const defaultReflector = {
      getAllAndOverride: () => false,
    } as unknown as Reflector;
    const guard = new CsrfGuard(defaultReflector);

    expect(
      guard.canActivate(createHttpContext({ method: 'GET', authUser: { csrfSecret: 'abc' }, headers: {} })),
    ).toBe(true);
    expect(() =>
      guard.canActivate(
        createHttpContext({
          method: 'POST',
          authUser: { csrfSecret: 'expected-csrf' },
          headers: { 'x-csrf-token': 'wrong-csrf' },
        }),
      ),
    ).toThrow(ForbiddenException);
    expect(
      guard.canActivate(
        createHttpContext({
          method: 'POST',
          authUser: { csrfSecret: 'expected-csrf' },
          headers: { 'x-csrf-token': 'expected-csrf' },
        }),
      ),
    ).toBe(true);

    const skipReflector = {
      getAllAndOverride: (key: string) => key === SKIP_CSRF_KEY,
    } as unknown as Reflector;
    const skipGuard = new CsrfGuard(skipReflector);
    expect(
      skipGuard.canActivate(
        createHttpContext({ method: 'POST', authUser: { csrfSecret: 'expected-csrf' }, headers: {} }),
      ),
    ).toBe(true);
  });

  it('blocks ENROLLMENT_PENDING sessions unless @AllowPendingEnrollment() is set', async () => {
    const pendingSession = {
      id: 'sess-1',
      csrfSecret: 'csrf-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      lastRecentAuthAt: new Date(),
      user: {
        id: 'user-1',
        role: 'STUDENT',
        status: 'ENROLLMENT_PENDING',
        fullName: 'طالب بوصلة',
        email: null,
        phoneE164: '+201000000999',
      },
    };
    const mockPrisma = {
      session: {
        findUnique: async () => pendingSession,
      },
    } as unknown as PrismaService;

    const strictReflector = {
      getAllAndOverride: () => false,
    } as unknown as Reflector;
    const strictGuard = new SessionAuthGuard(mockPrisma, strictReflector);
    await expect(
      strictGuard.canActivate(
        createHttpContext({ cookies: { [SESSION_COOKIE_NAME]: 'raw-cookie' } }),
      ),
    ).rejects.toThrow(ForbiddenException);

    const allowPendingReflector = {
      getAllAndOverride: (key: string) => key === ALLOW_PENDING_ENROLLMENT_KEY,
    } as unknown as Reflector;
    const pendingAllowedGuard = new SessionAuthGuard(mockPrisma, allowPendingReflector);
    const req: Record<string, unknown> = { cookies: { [SESSION_COOKIE_NAME]: 'raw-cookie' } };
    await expect(pendingAllowedGuard.canActivate(createHttpContext(req))).resolves.toBe(true);
    expect((req.authUser as { id: string }).id).toBe('user-1');
  });
});
