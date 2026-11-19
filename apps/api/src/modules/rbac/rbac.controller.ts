import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  AuthenticatedContextUser,
  CurrentUser,
  RequirePermissions,
} from '../../core/decorators';
import { CsrfGuard, RolesGuard, SessionAuthGuard } from '../../core/guards';
import { RbacService } from './rbac.service';

@ApiTags('Enterprise RBAC & Audit')
@Controller('rbac')
@UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
export class RbacController {
  constructor(@Inject(RbacService) private readonly rbac: RbacService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get authenticated user effective roles & fine-grained permissions' })
  getMyAccess(@CurrentUser() user: AuthenticatedContextUser) {
    return {
      userId: user.id,
      primaryRole: user.role,
      roles: user.roles,
      permissions: user.permissions,
      sellerId: user.sellerId,
      organizationIds: user.organizationIds,
    };
  }

  @Get('matrix')
  @RequirePermissions('rbac.manage')
  @ApiOperation({ summary: 'Get full role & permission matrix' })
  getMatrix() {
    return this.rbac.getPermissionMatrix();
  }

  @Put('roles/:roleCode/permissions')
  @RequirePermissions('rbac.manage')
  @ApiOperation({ summary: 'Update permission grants for a system role' })
  updateRolePermissions(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('roleCode') roleCode: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.rbac.updateRolePermissions(actor.id, actor.role, roleCode, body, req.ip);
  }

  @Get('users')
  @RequirePermissions('rbac.manage')
  @ApiOperation({ summary: 'List users with multi-role assignments' })
  listUsers(@Query('q') q?: string) {
    return this.rbac.listUsersWithRoles(q);
  }

  @Put('users/:userId/roles')
  @RequirePermissions('rbac.manage')
  @ApiOperation({ summary: 'Assign primary and secondary roles to a user' })
  assignUserRoles(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('userId') userId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.rbac.assignUserRoles(actor.id, actor.role, userId, body, req.ip);
  }

  @Get('audit-logs')
  @RequirePermissions('audit.read')
  @ApiOperation({ summary: 'Inspect immutable administrative & financial audit trail' })
  listAuditLogs(
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('actorId') actorId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.rbac.listAuditLogs({
      action,
      entityType,
      actorId,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
