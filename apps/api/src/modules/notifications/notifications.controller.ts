import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedContextUser, CurrentUser } from '../../core/decorators';
import { CsrfGuard, SessionAuthGuard } from '../../core/guards';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications & Preferences')
@Controller('notifications')
@UseGuards(SessionAuthGuard)
export class NotificationsController {
  constructor(
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for current user with unread count and cursor pagination' })
  list(
    @CurrentUser() user: AuthenticatedContextUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.notifications.listUserNotifications(
      user.id,
      limit ? Number(limit) : 25,
      cursor || undefined,
    );
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences for current user' })
  getPreferences(@CurrentUser() user: AuthenticatedContextUser) {
    return this.notifications.getPreferences(user.id);
  }

  @Patch('preferences')
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Update notification preferences for current user' })
  updatePreferences(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: unknown,
  ) {
    return this.notifications.updatePreferences(user.id, body);
  }

  @Post('read-all')
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  markAllAsRead(@CurrentUser() user: AuthenticatedContextUser) {
    return this.notifications.markAllAsRead(user.id);
  }

  @Post(':id/read')
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Mark a single notification as read' })
  markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedContextUser,
  ) {
    return this.notifications.markAsRead(user.id, id);
  }
}
