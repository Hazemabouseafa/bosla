import {
  Body,
  Controller,
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
} from '../../core/decorators';
import { CsrfGuard, RolesGuard, SessionAuthGuard } from '../../core/guards';
import { SupportService } from './support.service';

@ApiTags('Support Ticketing & Executive Analytics')
@Controller('support')
@UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
export class SupportController {
  constructor(@Inject(SupportService) private readonly support: SupportService) {}

  @Get('tickets')
  @ApiOperation({ summary: 'List support tickets (students see own public replies; staff sees all + internal notes)' })
  listTickets(
    @CurrentUser() user: AuthenticatedContextUser,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('mineOnly') mineOnly?: string,
  ) {
    return this.support.listTickets(user, { status, priority, mineOnly: mineOnly === 'true' });
  }

  @Post('tickets')
  @ApiOperation({ summary: 'Open a new support ticket' })
  createTicket(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.support.createTicket(user, body, req.ip);
  }

  @Post('tickets/:ticketId/replies')
  @ApiOperation({ summary: 'Post a reply or (staff-only) internal note to a support ticket' })
  reply(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.support.replyToTicket(user, ticketId, body, req.ip);
  }

  @Patch('tickets/:ticketId')
  @RequirePermissions('support.manage')
  @ApiOperation({ summary: 'Update ticket status, priority, SLA, or assignee (Support/Admin only)' })
  updateTicket(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.support.updateTicket(actor, ticketId, body, req.ip);
  }

  @Post('tickets/:ticketId/satisfaction')
  @ApiOperation({ summary: 'Submit 1-5 CSAT rating for a support ticket' })
  rateSatisfaction(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
  ) {
    return this.support.submitSatisfactionRating(user, ticketId, body);
  }

  @Get('analytics/executive')
  @RequirePermissions('audit.read')
  @ApiOperation({ summary: 'Get real Postgres-backed Daily/Monthly/Annual Executive KPIs' })
  getExecutiveAnalytics() {
    return this.support.getExecutiveAnalytics();
  }
}
