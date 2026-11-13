import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import * as fsSync from 'node:fs';
import { submitQuizAttemptSchema, updateLessonProgressSchema } from '@bosla/shared';
import { AuthenticatedContextUser, CurrentUser } from '../../core/decorators';
import { CsrfGuard, SessionAuthGuard } from '../../core/guards';
import { ZodValidationPipe } from '../../core/zod-validation.pipe';
import { LearningService } from './learning.service';

@ApiTags('Student Learning Experience')
@Controller('learning')
export class LearningController {
  constructor(@Inject(LearningService) private readonly learning: LearningService) {}

  @Get('dashboard')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Get personalized student learning dashboard' })
  getDashboard(@CurrentUser() user: AuthenticatedContextUser) {
    return this.learning.getStudentDashboard(user.id);
  }

  @Get('courses/:slug/player')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Get authorized course curriculum and student progress for video player' })
  getCoursePlayer(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedContextUser,
  ) {
    return this.learning.getCoursePlayerData(slug, user.id, user.role);
  }

  @Post('lessons/:lessonId/progress')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Persist lesson playback progress to PostgreSQL' })
  saveProgress(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedContextUser,
    @Body(new ZodValidationPipe(updateLessonProgressSchema)) body: any,
  ) {
    return this.learning.saveLessonProgress({
      userId: user.id,
      userRole: user.role,
      lessonId,
      watchedSeconds: body.watchedSeconds,
      durationSeconds: body.durationSeconds,
      isCompleted: body.isCompleted,
    });
  }

  @Post('quizzes/:quizId/attempts')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Submit quiz attempt and calculate score' })
  submitQuiz(
    @Param('quizId') quizId: string,
    @CurrentUser() user: AuthenticatedContextUser,
    @Body(new ZodValidationPipe(submitQuizAttemptSchema)) body: any,
  ) {
    return this.learning.submitQuizAttempt({
      userId: user.id,
      userRole: user.role,
      quizId,
      answers: body.answers,
    });
  }

  @Post('diplomas/assessments/:assessmentId/submit')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Submit diploma assessment or final project' })
  submitDiplomaProject(
    @Param('assessmentId') assessmentId: string,
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: { submissionText: string },
  ) {
    return this.learning.submitDiplomaProject(user.id, assessmentId, body.submissionText);
  }

  @Get('certificates')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'List earned certificates for current student' })
  getCertificates(@CurrentUser() user: AuthenticatedContextUser) {
    return this.learning.getMyCertificates(user.id);
  }

  @Get('certificates/verify/:code')
  @ApiOperation({ summary: 'Publicly verify certificate authenticity by code' })
  verifyCertificate(@Param('code') code: string) {
    return this.learning.verifyCertificateByCode(code);
  }

  @Get('attachments/:attachmentId/download')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Download lesson attachment after backend entitlement verification' })
  async downloadAttachment(
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: AuthenticatedContextUser,
    @Res() res: Response,
  ) {
    const resolved = await this.learning.resolveAttachmentDownload({
      attachmentId,
      userId: user.id,
      userRole: user.role,
    });

    const encodedTitle = encodeURIComponent(resolved.attachment.titleAr);
    res.setHeader('Content-Type', resolved.attachment.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodedTitle}`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (process.env.USE_NGINX_ACCEL === 'true') {
      res.setHeader(
        'X-Accel-Redirect',
        `/_internal_attachments/${resolved.normalizedKey}`,
      );
      res.end();
      return;
    }

    fsSync.createReadStream(resolved.filePath).pipe(res);
  }
}
