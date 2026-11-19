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
import type { OfflineEventStatus } from '@bosla/db';
import { AuthenticatedContextUser, CurrentUser, Roles } from '../../core/decorators';
import {
  CsrfGuard,
  OptionalSessionAuthGuard,
  RolesGuard,
  SessionAuthGuard,
} from '../../core/guards';
import { EventsService } from './events.service';

@ApiTags('Offline Events & Paymob Ticketing')
@Controller('events')
export class EventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'List public published offline courses and field events' })
  listPublic(@Query('city') city?: string, @Query('search') search?: string) {
    return this.events.listPublicEvents({ city, search });
  }

  @Get('my/registrations')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'List offline event tickets registered by authenticated user' })
  myRegistrations(@CurrentUser() user: AuthenticatedContextUser) {
    return this.events.listMyRegistrations(user.id);
  }

  @Get(':slug')
  @UseGuards(OptionalSessionAuthGuard)
  @ApiOperation({ summary: 'Get offline event details by slug and current user booking if authenticated' })
  getBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user?: AuthenticatedContextUser,
  ) {
    return this.events.getPublicEventBySlug(slug, user?.id);
  }

  @Post(':eventId/checkout')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Initialize Paymob checkout for standalone offline event ticket booking' })
  checkoutEvent(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('eventId') eventId: string,
    @Body() body: unknown,
  ) {
    return this.events.initiateEventCheckout(user.id, eventId, body);
  }
}

@ApiTags('Admin Offline Events Control (ADMIN ONLY)')
@Controller('admin/events')
@UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
@Roles('ADMIN')
export class AdminEventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'List all offline events and ticket revenue metrics (Admin only)' })
  listAll() {
    return this.events.listEventsForAdmin();
  }

  @Post()
  @ApiOperation({ summary: 'Create new offline course/event with standalone price (Admin only)' })
  createEvent(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.events.createEventByAdmin(admin.id, body, req.ip);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update offline course/event (Admin only)' })
  updateEvent(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.events.updateEventByAdmin(admin.id, id, body, req.ip);
  }

  @Post(':id/status')
  @ApiOperation({ summary: 'Change offline event editorial/booking status (Admin only)' })
  setStatus(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('id') id: string,
    @Body() body: { status: OfflineEventStatus },
    @Req() req: Request,
  ) {
    return this.events.setEventStatusByAdmin(admin.id, id, body.status, req.ip);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete offline event without confirmed bookings (Admin only)' })
  deleteEvent(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.events.deleteEventByAdmin(admin.id, id, req.ip);
  }

  @Get(':id/registrations')
  @ApiOperation({ summary: 'List attendees and Paymob payment status for an offline event (Admin only)' })
  listRegistrations(@Param('id') id: string) {
    return this.events.listEventRegistrationsForAdmin(id);
  }

  @Patch('registrations/:regId')
  @ApiOperation({ summary: 'Check-in attendee or update event registration status (Admin only)' })
  updateRegistrationStatus(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('regId') regId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.events.updateRegistrationStatusByAdmin(admin.id, regId, body, req.ip);
  }
}
