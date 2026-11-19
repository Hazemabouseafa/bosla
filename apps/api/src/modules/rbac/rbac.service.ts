import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UserRole } from '@bosla/db';
import {
  ALL_SYSTEM_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_CODES,
  ROLE_METADATA,
  rolePermissionsUpdateSchema,
  userRolesAssignSchema,
  type SystemRoleCode,
} from '@bosla/shared';
import { AuditService } from '../../core/audit.service';
import { PrismaService } from '../../core/prisma.service';
import {
  resolveUserAccess,
  syncUserRoleAssignmentsAndProvision,
} from '../../core/rbac-resolver';

@Injectable()
export class RbacService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private async ensureSeededDefinitions() {
    const count = await this.prisma.roleDefinition.count();
    if (count >= ALL_SYSTEM_ROLES.length) return;

    for (const code of ALL_SYSTEM_ROLES) {
      const meta = ROLE_METADATA[code];
      await this.prisma.roleDefinition.upsert({
        where: { code: code as UserRole },
        update: {},
        create: {
          code: code as UserRole,
          nameAr: meta.nameAr,
          descriptionAr: meta.descriptionAr,
          isSystem: true,
        },
      });
    }

    for (const permCode of PERMISSION_CODES) {
      const module = permCode.split('.')[0] || 'general';
      await this.prisma.permissionDefinition.upsert({
        where: { code: permCode },
        update: {},
        create: {
          code: permCode,
          module,
          nameAr: permCode,
          descriptionAr: permCode,
        },
      });
    }

    const roles = await this.prisma.roleDefinition.findMany();
    const perms = await this.prisma.permissionDefinition.findMany();
    const permByCode = new Map(perms.map((p) => [p.code, p.id]));

    for (const r of roles) {
      const existing = await this.prisma.rolePermission.count({ where: { roleId: r.id } });
      if (existing > 0) continue;
      const defaults = DEFAULT_ROLE_PERMISSIONS[r.code as SystemRoleCode] ?? [];
      for (const pCode of defaults) {
        const pid = permByCode.get(pCode);
        if (!pid) continue;
        await this.prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: r.id, permissionId: pid } },
          update: {},
          create: { roleId: r.id, permissionId: pid },
        });
      }
    }
  }

  async getPermissionMatrix() {
    await this.ensureSeededDefinitions();

    const [roles, permissions] = await Promise.all([
      this.prisma.roleDefinition.findMany({
        orderBy: { code: 'asc' },
        include: {
          permissions: {
            include: { permission: { select: { code: true } } },
          },
          _count: { select: { assignments: true } },
        },
      }),
      this.prisma.permissionDefinition.findMany({
        orderBy: [{ module: 'asc' }, { code: 'asc' }],
      }),
    ]);

    return {
      roles: roles.map((r) => ({
        id: r.id,
        code: r.code,
        nameAr: r.nameAr,
        descriptionAr: r.descriptionAr,
        isSystem: r.isSystem,
        assignedUsersCount: r._count.assignments,
        permissions: r.permissions.map((rp) => rp.permission.code),
      })),
      permissions,
    };
  }

  async updateRolePermissions(
    actorId: string,
    actorRole: UserRole,
    roleCode: string,
    body: unknown,
    ipAddress?: string,
  ) {
    await this.ensureSeededDefinitions();
    const parsed = rolePermissionsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات الصلاحيات غير صالحة');
    }

    const roleDef = await this.prisma.roleDefinition.findUnique({
      where: { code: roleCode as UserRole },
    });
    if (!roleDef) {
      throw new NotFoundException('الدور المطلوب غير موجود');
    }

    if (
      (roleDef.code === 'SUPER_ADMIN' || roleDef.code === 'ADMIN') &&
      !parsed.data.permissions.includes('rbac.manage')
    ) {
      throw new BadRequestException('لا يمكن إزالة صلاحية إدارة الأدوار من دور المدير الأعلى');
    }

    // Security policy: SUPPORT must never receive direct settlement approval/payout authority
    if (
      roleDef.code === 'SUPPORT' &&
      (parsed.data.permissions.includes('settlements.approve') ||
        parsed.data.permissions.includes('settlements.payout'))
    ) {
      throw new BadRequestException('لا يجوز منح دور خدمة العملاء صلاحية اعتماد أو صرف التسويات المالية');
    }

    const permRows = await this.prisma.permissionDefinition.findMany({
      where: { code: { in: parsed.data.permissions } },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: roleDef.id } });
      if (permRows.length > 0) {
        await tx.rolePermission.createMany({
          data: permRows.map((p) => ({
            roleId: roleDef.id,
            permissionId: p.id,
          })),
          skipDuplicates: true,
        });
      }
    });

    await this.audit.log({
      actorId,
      actorRole,
      action: 'RBAC_ROLE_PERMISSIONS_UPDATED',
      entityType: 'RoleDefinition',
      entityId: roleDef.id,
      metadata: {
        roleCode: roleDef.code,
        permissionsCount: permRows.length,
        permissions: parsed.data.permissions,
      },
      ipAddress,
    });

    return {
      roleCode: roleDef.code,
      permissions: parsed.data.permissions,
    };
  }

  async listUsersWithRoles(q?: string) {
    await this.ensureSeededDefinitions();
    const users = await this.prisma.user.findMany({
      where: q?.trim()
        ? {
            OR: [
              { fullName: { contains: q.trim(), mode: 'insensitive' } },
              { email: { contains: q.trim(), mode: 'insensitive' } },
              { phoneE164: { contains: q.trim() } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneE164: true,
        role: true,
        status: true,
        assignedUserRoles: {
          include: { role: { select: { code: true, nameAr: true } } },
        },
        sellerAccount: { select: { id: true, status: true } },
      },
    });

    return users.map((u) => {
      const extraRoles = u.assignedUserRoles.map((a) => a.role.code);
      const effectiveRoles = Array.from(new Set([u.role, ...extraRoles]));
      return {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phoneE164: u.phoneE164,
        primaryRole: u.role,
        roles: effectiveRoles,
        status: u.status,
        sellerStatus: u.sellerAccount?.status ?? null,
      };
    });
  }

  async assignUserRoles(
    actorId: string,
    actorRole: UserRole,
    targetUserId: string,
    body: unknown,
    ipAddress?: string,
  ) {
    await this.ensureSeededDefinitions();
    const parsed = userRolesAssignSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message || 'بيانات الأدوار غير صالحة');
    }

    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    const combinedRoles = Array.from(
      new Set<SystemRoleCode>([parsed.data.primaryRole, ...parsed.data.extraRoles]),
    );

    // Prevent removing the last active Super Admin / Admin
    if (
      (target.role === 'ADMIN' || target.role === 'SUPER_ADMIN') &&
      !combinedRoles.includes('ADMIN') &&
      !combinedRoles.includes('SUPER_ADMIN')
    ) {
      const otherAdmins = await this.prisma.user.count({
        where: {
          id: { not: target.id },
          status: 'ACTIVE',
          role: { in: ['ADMIN', 'SUPER_ADMIN'] },
        },
      });
      if (otherAdmins === 0) {
        throw new BadRequestException('لا يمكن سحب صلاحية الإدارة من آخر مدير نشط بالمنصة');
      }
    }

    await this.prisma.user.update({
      where: { id: target.id },
      data: { role: parsed.data.primaryRole as UserRole },
    });
    await syncUserRoleAssignmentsAndProvision(this.prisma, {
      userId: target.id,
      primaryRole: parsed.data.primaryRole as UserRole,
      extraRoles: parsed.data.extraRoles as UserRole[],
      assignedById: actorId,
    });

    await this.audit.log({
      actorId,
      actorRole,
      action: 'RBAC_USER_ROLES_UPDATED',
      entityType: 'User',
      entityId: target.id,
      metadata: {
        previousPrimaryRole: target.role,
        primaryRole: parsed.data.primaryRole,
        roles: combinedRoles,
      },
      ipAddress,
    });

    const access = await resolveUserAccess(
      this.prisma,
      target.id,
      parsed.data.primaryRole as UserRole,
    );

    return {
      userId: target.id,
      primaryRole: parsed.data.primaryRole,
      roles: access.roles,
      permissions: access.permissions,
    };
  }

  async listAuditLogs(params: {
    action?: string;
    entityType?: string;
    actorId?: string;
    limit?: number;
  }) {
    const take = Math.min(Math.max(params.limit ?? 50, 1), 200);
    return this.prisma.auditLog.findMany({
      where: {
        ...(params.action ? { action: { contains: params.action, mode: 'insensitive' } } : {}),
        ...(params.entityType ? { entityType: params.entityType } : {}),
        ...(params.actorId ? { actorId: params.actorId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        actor: { select: { id: true, fullName: true, role: true, phoneE164: true } },
      },
    });
  }
}
