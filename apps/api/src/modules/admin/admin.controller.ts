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
import { AdminService } from './admin.service';

@ApiTags('Admin Control Panel')
@Controller('admin')
@UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

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

  @Put('settings/:key')
  upsertSetting(
    @CurrentUser() admin: AuthenticatedContextUser,
    @Param('key') key: string,
    @Body() body: { value: unknown },
  ) {
    return this.admin.upsertSiteSetting(admin.id, key, body.value);
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
}
