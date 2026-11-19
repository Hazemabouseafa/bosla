import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
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
import { OrganizationsService } from './organizations.service';

@ApiTags('B2B Organizations, Cohorts & Institutional Training')
@Controller('organizations')
@UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
export class OrganizationsController {
  constructor(@Inject(OrganizationsService) private readonly orgs: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'List organizations accessible to the user (B2B managers see all; org admins see own org only)' })
  list(@CurrentUser() user: AuthenticatedContextUser) {
    return this.orgs.listOrganizations(user);
  }

  @Post()
  @RequirePermissions('b2b.manage')
  @ApiOperation({ summary: 'Create a B2B company or university organization' })
  create(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.orgs.createOrganization(actor, body, req.ip);
  }

  @Get(':organizationId/dashboard')
  @ApiOperation({ summary: 'Get isolated organization dashboard, seat usage, cohorts, contracts & impact report' })
  getDashboard(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('organizationId') organizationId: string,
  ) {
    return this.orgs.getOrganizationDashboard(user, organizationId);
  }

  @Post(':organizationId/members')
  @ApiOperation({ summary: 'Assign a member or ORG_ADMIN to an organization within seat capacity' })
  assignMember(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('organizationId') organizationId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.orgs.assignMember(actor, organizationId, body, req.ip);
  }

  @Post(':organizationId/cohorts')
  @ApiOperation({ summary: 'Create a training cohort for an organization' })
  createCohort(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('organizationId') organizationId: string,
    @Body() body: any,
  ) {
    return this.orgs.createCohort(actor, organizationId, body);
  }

  @Post(':organizationId/bulk-enroll')
  @ApiOperation({ summary: 'Bulk enroll organization learners into a course/cohort' })
  bulkEnroll(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('organizationId') organizationId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.orgs.bulkEnrollMembers(actor, organizationId, body, req.ip);
  }

  @Post('contracts')
  @RequirePermissions('b2b.manage')
  @ApiOperation({ summary: 'Create B2B contract/quotation with special discounts & assigned courses' })
  createContract(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.orgs.createContract(actor, body, req.ip);
  }
}
