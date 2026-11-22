import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { isAdminRole } from '@bosla/shared';
import {
  type AuthenticatedContextUser,
  CurrentUser,
  Roles,
} from '../../core/decorators';
import {
  CsrfGuard,
  RolesGuard,
  SessionAuthGuard,
} from '../../core/guards';
import { InstructorCollabService } from './instructor-collab.service';

@Controller()
@UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
export class InstructorCollabController {
  constructor(
    @Inject(InstructorCollabService)
    private readonly collabService: InstructorCollabService,
  ) {}

  // ============================================================
  // SUPER ADMIN / ADMIN <-> INSTRUCTOR COLLABORATION ENDPOINTS
  // ============================================================

  @Get('admin/instructor-collab/overview')
  @Roles('ADMIN', 'SUPER_ADMIN', 'ACADEMY_MANAGER', 'TRAINING_COORDINATOR')
  async getAdminOverview() {
    return this.collabService.getAdminOverview();
  }

  @Get('admin/instructor-collab/instructors/:instructorId/thread')
  @Roles('ADMIN', 'SUPER_ADMIN', 'ACADEMY_MANAGER', 'TRAINING_COORDINATOR')
  async getInstructorThread(@Param('instructorId') instructorId: string) {
    return this.collabService.getInstructorThreadForAdmin(instructorId);
  }

  @Post('admin/instructor-collab/instructors/:instructorId/messages')
  @Roles('ADMIN', 'SUPER_ADMIN', 'ACADEMY_MANAGER', 'TRAINING_COORDINATOR')
  async sendAdminMessage(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('instructorId') instructorId: string,
    @Body() body: unknown,
  ) {
    return this.collabService.sendAdminMessage(
      user.id,
      isAdminRole(user.role, user.roles) ? 'ADMIN' : user.role,
      instructorId,
      body,
    );
  }

  @Post('admin/instructor-collab/instructors/:instructorId/tasks')
  @Roles('ADMIN', 'SUPER_ADMIN', 'ACADEMY_MANAGER', 'TRAINING_COORDINATOR')
  async createTaskForInstructor(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('instructorId') instructorId: string,
    @Body() body: unknown,
  ) {
    return this.collabService.createTaskForInstructor(
      user.id,
      isAdminRole(user.role, user.roles) ? 'ADMIN' : user.role,
      instructorId,
      body,
    );
  }

  @Patch('admin/instructor-collab/tasks/:taskId')
  @Roles('ADMIN', 'SUPER_ADMIN', 'ACADEMY_MANAGER', 'TRAINING_COORDINATOR')
  async updateTaskByAdmin(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('taskId') taskId: string,
    @Body() body: unknown,
  ) {
    return this.collabService.updateTaskByAdmin(
      user.id,
      isAdminRole(user.role, user.roles) ? 'ADMIN' : user.role,
      taskId,
      body,
    );
  }

  @Delete('admin/instructor-collab/tasks/:taskId')
  @Roles('ADMIN', 'SUPER_ADMIN', 'ACADEMY_MANAGER', 'TRAINING_COORDINATOR')
  async deleteTaskByAdmin(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('taskId') taskId: string,
  ) {
    return this.collabService.deleteTaskByAdmin(
      user.id,
      isAdminRole(user.role, user.roles) ? 'ADMIN' : user.role,
      taskId,
    );
  }

  // ============================================================
  // INSTRUCTOR WORKSPACE ENDPOINTS
  // ============================================================

  @Get('instructor/collab/workspace')
  @Roles('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN', 'ACADEMY_MANAGER', 'TRAINING_COORDINATOR')
  async getInstructorWorkspace(@CurrentUser() user: AuthenticatedContextUser) {
    return this.collabService.getInstructorWorkspace(user.id);
  }

  @Post('instructor/collab/messages/read')
  @Roles('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN', 'ACADEMY_MANAGER', 'TRAINING_COORDINATOR')
  async markMessagesRead(@CurrentUser() user: AuthenticatedContextUser) {
    return this.collabService.markMessagesReadByInstructor(user.id);
  }

  @Post('instructor/collab/messages')
  @Roles('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN', 'ACADEMY_MANAGER', 'TRAINING_COORDINATOR')
  async sendInstructorMessage(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: unknown,
  ) {
    return this.collabService.sendInstructorMessage(
      user.id,
      user.role,
      body,
    );
  }

  @Patch('instructor/collab/tasks/:taskId/status')
  @Roles('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN', 'ACADEMY_MANAGER', 'TRAINING_COORDINATOR')
  async updateTaskStatusByInstructor(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('taskId') taskId: string,
    @Body() body: unknown,
  ) {
    return this.collabService.updateTaskStatusByInstructor(
      user.id,
      isAdminRole(user.role, user.roles) ? 'ADMIN' : user.role,
      taskId,
      body,
    );
  }
}
