import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import type { UserRole } from '@bosla/db';
import { PrismaService } from './prisma.service';
import {
  ALLOW_PENDING_ENROLLMENT_KEY,
  AuthenticatedContextUser,
  ROLES_KEY,
  SKIP_CSRF_KEY,
} from './decorators';

export const SESSION_COOKIE_NAME = 'bosla_session';

export function hashSessionToken(rawToken: string): string {
  const secret = process.env.SESSION_SECRET || 'dev_only_replace_with_64_char_random_secret_for_production_use';
  return createHash('sha256').update(`${secret}:${rawToken}`).digest('hex');
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const rawCookie: string | undefined = request.cookies?.[SESSION_COOKIE_NAME];
    if (!rawCookie) {
      throw new UnauthorizedException('يلزم تسجيل الدخول للوصول إلى هذا المورد');
    }

    const tokenHash = hashSessionToken(rawCookie);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجددًا');
    }

    if (session.user.status === 'SUSPENDED' || session.user.status === 'LOCKED') {
      throw new ForbiddenException('الحساب موقوف أو مقفل مؤقتًا');
    }

    const allowPending = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PENDING_ENROLLMENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (session.user.status === 'ENROLLMENT_PENDING' && !allowPending) {
      throw new ForbiddenException({
        code: 'PASSKEY_ENROLLMENT_REQUIRED',
        message: 'يلزم إتمام تأمين الحساب باستخدام Passkey قبل تفعيل الوصول',
      });
    }

    const authUser: AuthenticatedContextUser = {
      id: session.user.id,
      sessionId: session.id,
      role: session.user.role,
      status: session.user.status,
      fullName: session.user.fullName,
      email: session.user.email,
      phoneE164: session.user.phoneE164,
      csrfSecret: session.csrfSecret,
      lastRecentAuthAt: session.lastRecentAuthAt,
    };

    request.authUser = authUser;
    return true;
  }
}

@Injectable()
export class OptionalSessionAuthGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const rawCookie: string | undefined = request.cookies?.[SESSION_COOKIE_NAME];
    if (!rawCookie) return true;

    const tokenHash = hashSessionToken(rawCookie);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (session && !session.revokedAt && session.expiresAt > new Date() && session.user.status === 'ACTIVE') {
      request.authUser = {
        id: session.user.id,
        sessionId: session.id,
        role: session.user.role,
        status: session.user.status,
        fullName: session.user.fullName,
        email: session.user.email,
        phoneE164: session.user.phoneE164,
        csrfSecret: session.csrfSecret,
        lastRecentAuthAt: session.lastRecentAuthAt,
      } satisfies AuthenticatedContextUser;
    }
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedContextUser | undefined = request.authUser;
    if (!user) {
      throw new UnauthorizedException('يلزم تسجيل الدخول');
    }
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('ليس لديك صلاحية تنفيذ هذا الإجراء');
    }
    return true;
  }
}

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const method = (request.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true;
    }

    const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipCsrf) return true;

    const user: AuthenticatedContextUser | undefined = request.authUser;
    // CSRF binds to authenticated cookie sessions
    if (!user) return true;

    const headerToken = request.headers['x-csrf-token'];
    if (!headerToken || headerToken !== user.csrfSecret) {
      throw new ForbiddenException({
        code: 'CSRF_INVALID',
        message: 'رمز الحماية CSRF غير صالح أو مفقود',
      });
    }
    return true;
  }
}
