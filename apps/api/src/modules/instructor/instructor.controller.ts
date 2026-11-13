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
import { ZodValidationPipe } from '../../core/zod-validation.pipe';
import { InstructorService } from './instructor.service';

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

@ApiTags('Instructor Workspace')
@Controller('instructor')
@UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
@Roles('INSTRUCTOR', 'ADMIN')
export class InstructorController {
  constructor(
    @Inject(InstructorService) private readonly instructorService: InstructorService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Instructor dashboard stats, courses, recent videos, and review feedback' })
  getDashboard(@CurrentUser() user: AuthenticatedContextUser) {
    return this.instructorService.getDashboard(user.id);
  }

  @Get('courses')
  @ApiOperation({ summary: 'List courses owned by current instructor' })
  listCourses(@CurrentUser() user: AuthenticatedContextUser) {
    return this.instructorService.listCourses(user.id);
  }

  @Get('courses/:courseId')
  @ApiOperation({ summary: 'Get full draft/published details of an owned course' })
  getCourseDetail(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
  ) {
    return this.instructorService.getCourseDetail(user.id, courseId);
  }

  @Post('courses')
  @ApiOperation({ summary: 'Create a new draft course (cannot publish directly)' })
  createCourse(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body(new ZodValidationPipe(createCourseSchema)) body: any,
    @Req() req: Request,
  ) {
    return this.instructorService.createCourse(user.id, body, req.ip);
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
    return this.instructorService.updateCourseDraft(user.id, courseId, body, req.ip);
  }

  @Post('courses/:courseId/submit')
  @ApiOperation({ summary: 'Submit owned course draft for admin editorial review' })
  submitForReview(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
    @Req() req: Request,
  ) {
    return this.instructorService.submitCourseForReview(user.id, courseId, req.ip);
  }

  @Post('courses/:courseId/withdraw')
  @ApiOperation({ summary: 'Withdraw owned course from review queue back to draft' })
  withdrawSubmission(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
  ) {
    return this.instructorService.withdrawCourseSubmission(user.id, courseId);
  }

  @Get('courses/:courseId/analytics')
  @ApiOperation({ summary: 'View learner, quiz, playback, and certificate analytics for owned course' })
  getCourseAnalytics(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
  ) {
    return this.instructorService.getCourseAnalytics(user.id, courseId);
  }

  @Get('quizzes')
  @ApiOperation({ summary: 'List quizzes created by current instructor' })
  listQuizzes(@CurrentUser() user: AuthenticatedContextUser) {
    return this.instructorService.listQuizzes(user.id);
  }

  @Post('quizzes')
  @ApiOperation({ summary: 'Create a new quiz with questions' })
  createQuiz(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body(new ZodValidationPipe(createQuizSchema)) body: any,
    @Req() req: Request,
  ) {
    return this.instructorService.createQuiz(user.id, body, req.ip);
  }

  @Patch('quizzes/:quizId')
  @ApiOperation({ summary: 'Update owned quiz and its questions' })
  updateQuiz(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('quizId') quizId: string,
    @Body(new ZodValidationPipe(createQuizSchema)) body: any,
  ) {
    return this.instructorService.updateQuiz(user.id, quizId, body);
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
    return this.instructorService.deleteLessonAttachment(user.id, attachmentId);
  }

  @Get('videos')
  @ApiOperation({ summary: 'List self-hosted video assets uploaded by current instructor' })
  listVideoAssets(@CurrentUser() user: AuthenticatedContextUser) {
    return this.instructorService.listVideoAssets(user.id);
  }
}
