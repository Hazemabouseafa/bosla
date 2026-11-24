import {
  Body,
  Controller,
  Delete,
  Get,
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
import type {
  EditorialStatus,
  LeadStatus,
  SupportRecoveryStatus,
  UserRole,
  UserStatus,
} from '@bosla/db';
import {
  AuthenticatedContextUser,
  CurrentUser,
  Roles,
} from '../../core/decorators';
import { CsrfGuard, RolesGuard, SessionAuthGuard } from '../../core/guards';
import { VideoService } from '../video/video.service';
import { AdminOperationsService } from './admin-operations.service';
import { AdminService } from './admin.service';
import { LiveEditorAndPaymobService } from './live-editor-paymob.service';

@ApiTags('Admin Control Panel')
@Controller('admin')
@UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    @Inject(AdminService) private readonly admin: AdminService,
    @Inject(AdminOperationsService) private readonly ops: AdminOperationsService,
    @Inject(VideoService) private readonly videoService: VideoService,
    @Inject(LiveEditorAndPaymobService)
    private readonly livePaymob: LiveEditorAndPaymobService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get admin KPIs, queues, revenue, and VPS media health' })
  getOverview() {
    return this.admin.getOverview();
  }

  // USERS & INSTRUCTORS
  @Get('users')
  listUsers(
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
    @Query('q') q?: string,
  ) {
    return this.admin.listUsers({ role, status, q });
  }

  @Post('users')
  createUser(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.ops.createUserAccount(admin.id, body, req.ip);
  }

  @Get('users/:userId/details')
  getUserDetails(@Param('userId') userId: string) {
    return this.ops.getUserDetails(userId);
  }

  @Patch('users/:userId/profile')
  updateUserProfile(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('userId') userId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.ops.updateUserProfile(admin.id, userId, body, req.ip);
  }

  @Post('users/:userId/revoke-sessions')
  revokeUserSessions(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('userId') userId: string,
    @Req() req: Request,
  ) {
    return this.ops.revokeUserSessions(admin.id, userId, req.ip);
  }

  @Patch('users/:userId')
  updateUser(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('userId') userId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.admin.updateUserRoleAndStatus(admin.id, userId, body, req.ip);
  }

  @Post('instructors')
  createInstructor(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Body() body: any,
    @Req() req: Request,
  ) {
    return this.admin.createInstructorAccount(admin.id, body, req.ip);
  }

  // CATEGORIES & COURSES
  @Get('categories')
  listCategories() {
    return this.admin.listCategories();
  }

  @Post('categories')
  saveCategory(@Body() body: any) {
    return this.admin.upsertCategory(body);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.admin.deleteCategory(id);
  }

  @Get('courses')
  listAllCourses() {
    return this.admin.listAllCourses();
  }

  @Post('courses')
  createCourse(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Body() body: unknown,
  ) {
    return this.admin.createCourse(admin.id, body);
  }

  @Post('courses/bulk-action')
  bulkCourseAction(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.ops.bulkCourseAction(admin.id, body, req.ip);
  }

  @Post('courses/:courseId/duplicate')
  duplicateCourse(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
    @Req() req: Request,
  ) {
    return this.ops.duplicateCourse(admin.id, courseId, req.ip);
  }

  @Patch('courses/:courseId')
  updateCourse(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
    @Body() body: unknown,
  ) {
    return this.admin.updateCourse(admin.id, courseId, body);
  }

  @Post('courses/:courseId/publish')
  publishCourseNow(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
  ) {
    return this.admin.publishCourseNow(admin.id, courseId);
  }

  @Post('courses/:courseId/unpublish')
  unpublishCourseNow(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
  ) {
    return this.admin.unpublishCourseNow(admin.id, courseId);
  }

  @Delete('courses/:courseId')
  deleteCourse(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('courseId') courseId: string,
  ) {
    return this.admin.deleteCourse(admin.id, courseId);
  }

  // LEARNING PATHS (REUSING COURSES)
  @Get('learning-paths')
  listLearningPaths() {
    return this.admin.listLearningPaths();
  }

  @Post('learning-paths')
  createLearningPath(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.admin.createLearningPath(admin.id, body, req.ip);
  }

  @Patch('learning-paths/:id')
  updateLearningPath(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.admin.updateLearningPath(admin.id, id, body, req.ip);
  }

  @Post('learning-paths/:id/status')
  setLearningPathStatus(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('id') id: string,
    @Body() body: { status: EditorialStatus; scheduledPublishAt?: string },
  ) {
    return this.admin.setLearningPathStatus(
      admin.id,
      id,
      body.status,
      body.scheduledPublishAt,
    );
  }

  @Delete('learning-paths/:id')
  deleteLearningPath(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.admin.deleteLearningPath(admin.id, id, req.ip);
  }

  // DIPLOMAS (REUSING COURSES) & PROJECT GRADING
  @Get('diplomas')
  listDiplomas() {
    return this.admin.listDiplomas();
  }

  @Post('diplomas')
  createDiploma(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.admin.createDiploma(admin.id, body, req.ip);
  }

  @Patch('diplomas/:id')
  updateDiploma(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.admin.updateDiploma(admin.id, id, body, req.ip);
  }

  @Post('diplomas/:id/status')
  setDiplomaStatus(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('id') id: string,
    @Body() body: { status: EditorialStatus },
  ) {
    return this.admin.setDiplomaStatus(admin.id, id, body.status);
  }

  @Delete('diplomas/:id')
  deleteDiploma(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.admin.deleteDiploma(admin.id, id, req.ip);
  }

  @Get('diplomas/submissions')
  listDiplomaSubmissions() {
    return this.admin.listDiplomaSubmissions();
  }

  @Post('diplomas/submissions/:submissionId/grade')
  gradeSubmission(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('submissionId') submissionId: string,
    @Body() body: { scorePercent: number; feedbackAr?: string },
  ) {
    return this.admin.gradeDiplomaSubmission(admin.id, submissionId, body);
  }

  // MEMBERSHIP PLANS & REVISIONS
  @Get('membership-plans')
  listMembershipPlans() {
    return this.admin.listMembershipPlansAdmin();
  }

  @Post('membership-plans')
  createMembershipPlan(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.admin.createOrUpdateMembershipPlan(admin.id, body, undefined, req.ip);
  }

  @Patch('membership-plans/:planId')
  updateMembershipPlan(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('planId') planId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.admin.createOrUpdateMembershipPlan(admin.id, body, planId, req.ip);
  }

  // PAYMENTS, CERTIFICATES & SUPPORT RECOVERY
  @Get('payments')
  listPayments() {
    return this.admin.listPaymentsAndWebhooks();
  }

  @Get('certificates')
  listCertificates() {
    return this.admin.listCertificatesAdmin();
  }

  @Post('certificates/:id/revoke')
  revokeCertificate(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('id') id: string,
  ) {
    return this.admin.revokeCertificate(admin.id, id);
  }

  @Get('support-recovery')
  listSupportRecovery() {
    return this.admin.listSupportRecoveryRequests();
  }

  @Post('support-recovery/:requestId/resolve')
  resolveSupportRecovery(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('requestId') requestId: string,
    @Body() body: { status: SupportRecoveryStatus; resolutionNotes?: string },
    @Req() req: Request,
  ) {
    return this.admin.resolveSupportRecoveryRequest(admin.id, requestId, body, req.ip);
  }

  // CMS, SETTINGS, LEADS & AUDIT LOGS
  @Get('cms/pages')
  listCmsPages() {
    return this.admin.listCmsPages();
  }

  @Put('cms/pages/:slug')
  upsertCmsPage(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('slug') slug: string,
    @Body() body: any,
  ) {
    return this.admin.upsertCmsPage(admin.id, slug, body);
  }

  @Get('cms/collections')
  getCmsCollections() {
    return this.admin.getCmsCollections();
  }

  @Post('cms/testimonials')
  saveTestimonial(@Body() body: any) {
    return this.admin.saveCmsTestimonial(body);
  }

  @Delete('cms/testimonials/:id')
  deleteTestimonial(@Param('id') id: string) {
    return this.admin.deleteCmsTestimonial(id);
  }

  @Post('cms/faqs')
  saveFaq(@Body() body: any) {
    return this.admin.saveCmsFaq(body);
  }

  @Delete('cms/faqs/:id')
  deleteFaq(@Param('id') id: string) {
    return this.admin.deleteCmsFaq(id);
  }

  @Post('cms/partners')
  savePartner(@Body() body: any) {
    return this.admin.saveCmsPartner(body);
  }

  @Delete('cms/partners/:id')
  deletePartner(@Param('id') id: string) {
    return this.admin.deleteCmsPartner(id);
  }

  // SUBSCRIPTIONS, ENROLLMENTS, CERTIFICATES OVERRIDES
  @Post('subscriptions/grant')
  grantSubscription(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.ops.grantSubscription(admin.id, body, req.ip);
  }

  @Post('subscriptions/:subscriptionId/status')
  updateSubscriptionStatus(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.ops.updateSubscriptionStatus(admin.id, subscriptionId, body, req.ip);
  }

  @Post('enrollments/grant')
  grantCourseEnrollment(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.ops.grantCourseEnrollment(admin.id, body, req.ip);
  }

  @Delete('enrollments/:userId/:courseId')
  revokeCourseEnrollment(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('userId') userId: string,
    @Param('courseId') courseId: string,
    @Req() req: Request,
  ) {
    return this.ops.revokeCourseEnrollment(admin.id, userId, courseId, req.ip);
  }

  @Post('certificates/issue')
  issueCertificate(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.ops.issueCertificate(admin.id, body, req.ip);
  }

  @Post('certificates/:certificateId/restore')
  restoreCertificate(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('certificateId') certificateId: string,
  ) {
    return this.admin.restoreCertificate(admin.id, certificateId);
  }

  // REVIEWS, NOTIFICATIONS BROADCAST & MEDIA ASSET MANAGER
  @Get('reviews')
  listReviews() {
    return this.ops.listCourseReviews();
  }

  @Patch('reviews/:reviewId')
  toggleReview(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('reviewId') reviewId: string,
    @Body() body: { isPublished: boolean },
    @Req() req: Request,
  ) {
    return this.ops.setCourseReviewPublished(admin.id, reviewId, Boolean(body.isPublished), req.ip);
  }

  @Delete('reviews/:reviewId')
  deleteReview(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('reviewId') reviewId: string,
    @Req() req: Request,
  ) {
    return this.ops.deleteCourseReview(admin.id, reviewId, req.ip);
  }

  @Post('notifications/broadcast')
  broadcastNotification(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.ops.broadcastNotification(admin.id, body, req.ip);
  }

  @Get('media/videos')
  listMediaVideos() {
    return this.videoService.listVideosForAdmin();
  }

  @Delete('media/videos/:videoAssetId')
  deleteMediaVideo(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('videoAssetId') videoAssetId: string,
    @Query('force') force: string | undefined,
    @Req() req: Request,
  ) {
    return this.videoService.deleteVideoAssetForAdmin(admin.id, videoAssetId, {
      force: force === 'true',
      ip: req.ip,
    });
  }

  @Get('media/images')
  listMediaImages() {
    return this.videoService.listCoverImagesForAdmin();
  }

  @Delete('media/images/:filename')
  deleteMediaImage(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('filename') filename: string,
    @Req() req: Request,
  ) {
    return this.videoService.deleteCoverImageForAdmin(admin.id, filename, req.ip);
  }

  @Put('settings/:key')
  upsertSetting(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('key') key: string,
    @Body() body: Record<string, unknown>,
  ) {
    const resolvedValue =
      body && typeof body === 'object' && 'value' in body ? body.value : body;
    return this.admin.upsertSiteSetting(admin.id, key, resolvedValue);
  }

  @Get('leads')
  listLeads() {
    return this.admin.listLeads();
  }

  @Patch('leads/:leadId')
  updateLead(
    @Param('leadId') leadId: string,
    @Body() body: { status: LeadStatus; notes?: string },
  ) {
    return this.admin.updateLeadStatus(leadId, body.status, body.notes);
  }

  @Get('audit-logs')
  listAuditLogs(@Query('limit') limit?: string) {
    return this.admin.listAuditLogs(limit ? Number(limit) : 100);
  }

  // MULTI-INSTRUCTOR REVENUE SHARES, PROGRAM FINANCIAL ACCOUNTS, INSTRUCTOR STATEMENTS & COMPETENCY REQUESTS
  @Get('finance/overview')
  getFinanceOverview() {
    return this.admin.getFinanceOverview();
  }

  @Put('programs/:targetType/:targetId/instructors')
  setProgramInstructors(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('targetType') targetType: 'COURSE' | 'LEARNING_PATH' | 'DIPLOMA',
    @Param('targetId') targetId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.admin.setProgramInstructorAssignments(admin.id, targetType, targetId, body, req.ip);
  }

  @Post('finance/instructors/:instructorId/payout')
  recordInstructorPayout(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('instructorId') instructorId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.admin.recordInstructorPayout(admin.id, instructorId, body, req.ip);
  }

  @Get('competency-requests')
  listCompetencyRequests() {
    return this.admin.listCompetencyRequests();
  }

  @Post('competency-requests/:requestId/review')
  reviewCompetencyRequest(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ) {
    return this.admin.reviewCompetencyRequest(admin.id, requestId, body);
  }

  // ==========================================================================
  // SECTION 6: IN-PRODUCT LIVE EDITOR (DRAFT, PUBLISH, VERSION ROLLBACK)
  // ==========================================================================
  @Get('live-editor/state')
  @ApiOperation({ summary: 'Get Live Editor draft, published state, version history, and available courses/plans' })
  getLiveEditorState(@Query('pageKey') pageKey?: string) {
    return this.livePaymob.getEditorState(pageKey || 'home');
  }

  @Put('live-editor/draft')
  @ApiOperation({ summary: 'Save Live Editor draft with XSS sanitization and baseVersion optimistic conflict check' })
  saveLiveEditorDraft(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.livePaymob.saveDraft(admin, body, req.ip);
  }

  @Post('live-editor/publish')
  @ApiOperation({ summary: 'Publish current Live Editor draft and archive previous published version' })
  publishLiveEditorDraft(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.livePaymob.publishDraft(admin, body, req.ip);
  }

  @Post('live-editor/rollback/:revisionId')
  @ApiOperation({ summary: 'Rollback public site layout to a previous revision from version history' })
  rollbackLiveEditorRevision(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('revisionId') revisionId: string,
    @Req() req: Request,
  ) {
    return this.livePaymob.rollbackToRevision(admin, revisionId, req.ip);
  }

  // ==========================================================================
  // SECTION 8: ENCRYPTED PAYMOB SETTINGS (TEST & LIVE)
  // ==========================================================================
  @Get('payments/paymob/config')
  @ApiOperation({ summary: 'Get masked Paymob configuration, readiness checklist, and copyable webhook URLs' })
  getPaymobConfig() {
    return this.livePaymob.getPaymobConfigForAdmin();
  }

  @Put('payments/paymob/config')
  @ApiOperation({ summary: 'Save Paymob Test/Live configuration with AES-256-GCM encryption for secrets' })
  updatePaymobConfig(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.livePaymob.updatePaymobConfigForAdmin(admin, body, req.ip);
  }

  @Post('payments/paymob/verify')
  @ApiOperation({ summary: 'Verify Paymob configuration completeness and HMAC SHA-512 readiness' })
  verifyPaymobConfig(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Req() req: Request,
  ) {
    return this.livePaymob.verifyPaymobConfigForAdmin(admin, req.ip);
  }
}
