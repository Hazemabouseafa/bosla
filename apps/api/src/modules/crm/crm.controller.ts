import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
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
  SkipCsrf,
} from '../../core/decorators';
import {
  CsrfGuard,
  OptionalSessionAuthGuard,
  RolesGuard,
  SessionAuthGuard,
} from '../../core/guards';
import { CrmService } from './crm.service';

@ApiTags('Internal CRM & Marketing Campaigns')
@Controller('crm')
export class CrmController {
  constructor(@Inject(CrmService) private readonly crm: CrmService) {}

  @Post('public/leads')
  @SkipCsrf()
  @UseGuards(OptionalSessionAuthGuard)
  @ApiOperation({ summary: 'Capture public/landing lead with duplicate detection' })
  capturePublicLead(
    @CurrentUser() user: AuthenticatedContextUser | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.crm.createLead(user, body, req.ip);
  }

  @Get('pipeline-stages')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @RequirePermissions('crm.manage')
  listStages() {
    return this.crm.listPipelineStages();
  }

  @Post('pipeline-stages')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('crm.manage')
  upsertStage(@Body() body: any) {
    return this.crm.upsertPipelineStage(body);
  }

  @Get('leads')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @RequirePermissions('crm.manage')
  listLeads(
    @Query('stage') stage?: string,
    @Query('priority') priority?: string,
    @Query('type') type?: string,
    @Query('courseId') courseId?: string,
    @Query('campaignId') campaignId?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('consentOnly') consentOnly?: string,
    @Query('q') q?: string,
  ) {
    return this.crm.listLeads({
      stage,
      priority,
      type,
      courseId,
      campaignId,
      assignedToId,
      consentOnly: consentOnly === 'true',
      q,
    });
  }

  @Post('leads')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('crm.manage')
  createLead(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.crm.createLead(actor, body, req.ip);
  }

  @Patch('leads/:leadId')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('crm.manage')
  @ApiOperation({ summary: 'Update lead details, pipeline stage, priority, assignee, or notes' })
  updateLead(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('leadId') leadId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.crm.updateLead(actor, leadId, body, req.ip);
  }

  @Delete('leads/:leadId')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('crm.manage')
  @ApiOperation({ summary: 'Delete a CRM lead record with audit logging' })
  deleteLead(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('leadId') leadId: string,
    @Req() req: Request,
  ) {
    return this.crm.deleteLead(actor, leadId, req.ip);
  }

  @Post('leads/:leadId/activities')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('crm.manage')
  addActivity(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('leadId') leadId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.crm.addLeadActivity(actor, leadId, body, req.ip);
  }

  @Patch('activities/:activityId/complete')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('crm.manage')
  @ApiOperation({ summary: 'Mark a scheduled follow-up reminder as completed' })
  completeActivity(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('activityId') activityId: string,
    @Req() req: Request,
  ) {
    return this.crm.completeFollowUpActivity(actor, activityId, req.ip);
  }

  @Get('campaigns')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @RequirePermissions('crm.manage')
  listCampaigns() {
    return this.crm.listCampaignsWithMetrics();
  }

  @Post('campaigns')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('crm.manage')
  createCampaign(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.crm.createCampaign(actor, body, req.ip);
  }

  @Patch('campaigns/:campaignId')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('crm.manage')
  @ApiOperation({ summary: 'Update campaign spend, budget, linked coupon, or notes' })
  updateCampaign(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('campaignId') campaignId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.crm.updateCampaign(actor, campaignId, body, req.ip);
  }
}
