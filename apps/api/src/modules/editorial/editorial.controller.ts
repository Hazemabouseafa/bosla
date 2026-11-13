import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { EditorialStatus } from '@bosla/db';
import { editorialReviewDecisionSchema, schedulePublishSchema } from '@bosla/shared';
import { AuthenticatedContextUser, CurrentUser, Roles } from '../../core/decorators';
import { CsrfGuard, RolesGuard, SessionAuthGuard } from '../../core/guards';
import { ZodValidationPipe } from '../../core/zod-validation.pipe';
import { EditorialService } from './editorial.service';

@ApiTags('Admin Editorial & Publishing')
@Controller('admin/editorial')
@UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
@Roles('ADMIN')
export class EditorialController {
  constructor(@Inject(EditorialService) private readonly editorial: EditorialService) {}

  @Get('queue')
  @ApiOperation({ summary: 'List course versions awaiting review or approved for publishing' })
  getQueue(@Query('status') status?: EditorialStatus) {
    return this.editorial.getReviewQueue(status);
  }

  @Post('versions/:versionId/review')
  @ApiOperation({ summary: 'Approve or request changes on an instructor course submission' })
  reviewVersion(
    @Param('versionId') versionId: string,
    @CurrentUser() admin: AuthenticatedContextUser,
    @Body(new ZodValidationPipe(editorialReviewDecisionSchema)) body: any,
  ) {
    return this.editorial.reviewVersion({
      versionId,
      adminId: admin.id,
      decision: body.decision,
      comment: body.comment,
    });
  }

  @Post('versions/:versionId/publish')
  @ApiOperation({ summary: 'Explicitly publish an APPROVED course revision' })
  publishVersion(
    @Param('versionId') versionId: string,
    @CurrentUser() admin: AuthenticatedContextUser,
  ) {
    return this.editorial.publishVersion({ versionId, adminId: admin.id });
  }

  @Post('courses/:courseId/unpublish')
  @ApiOperation({ summary: 'Unpublish a live course' })
  unpublishCourse(
    @Param('courseId') courseId: string,
    @CurrentUser() admin: AuthenticatedContextUser,
    @Body() body: { reason?: string },
  ) {
    return this.editorial.unpublishCourse(courseId, admin.id, body?.reason);
  }

  @Post('courses/:courseId/schedule')
  @ApiOperation({ summary: 'Schedule publication timestamp for an approved course' })
  scheduleCourse(
    @Param('courseId') courseId: string,
    @CurrentUser() admin: AuthenticatedContextUser,
    @Body(new ZodValidationPipe(schedulePublishSchema)) body: any,
  ) {
    return this.editorial.scheduleCoursePublication(
      courseId,
      admin.id,
      new Date(body.scheduledPublishAt),
    );
  }
}
