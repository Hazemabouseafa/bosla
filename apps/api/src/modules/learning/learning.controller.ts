import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import * as fsSync from 'node:fs';
import { submitDiplomaProjectSchema, submitQuizAttemptSchema, updateLessonProgressSchema } from '@bosla/shared';
import { AuthenticatedContextUser, CurrentUser } from '../../core/decorators';
import { CsrfGuard, OptionalSessionAuthGuard, SessionAuthGuard } from '../../core/guards';
import { resolveEffectiveRoleForLegacyCheck } from '../../core/rbac-resolver';
import { ZodValidationPipe } from '../../core/zod-validation.pipe';
import { LearningService } from './learning.service';
import { RecommendationsService } from './recommendations.service';

@ApiTags('Student Learning Experience')
@Controller('learning')
export class LearningController {
  constructor(
    @Inject(LearningService) private readonly learning: LearningService,
    @Inject(RecommendationsService)
    private readonly recommendations: RecommendationsService,
  ) {}

  @Get('dashboard')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Get personalized student learning dashboard' })
  getDashboard(@CurrentUser() user: AuthenticatedContextUser) {
    return this.learning.getStudentDashboard(user.id);
  }

  @Get('courses/:slug/player')
  @UseGuards(OptionalSessionAuthGuard)
  @ApiOperation({ summary: 'Get authorized course curriculum and student progress for video player' })
  getCoursePlayer(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedContextUser | undefined,
  ) {
    return this.learning.getCoursePlayerData(
      slug,
      user?.id ?? null,
      user?.role ?? null,
      user?.roles,
    );
  }

  @Post('courses/:courseId/enroll')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Enroll/start a course after validating membership or course access' })
  enrollCourse(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedContextUser,
  ) {
    return this.learning.enrollInCourse({
      userId: user.id,
      userRole: resolveEffectiveRoleForLegacyCheck(user),
      courseId,
      source: 'PLAYER_START',
    });
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
      userRole: resolveEffectiveRoleForLegacyCheck(user),
      lessonId,
      watchedSeconds: body.watchedSeconds,
      durationSeconds: body.durationSeconds,
      isCompleted: body.isCompleted,
      clientSequence: body.clientSequence,
      clientEventAt: body.clientEventAt,
      resetPosition: body.resetPosition,
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
      userRole: resolveEffectiveRoleForLegacyCheck(user),
      quizId,
      answers: body.answers,
      idempotencyKey: body.idempotencyKey ?? null,
    });
  }

  @Get('diplomas/:slug/my-status')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Get authenticated learner diploma progress, entitlement, and project submission status' })
  getDiplomaMyStatus(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedContextUser,
  ) {
    return this.learning.getMyDiplomaStatus(slug, user.id, user.role, user.roles);
  }

  @Post('diplomas/assessments/:assessmentId/submit')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Submit diploma assessment or final project' })
  submitDiplomaProject(
    @Param('assessmentId') assessmentId: string,
    @CurrentUser() user: AuthenticatedContextUser,
    @Body(new ZodValidationPipe(submitDiplomaProjectSchema)) body: { submissionText: string },
  ) {
    return this.learning.submitDiplomaProject(
      user.id,
      user.role,
      assessmentId,
      body.submissionText,
      user.roles,
    );
  }

  @Get('certificates')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'List earned certificates for current student' })
  getCertificates(@CurrentUser() user: AuthenticatedContextUser) {
    return this.learning.getMyCertificates(user.id);
  }

  @Get('certificates/:certificateId/detail')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Get single certificate print/template detail owned by authenticated user' })
  getCertificateDetail(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('certificateId') certificateId: string,
  ) {
    return this.learning.getMyCertificateById(user.id, certificateId);
  }

  // ---- Recommendation Letters & Unified Public Verification ----
  @Get('recommendations/my')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'List current student recommendation letter requests & approved letters' })
  listMyRecommendations(@CurrentUser() user: AuthenticatedContextUser) {
    return this.recommendations.listMyRecommendations(user.id);
  }

  @Post('recommendations/request')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Request an instructor-issued recommendation letter for an enrolled course or path' })
  requestRecommendation(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.recommendations.requestRecommendation(user.id, body, req.ip);
  }

  @Get('recommendations/:id')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Get printable approved recommendation letter owned by authenticated student' })
  getMyRecommendationPrint(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('id') id: string,
  ) {
    return this.recommendations.getStudentRecommendationPrintData(user.id, id);
  }

  @Get('credentials/verify/:code')
  @Throttle({ default: { limit: 25, ttl: 60_000 } })
  @ApiOperation({ summary: 'Unified rate-limited public verification for Certificates and Recommendation Letters (zero PII)' })
  verifyUnifiedCredential(@Param('code') code: string) {
    return this.recommendations.verifyPublicCredentialByCode(code);
  }

  @Get('competency-requests')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'List student competency certificate requests' })
  listCompetencyRequests(@CurrentUser() user: AuthenticatedContextUser) {
    return this.learning.listMyCompetencyRequests(user.id);
  }

  @Post('competency-requests')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Request a Competency Certificate upon 100% progress (routed to Admin & Assigned Instructor)' })
  requestCompetencyCertificate(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: unknown,
  ) {
    return this.learning.requestCompetencyCertificate(user.id, body);
  }

  @Post('reviews')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Submit or update review linked to both Instructor and Program/Course' })
  submitReview(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: unknown,
  ) {
    return this.learning.submitProgramInstructorReview(user.id, body);
  }

  @Get('certificates/verify/:code')
  @ApiOperation({ summary: 'Publicly verify certificate authenticity by code' })
  verifyCertificate(@Param('code') code: string) {
    return this.learning.verifyCertificateByCode(code);
  }

  @Patch('preferences/playback')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Persist learner preferred video playback speed across reloads & devices' })
  updatePlaybackPreferences(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: unknown,
  ) {
    return this.learning.updatePlaybackPreferences(user.id, body);
  }

  @Get('attachments/:attachmentId/download')
  @UseGuards(OptionalSessionAuthGuard)
  @ApiOperation({ summary: 'Download lesson attachment after backend entitlement verification' })
  async downloadAttachment(
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: AuthenticatedContextUser | undefined,
    @Res() res: Response,
  ) {
    const resolved = await this.learning.resolveAttachmentDownload({
      attachmentId,
      userId: user?.id ?? null,
      userRole: user?.role ?? null,
      userRoles: user?.roles,
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
