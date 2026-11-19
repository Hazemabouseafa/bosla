import type { UserRole } from '@bosla/db';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_CODES,
  ROLE_METADATA,
  type PermissionCode,
  type SystemRoleCode,
} from '@bosla/shared';
import type { PrismaService } from './prisma.service';

export interface ResolvedUserAccess {
  roles: SystemRoleCode[];
  permissions: PermissionCode[];
  sellerId: string | null;
  organizationIds: string[];
}

const VALID_PERMS = new Set<string>(PERMISSION_CODES);

export async function resolveUserAccess(
  prisma: PrismaService,
  userId: string,
  primaryRole: UserRole,
): Promise<ResolvedUserAccess> {
  const [assignments, seller, orgMemberships] = await Promise.all([
    prisma.userRoleAssignment?.findMany
      ? prisma.userRoleAssignment.findMany({
          where: { userId },
          include: { role: { select: { code: true } } },
        })
      : Promise.resolve([]),
    prisma.seller?.findUnique
      ? prisma.seller.findUnique({
          where: { userId },
          select: { id: true, status: true },
        })
      : Promise.resolve(null),
    prisma.organizationMember?.findMany
      ? prisma.organizationMember.findMany({
          where: { userId },
          select: { organizationId: true, orgRole: true },
        })
      : Promise.resolve([]),
  ]);

  const roleSet = new Set<SystemRoleCode>([primaryRole as SystemRoleCode]);
  for (const a of assignments) {
    roleSet.add(a.role.code as SystemRoleCode);
  }
  if (seller && seller.status === 'APPROVED') {
    roleSet.add('AFFILIATE_SELLER');
  }

  const roles = Array.from(roleSet);
  const permSet = new Set<PermissionCode>();

  if (roleSet.has('SUPER_ADMIN') || roleSet.has('ADMIN')) {
    for (const p of PERMISSION_CODES) {
      permSet.add(p);
    }
  } else {
    const dbRoleDefs = prisma.roleDefinition?.findMany
      ? await prisma.roleDefinition.findMany({
          where: { code: { in: roles as UserRole[] } },
          include: {
            permissions: {
              include: { permission: { select: { code: true } } },
            },
          },
        })
      : [];
    const dbByCode = new Map(dbRoleDefs.map((r) => [r.code as SystemRoleCode, r]));

    for (const roleCode of roles) {
      const dbRole = dbByCode.get(roleCode);
      if (dbRole && dbRole.permissions.length > 0) {
        for (const rp of dbRole.permissions) {
          if (VALID_PERMS.has(rp.permission.code)) {
            permSet.add(rp.permission.code as PermissionCode);
          }
        }
      } else {
        for (const p of DEFAULT_ROLE_PERMISSIONS[roleCode] ?? []) {
          permSet.add(p);
        }
      }
    }
  }

  if (orgMemberships.some((m) => m.orgRole === 'ORG_ADMIN')) {
    permSet.add('b2b.org_admin');
  }

  return {
    roles,
    permissions: Array.from(permSet),
    sellerId: seller?.id ?? null,
    organizationIds: orgMemberships.map((m) => m.organizationId),
  };
}

export function roleMatchesRequired(
  userRoles: readonly SystemRoleCode[],
  requiredRoles: readonly UserRole[],
): boolean {
  if (!requiredRoles.length) return true;
  const set = new Set<string>(userRoles);
  if (set.has('SUPER_ADMIN') || set.has('ADMIN')) {
    set.add('ADMIN');
    set.add('SUPER_ADMIN');
  }
  return requiredRoles.some((r) => set.has(r));
}

export async function syncUserRoleAssignmentsAndProvision(
  prisma: PrismaService,
  params: {
    userId: string;
    primaryRole: UserRole;
    extraRoles?: readonly UserRole[];
    assignedById?: string | null;
  },
): Promise<void> {
  if (!prisma.roleDefinition?.upsert || !prisma.userRoleAssignment?.deleteMany) {
    return;
  }

  const combined = Array.from(
    new Set<UserRole>([params.primaryRole, ...(params.extraRoles || [])]),
  );

  const roleIds: string[] = [];
  for (const roleCode of combined) {
    const meta = ROLE_METADATA[roleCode as SystemRoleCode] || {
      nameAr: roleCode,
      descriptionAr: roleCode,
    };
    const rd = await prisma.roleDefinition.upsert({
      where: { code: roleCode },
      update: {},
      create: {
        code: roleCode,
        nameAr: meta.nameAr,
        descriptionAr: meta.descriptionAr,
        isSystem: true,
      },
    });
    roleIds.push(rd.id);
  }

  await prisma.userRoleAssignment.deleteMany({ where: { userId: params.userId } });
  if (roleIds.length > 0) {
    await prisma.userRoleAssignment.createMany({
      data: roleIds.map((roleId) => ({
        userId: params.userId,
        roleId,
        assignedById: params.assignedById ?? null,
      })),
      skipDuplicates: true,
    });
  }

  // If AFFILIATE_SELLER is assigned, automatically provision an APPROVED Seller profile & code
  if (combined.includes('AFFILIATE_SELLER') && prisma.seller?.findUnique) {
    const user = await prisma.user.findUnique({ where: { id: params.userId } });
    if (user) {
      let seller = await prisma.seller.findUnique({
        where: { userId: user.id },
        include: { codes: true },
      });
      if (!seller) {
        seller = await prisma.seller.create({
          data: {
            userId: user.id,
            status: 'APPROVED',
            fullName: user.fullName,
            phoneE164: user.phoneE164 || '+201000000000',
            email: user.email,
            nationalIdNumber: 'AUTO-ADMIN-ASSIGNED',
            idDocumentUrl: '/uploads/admin-verified-kyc.pdf',
            experienceSummaryAr: 'تم تعيين وتوثيق حساب البائع مباشرة من قبل الإدارة العليا',
            payoutMethodType: 'BANK_TRANSFER',
            payoutAccountName: user.fullName,
            payoutAccountDetails: 'معتمد إدارياً',
            kycVerified: true,
            payoutVerified: true,
            verifiedById: params.assignedById ?? null,
            verifiedAt: new Date(),
          },
          include: { codes: true },
        });
      } else if (seller.status !== 'APPROVED') {
        seller = await prisma.seller.update({
          where: { id: seller.id },
          data: {
            status: 'APPROVED',
            kycVerified: true,
            payoutVerified: true,
            verifiedById: params.assignedById ?? seller.verifiedById,
            verifiedAt: seller.verifiedAt ?? new Date(),
          },
          include: { codes: true },
        });
      }

      if (seller.codes.length === 0) {
        const suffix = user.id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase().padEnd(5, '0');
        const autoCode = `SLR${suffix}`;
        await prisma.sellerCode
          .upsert({
            where: { code: autoCode },
            update: { isActive: true },
            create: {
              sellerId: seller.id,
              code: autoCode,
              isActive: true,
            },
          })
          .catch(() => {});
      }
    }
  }
}
