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
import { LmsAdvancedService } from './lms-advanced.service';

@ApiTags('Advanced LMS, Sessions, Question Bank, Assignments, Instructors & Certificates')
@Controller('lms')
export class LmsAdvancedController {
  constructor(@Inject(LmsAdvancedService) private readonly lms: LmsAdvancedService) {}

  // ---- Course Delivery Modes & Waitlists ----
  @Patch('courses/:courseId/delivery')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('courses.manage')
  updateCourseDelivery(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    return this.lms.updateCourseDeliverySettings(actor, courseId, body, req.ip);
  }

  @Post('courses/:courseId/waitlist')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  joinWaitlist(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
  ) {
    return this.lms.joinCourseWaitlist(user, courseId);
  }

  @Get('courses/:courseId/waitlist')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @RequirePermissions('training.coordinate')
  listWaitlist(@Param('courseId') courseId: string) {
    return this.lms.listCourseWaitlist(courseId);
  }

  // ---- Training Sessions & Attendance ----
  @Get('sessions')
  @UseGuards(SessionAuthGuard)
  listSessions(@Query('courseId') courseId?: string) {
    return this.lms.listSessions(courseId);
  }

  @Post('sessions')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('training.coordinate')
  createSession(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.lms.createSession(actor, body, req.ip);
  }

  @Get('sessions/:sessionId/attendance')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @RequirePermissions('attendance.manage')
  getAttendance(@Param('sessionId') sessionId: string) {
    return this.lms.getSessionAttendance(sessionId);
  }

  @Post('sessions/:sessionId/attendance')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('attendance.manage')
  markAttendance(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('sessionId') sessionId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.lms.markSessionAttendance(actor, sessionId, body, req.ip);
  }

  // ---- Question Bank & Manual Quiz Grading ----
  @Get('question-bank')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @RequirePermissions('lms.grade')
  listQuestionBank(
    @Query('courseId') courseId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('questionType') questionType?: string,
  ) {
    return this.lms.listQuestionBank({ courseId, categoryId, questionType });
  }

  @Post('question-bank/categories')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('lms.grade')
  createCategory(@Body() body: any) {
    return this.lms.createQuestionBankCategory(body);
  }

  @Post('question-bank/items')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('lms.grade')
  createQuestion(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Body() body: unknown,
  ) {
    return this.lms.createQuestionBankItem(actor, body);
  }

  @Patch('quiz-attempts/:attemptId/grade')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('lms.grade')
  manualGradeAttempt(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('attemptId') attemptId: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    return this.lms.manualGradeQuizAttempt(actor, attemptId, body, req.ip);
  }

  // ---- Assignments & Practical Projects ----
  @Get('assignments')
  @UseGuards(SessionAuthGuard)
  listAssignments(@Query('courseId') courseId?: string) {
    return this.lms.listAssignments(courseId);
  }

  @Post('assignments')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('lms.grade')
  createAssignment(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.lms.createAssignment(actor, body, req.ip);
  }

  @Post('assignments/:assignmentId/submit')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  submitAssignment(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('assignmentId') assignmentId: string,
    @Body() body: unknown,
  ) {
    return this.lms.submitAssignment(user, assignmentId, body);
  }

  @Get('assignments/:assignmentId/submissions')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @RequirePermissions('lms.grade')
  listSubmissions(@Param('assignmentId') assignmentId: string) {
    return this.lms.listAssignmentSubmissions(assignmentId);
  }

  @Post('submissions/:submissionId/grade')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('lms.grade')
  gradeSubmission(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('submissionId') submissionId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.lms.gradeAssignmentSubmission(actor, submissionId, body, req.ip);
  }

  // ---- Instructor Profiles & Contracts ----
  @Get('instructors/profiles')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @RequirePermissions('instructor.finance.manage')
  listInstructorProfiles() {
    return this.lms.listInstructorProfilesAndContracts();
  }

  @Patch('instructors/:instructorId/profile')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  upsertInstructorProfile(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('instructorId') instructorId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.lms.upsertInstructorProfile(actor, instructorId, body, req.ip);
  }

  @Post('instructors/contracts')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('instructor.finance.manage')
  createInstructorContract(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.lms.createInstructorContract(actor, body, req.ip);
  }

  // ---- Certificate Templates, QR Verification, Reissue & Revoke ----
  @Get('certificates/templates')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @RequirePermissions('certificates.issue')
  listCertTemplates() {
    return this.lms.listCertificateTemplates();
  }

  @Post('certificates/templates')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('certificates.issue')
  upsertCertTemplate(@Body() body: any) {
    return this.lms.upsertCertificateTemplate(body);
  }

  @Get('certificates/:code/verify')
  @ApiOperation({ summary: 'Public verification endpoint returning certificate status & QR SVG' })
  verifyCert(@Param('code') code: string) {
    return this.lms.verifyCertificateWithQr(code);
  }

  @Post('certificates/:certificateId/reissue')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('certificates.issue')
  reissueCert(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('certificateId') certificateId: string,
    @Body() body: { reasonAr: string },
    @Req() req: Request,
  ) {
    return this.lms.reissueCertificate(actor, certificateId, body?.reasonAr || '', req.ip);
  }

  @Post('certificates/:certificateId/revoke')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @RequirePermissions('certificates.revoke')
  revokeCert(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('certificateId') certificateId: string,
    @Body() body: { reasonAr: string },
    @Req() req: Request,
  ) {
    return this.lms.revokeCertificate(actor, certificateId, body?.reasonAr || '', req.ip);
  }
}
