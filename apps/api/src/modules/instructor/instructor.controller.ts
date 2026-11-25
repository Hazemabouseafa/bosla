import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  createCourseSchema,
  createQuizSchema,
  updateCourseVersionSchema,
} from '@bosla/shared';
import {
  AuthenticatedContextUser,
  CurrentUser,
  Roles,
} from '../../core/decorators';
import { CsrfGuard, RolesGuard, SessionAuthGuard } from '../../core/guards';
import { resolveEffectiveRoleForLegacyCheck } from '../../core/rbac-resolver';
import { ZodValidationPipe } from '../../core/zod-validation.pipe';
import { InstructorService } from './instructor.service';
import { RecommendationsService } from '../learning/recommendations.service';

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

@ApiTags('Instructor Workspace')
@Controller('instructor')
@UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
@Roles('INSTRUCTOR', 'ADMIN')
export class InstructorController {
  constructor(
    @Inject(InstructorService) private readonly instructorService: InstructorService,
    @Inject(RecommendationsService)
    private readonly recommendations: RecommendationsService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Instructor dashboard stats, courses, recent videos, and review feedback' })
  getDashboard(@CurrentUser() user: AuthenticatedContextUser) {
    return this.instructorService.getDashboard(user.id, user.role, user.roles);
  }

  @Get('courses')
  @ApiOperation({ summary: 'List courses owned by current instructor' })
  listCourses(@CurrentUser() user: AuthenticatedContextUser) {
    return this.instructorService.listCourses(user.id, user.role, user.roles);
  }

  @Get('courses/:courseId')
  @ApiOperation({ summary: 'Get full draft/published details of an owned course' })
  getCourseDetail(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
  ) {
    return this.instructorService.getCourseDetail(user.id, courseId, user.role, user.roles);
  }

  @Post('courses')
  @ApiOperation({ summary: 'Create a new draft course (cannot publish directly)' })
  createCourse(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body(new ZodValidationPipe(createCourseSchema)) body: any,
    @Req() req: Request,
  ) {
    return this.instructorService.createCourse(
      user.id,
      body,
      req.ip,
      resolveEffectiveRoleForLegacyCheck(user),
    );
  }

  @Patch('courses/:courseId/draft')
  @ApiOperation({
    summary:
      'Update owned course draft version (clones new draft version automatically if editing a live published course)',
  })
  updateCourseDraft(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
    @Body(new ZodValidationPipe(updateCourseVersionSchema)) body: any,
    @Req() req: Request,
  ) {
    return this.instructorService.updateCourseDraft(
      user.id,
      courseId,
      body,
      req.ip,
      user.role,
      user.roles,
    );
  }

  @Put('courses/:courseId')
  @ApiOperation({ summary: 'Update owned course draft metadata from 4-step course wizard' })
  updateCourseMetadata(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    return this.instructorService.updateCourseDraft(
      user.id,
      courseId,
      {
        ...body,
        introVideoId: body?.introVideoId ?? body?.introVideoAssetId ?? undefined,
      },
      req.ip,
      user.role,
      user.roles,
    );
  }

  @Post('courses/:courseId/sections')
  @ApiOperation({ summary: 'Add a section to course draft version' })
  addDraftSection(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
    @Body() body: { titleAr: string; descriptionAr?: string; sortOrder?: number },
  ) {
    return this.instructorService.addDraftSection(
      user.id,
      courseId,
      body,
      user.role,
      user.roles,
    );
  }

  @Delete('courses/:courseId/sections/:sectionId')
  @ApiOperation({ summary: 'Delete a section from course draft version' })
  deleteDraftSection(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
    @Param('sectionId') sectionId: string,
  ) {
    return this.instructorService.deleteDraftSection(
      user.id,
      courseId,
      sectionId,
      user.role,
      user.roles,
    );
  }

  @Post('courses/:courseId/sections/:sectionId/lessons')
  @ApiOperation({ summary: 'Add a lesson to a section in course draft version' })
  addDraftLesson(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
    @Param('sectionId') sectionId: string,
    @Body() body: any,
  ) {
    return this.instructorService.addDraftLesson(
      user.id,
      courseId,
      sectionId,
      body,
      user.role,
      user.roles,
    );
  }

  @Put('courses/:courseId/lessons/:lessonId')
  @ApiOperation({ summary: 'Update a single lesson in course draft version' })
  updateDraftLesson(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @Body() body: any,
  ) {
    return this.instructorService.updateDraftLesson(
      user.id,
      courseId,
      lessonId,
      body,
      user.role,
      user.roles,
    );
  }

  @Delete('courses/:courseId/lessons/:lessonId')
  @ApiOperation({ summary: 'Delete a lesson from course draft version' })
  deleteDraftLesson(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.instructorService.deleteDraftLesson(
      user.id,
      courseId,
      lessonId,
      user.role,
      user.roles,
    );
  }

  @Put('courses/:courseId/sections/:sectionId/lessons/reorder')
  @ApiOperation({ summary: 'Reorder lessons inside a draft section' })
  reorderDraftLessons(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
    @Param('sectionId') sectionId: string,
    @Body() body: { lessonIds: string[] },
  ) {
    return this.instructorService.reorderDraftLessons(
      user.id,
      courseId,
      sectionId,
      body?.lessonIds ?? [],
      user.role,
      user.roles,
    );
  }

  @Patch('courses/:courseId/lessons/bulk-preview')
  @ApiOperation({ summary: 'Bulk update free-preview vs locked status across all lessons in a course' })
  bulkUpdateLessonPreview(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
    @Body() body: { mode: 'LOCK_ALL' | 'UNLOCK_FIRST_LESSON' | 'UNLOCK_ALL' | 'CUSTOM'; freeLessonIds?: string[] },
    @Req() req: Request,
  ) {
    return this.instructorService.bulkUpdateLessonPreview({
      instructorId: user.id,
      courseId,
      mode: body?.mode || 'LOCK_ALL',
      freeLessonIds: body?.freeLessonIds,
      userRole: user.role,
      userRoles: user.roles,
      ip: req.ip,
    });
  }

  @Post('courses/:courseId/submit')
  @ApiOperation({ summary: 'Submit owned course draft for admin editorial review' })
  submitForReview(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
    @Req() req: Request,
  ) {
    return this.instructorService.submitCourseForReview(
      user.id,
      courseId,
      req.ip,
      user.role,
      user.roles,
    );
  }

  @Post('courses/:courseId/withdraw')
  @ApiOperation({ summary: 'Withdraw owned course from review queue back to draft' })
  withdrawSubmission(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
  ) {
    return this.instructorService.withdrawCourseSubmission(
      user.id,
      courseId,
      user.role,
      user.roles,
    );
  }

  @Get('courses/:courseId/analytics')
  @ApiOperation({ summary: 'View learner, quiz, playback, and certificate analytics for owned course' })
  getCourseAnalytics(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
  ) {
    return this.instructorService.getCourseAnalytics(user.id, courseId, user.role, user.roles);
  }

  @Get('quizzes')
  @ApiOperation({ summary: 'List quizzes created by current instructor' })
  listQuizzes(@CurrentUser() user: AuthenticatedContextUser) {
    return this.instructorService.listQuizzes(user.id, user.role, user.roles);
  }

  @Post('quizzes')
  @ApiOperation({ summary: 'Create a new quiz with questions' })
  createQuiz(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body(new ZodValidationPipe(createQuizSchema)) body: any,
    @Req() req: Request,
  ) {
    return this.instructorService.createQuiz(
      user.id,
      body,
      req.ip,
      resolveEffectiveRoleForLegacyCheck(user),
    );
  }

  @Patch('quizzes/:quizId')
  @ApiOperation({ summary: 'Update owned quiz and its questions' })
  updateQuiz(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('quizId') quizId: string,
    @Body(new ZodValidationPipe(createQuizSchema)) body: any,
  ) {
    return this.instructorService.updateQuiz(user.id, quizId, body, user.role, user.roles);
  }

  @Post('lessons/:lessonId/attachments')
  @ApiOperation({ summary: 'Upload lesson attachment (raw binary or JSON base64) to protected VPS storage' })
  async uploadLessonAttachment(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('lessonId') lessonId: string,
    @Query('titleAr') titleArQuery: string | undefined,
    @Query('filename') filenameQuery: string | undefined,
    @Headers('x-title-ar') titleArHeader: string | undefined,
    @Headers('x-file-name') filenameHeader: string | undefined,
    @Headers('content-type') contentType: string | undefined,
    @Req() req: Request,
  ) {
    const safeDecode = (val?: string) => {
      if (!val) return '';
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    };

    if (
      contentType?.includes('application/json') &&
      req.body &&
      typeof req.body === 'object' &&
      !Buffer.isBuffer(req.body) &&
      typeof (req.body as any).base64Data === 'string'
    ) {
      const payload = req.body as {
        titleAr?: string;
        filename?: string;
        mimeType?: string;
        base64Data: string;
      };
      const buf = Buffer.from(payload.base64Data, 'base64');
      if (buf.byteLength === 0 || buf.byteLength > MAX_ATTACHMENT_BYTES) {
        throw new BadRequestException('حجم المرفق غير صالح (الحد الأقصى 25 ميجابايت)');
      }
      return this.instructorService.uploadLessonAttachment({
        instructorId: user.id,
        userRole: user.role,
        userRoles: user.roles,
        lessonId,
        titleAr: payload.titleAr ?? payload.filename ?? 'مرفق تعليمي',
        originalName: payload.filename ?? 'attachment.bin',
        mimeType: payload.mimeType ?? 'application/octet-stream',
        buffer: buf,
      });
    }

    const chunks: Buffer[] = [];
    let total = 0;
    await new Promise<void>((resolve, reject) => {
      if (Buffer.isBuffer(req.body)) {
        total = req.body.byteLength;
        chunks.push(req.body);
        resolve();
        return;
      }
      req.on('data', (chunk: Buffer) => {
        total += chunk.byteLength;
        if (total > MAX_ATTACHMENT_BYTES) {
          reject(new BadRequestException('يتجاوز حجم المرفق الحد الأقصى (25 ميجابايت)'));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => resolve());
      req.on('error', reject);
    });

    const buffer = Buffer.concat(chunks);
    if (buffer.byteLength === 0) {
      throw new BadRequestException('الملف فارغ');
    }

    const filename =
      safeDecode(filenameHeader) || safeDecode(filenameQuery) || 'attachment.pdf';
    const titleAr = safeDecode(titleArHeader) || safeDecode(titleArQuery) || filename;

    return this.instructorService.uploadLessonAttachment({
      instructorId: user.id,
      userRole: user.role,
      userRoles: user.roles,
      lessonId,
      titleAr,
      originalName: filename,
      mimeType: contentType?.split(';')[0]?.trim() || 'application/octet-stream',
      buffer,
    });
  }

  @Delete('attachments/:attachmentId')
  @ApiOperation({ summary: 'Delete lesson attachment owned by current instructor' })
  deleteAttachment(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.instructorService.deleteLessonAttachment(
      user.id,
      attachmentId,
      user.role,
      user.roles,
    );
  }

  @Patch('attachments/:attachmentId/download-policy')
  @ApiOperation({ summary: 'Enable or disable learner download permission for a lesson attachment' })
  updateAttachmentDownloadPolicy(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('attachmentId') attachmentId: string,
    @Body() body: unknown,
  ) {
    return this.instructorService.updateAttachmentDownloadPolicy(
      user.id,
      attachmentId,
      body,
      user.role,
      user.roles,
    );
  }

  @Get('videos')
  @ApiOperation({ summary: 'List self-hosted video assets uploaded by current instructor' })
  listVideoAssets(@CurrentUser() user: AuthenticatedContextUser) {
    return this.instructorService.listVideoAssets(user.id, user.role, user.roles);
  }

  @Get('finance/statement')
  @ApiOperation({ summary: 'Get independent instructor financial account statement, payouts, and revenue share assignments' })
  getFinancialStatement(@CurrentUser() user: AuthenticatedContextUser) {
    return this.instructorService.getFinancialStatement(user.id);
  }

  @Get('competency-requests')
  @ApiOperation({ summary: 'List competency certificate requests for courses/programs assigned to this instructor' })
  listCompetencyRequests(@CurrentUser() user: AuthenticatedContextUser) {
    return this.instructorService.listCompetencyRequests(user.id, user.role, user.roles);
  }

  @Post('competency-requests/:id/review')
  @ApiOperation({ summary: 'Approve or reject a competency certificate request (Assigned Instructor or Admin)' })
  reviewCompetencyRequest(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.instructorService.reviewCompetencyRequest(
      user.id,
      user.role,
      id,
      body,
      user.roles,
    );
  }

  // ---- Recommendation Letters (Assigned Instructor Only) ----
  @Get('recommendations')
  @ApiOperation({ summary: 'List recommendation letter requests assigned to this instructor' })
  listRecommendations(@CurrentUser() user: AuthenticatedContextUser) {
    return this.recommendations.listForInstructor(user.id);
  }

  @Patch('recommendations/:id')
  @ApiOperation({ summary: 'Save instructor draft edits for a student recommendation letter' })
  saveRecommendationDraft(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.recommendations.saveInstructorDraft(user.id, id, body, req.ip);
  }

  @Post('recommendations/:id/approve')
  @ApiOperation({ summary: 'Approve and finalize a recommendation letter (creates immutable snapshot)' })
  approveRecommendation(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.recommendations.approveByInstructor(user.id, id, body, req.ip);
  }

  @Post('recommendations/:id/reject')
  @ApiOperation({ summary: 'Reject a recommendation request with required reason/notes' })
  rejectRecommendation(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.recommendations.rejectByInstructor(user.id, id, body, req.ip);
  }
}
