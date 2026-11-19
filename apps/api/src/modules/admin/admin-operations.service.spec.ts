import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AdminOperationsService } from './admin-operations.service';

describe('AdminOperationsService', () => {
  it('creates any role user and normalizes Egyptian phone number', async () => {
    const createMock = vi.fn().mockResolvedValue({
      id: 'u-new',
      fullName: 'أحمد علي',
      phoneE164: '+201099887766',
      email: 'ahmed@example.com',
      role: 'STUDENT',
      status: 'ACTIVE',
    });
    const auditMock = { log: vi.fn().mockResolvedValue(undefined) } as any;
    const prismaMock = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: createMock,
      },
    } as any;

    const svc = new AdminOperationsService(prismaMock, auditMock);
    const created = await svc.createUserAccount('admin-1', {
      fullName: 'أحمد علي',
      phoneNumber: '01099887766',
      countryCode: '+20',
      email: 'ahmed@example.com',
      password: 'Password#2026',
      role: 'STUDENT',
      status: 'ACTIVE',
    });

    expect(created.phoneE164).toBe('+201099887766');
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_USER_CREATED', entityId: 'u-new' }),
    );
  });

  it('rejects duplicate phone when creating a user', async () => {
    const prismaMock = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'existing-user' }),
      },
    } as any;
    const svc = new AdminOperationsService(prismaMock, { log: vi.fn() } as any);

    await expect(
      svc.createUserAccount('admin-1', {
        fullName: 'أحمد علي',
        phoneNumber: '01099887766',
        countryCode: '+20',
        password: 'Password#2026',
        role: 'STUDENT',
        status: 'ACTIVE',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('revokes sessions and resets lockout on password change', async () => {
    const userUpdate = vi.fn().mockResolvedValue({ id: 'u-1', fullName: 'طالب', status: 'ACTIVE' });
    const sessionUpdateMany = vi.fn().mockResolvedValue({ count: 2 });
    const auditLog = vi.fn().mockResolvedValue(undefined);
    const prismaMock = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'u-1',
          phoneE164: '+201011112222',
          email: null,
        }),
        update: userUpdate,
      },
      session: {
        updateMany: sessionUpdateMany,
      },
    } as any;

    const svc = new AdminOperationsService(prismaMock, { log: auditLog } as any);
    await svc.updateUserProfile('admin-1', 'u-1', {
      fullName: 'طالب محدث',
      status: 'ACTIVE',
      newPassword: 'NewStrongPassword#99',
    });

    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      }),
    );
    expect(sessionUpdateMany).toHaveBeenCalledTimes(1);
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_USER_PROFILE_AND_PASSWORD_UPDATED' }),
    );
  });

  it('grants subscription using plan currentRevisionId and custom duration', async () => {
    const subCreate = vi.fn().mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      userId: 'u-1',
      planId: 'plan-1',
    });
    const prismaMock = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'u-1' }) },
      membershipPlan: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'plan-1',
          interval: 'MONTHLY',
          currentRevisionId: 'rev-1',
          revisions: [],
        }),
      },
      subscription: { create: subCreate },
    } as any;
    const svc = new AdminOperationsService(prismaMock, { log: vi.fn() } as any);

    const result = await svc.grantSubscription('admin-1', {
      userId: 'u-1',
      planId: 'plan-1',
      durationDays: 90,
    });

    expect(result.id).toBe('sub-1');
    const createdArgs = subCreate.mock.calls[0]?.[0]?.data;
    const diffDays = Math.round(
      (createdArgs.currentPeriodEnd.getTime() - createdArgs.currentPeriodStart.getTime()) /
        (24 * 60 * 60 * 1000),
    );
    expect(diffDays).toBe(90);
  });

  it('validates target entity on manual certificate issuance and handles missing user', async () => {
    const prismaMock = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
    } as any;
    const svc = new AdminOperationsService(prismaMock, { log: vi.fn() } as any);

    await expect(
      svc.issueCertificate('admin-1', { userId: 'missing', targetType: 'COURSE', courseId: 'c1' }),
    ).rejects.toThrow(NotFoundException);

    const prismaCourseMissingId = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'u1', fullName: 'طالب' }) },
    } as any;
    const svc2 = new AdminOperationsService(prismaCourseMissingId, { log: vi.fn() } as any);
    await expect(
      svc2.issueCertificate('admin-1', { userId: 'u1', targetType: 'COURSE' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('broadcasts notifications in batch to targeted students', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const prismaMock = {
      user: { findMany: vi.fn().mockResolvedValue([{ id: 's1' }, { id: 's2' }]) },
      notification: { createMany },
    } as any;
    const svc = new AdminOperationsService(prismaMock, { log: vi.fn() } as any);

    const res = await svc.broadcastNotification('admin-1', {
      audience: 'STUDENTS',
      titleAr: 'دورة جديدة متاحة',
      bodyAr: 'تم إضافة مسار تدريبي جديد لجميع المشتركين.',
      actionUrl: 'courses',
    });

    expect(res.recipientsCount).toBe(2);
    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: expect.arrayContaining([
          expect.objectContaining({ userId: 's1', actionUrl: '/courses' }),
          expect.objectContaining({ userId: 's2', actionUrl: '/courses' }),
        ]),
      }),
    );
  });
});
