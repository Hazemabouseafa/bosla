import {
  Body,
  Controller,
  Delete,
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
  Roles,
} from '../../core/decorators';
import {
  CsrfGuard,
  OptionalSessionAuthGuard,
  RolesGuard,
  SessionAuthGuard,
} from '../../core/guards';
import { CommunityService } from './community.service';

@ApiTags('Course Community & Lesson Q&A')
@Controller('community')
export class CommunityController {
  constructor(
    @Inject(CommunityService) private readonly community: CommunityService,
  ) {}

  @Get('courses/:courseId/access')
  @UseGuards(OptionalSessionAuthGuard)
  @ApiOperation({ summary: 'Evaluate server-side access permissions for a course community' })
  getAccessInfo(
    @Param('courseId') courseId: string,
    @CurrentUser() user?: AuthenticatedContextUser,
  ) {
    return this.community.getCourseAccessInfo(courseId, user ?? null);
  }

  @Get('courses/:courseId/posts')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'List unified course community posts and lesson-specific Q&A' })
  listCoursePosts(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedContextUser,
    @Query('lessonId') lessonId?: string,
    @Query('filter') filter?: any,
    @Query('sort') sort?: any,
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('includeHidden') includeHidden?: string,
  ) {
    return this.community.listCoursePosts(courseId, user, {
      lessonId: lessonId || undefined,
      filter: filter || 'all',
      sort: sort || 'latest',
      search: search || undefined,
      cursor: cursor || undefined,
      limit: limit ? Number(limit) : 20,
      includeHidden: includeHidden === 'true',
    });
  }

  @Post('courses/:courseId/posts')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Create a course discussion, announcement, or lesson-linked Q&A post' })
  createPost(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.community.createPost(courseId, user, body, req.ip);
  }

  @Get('posts/:postId')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Get community post details with nested replies and accepted answer' })
  getPostDetail(
    @Param('postId') postId: string,
    @CurrentUser() user: AuthenticatedContextUser,
  ) {
    return this.community.getPostDetail(postId, user);
  }

  @Get('posts/:postId/timestamp-target')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Verify playback entitlement and resolve safe lesson timestamp navigation' })
  resolveTimestampTarget(
    @Param('postId') postId: string,
    @CurrentUser() user: AuthenticatedContextUser,
  ) {
    return this.community.resolveTimestampNavigation(postId, user);
  }

  @Post('posts/:postId/comments')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Add a reply or nested comment on a community post' })
  addComment(
    @Param('postId') postId: string,
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.community.addComment(postId, user, body, req.ip);
  }

  @Post('posts/:postId/like')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Toggle like reaction on a community post (duplicate-safe)' })
  togglePostLike(
    @Param('postId') postId: string,
    @CurrentUser() user: AuthenticatedContextUser,
  ) {
    return this.community.togglePostLike(postId, user);
  }

  @Post('comments/:commentId/like')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Toggle like reaction on a community comment (duplicate-safe)' })
  toggleCommentLike(
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthenticatedContextUser,
  ) {
    return this.community.toggleCommentLike(commentId, user);
  }

  @Post('posts/:postId/accept-answer')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Mark an answer as the accepted solution (Assigned Instructor or Admin only)' })
  acceptAnswer(
    @Param('postId') postId: string,
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.community.acceptAnswer(postId, user, body, req.ip);
  }

  @Post('posts/:postId/moderate')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Pin, lock, hide, remove, restore, or mark answered on a post' })
  moderatePost(
    @Param('postId') postId: string,
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.community.moderatePost(postId, user, body, req.ip);
  }

  @Delete('comments/:commentId')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Soft delete a community comment (Author or Moderator)' })
  deleteComment(
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthenticatedContextUser,
    @Req() req: Request,
  ) {
    return this.community.deleteComment(commentId, user, req.ip);
  }

  @Post('reports')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Report inappropriate post or comment for admin review' })
  createReport(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.community.createReport(user, body, req.ip);
  }

  // ============================================================
  // SUBSCRIBERS QUORA-STYLE Q&A COMMUNITY (/community)
  // ============================================================

  @Get('subscribers/questions')
  @UseGuards(OptionalSessionAuthGuard)
  @ApiOperation({ summary: 'List Quora-style Subscriber Q&A questions with filters and subscriber participation flag' })
  listSubscriberQuestions(
    @CurrentUser() user?: AuthenticatedContextUser,
    @Query('topic') topic?: string,
    @Query('filter') filter?: string,
    @Query('search') search?: string,
  ) {
    return this.community.listSubscriberQuestions(user ?? null, {
      topic: topic || undefined,
      filter: filter || 'all',
      search: search || undefined,
    });
  }

  @Get('subscribers/questions/:questionId')
  @UseGuards(OptionalSessionAuthGuard)
  @ApiOperation({ summary: 'Get Subscriber Q&A question detail with all answers' })
  getSubscriberQuestion(
    @Param('questionId') questionId: string,
    @CurrentUser() user?: AuthenticatedContextUser,
  ) {
    return this.community.getSubscriberQuestionDetail(questionId, user ?? null);
  }

  @Post('subscribers/questions')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Ask a new question in the Subscribers Q&A Community' })
  createSubscriberQuestion(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.community.createSubscriberQuestion(user, body, req.ip);
  }

  @Post('subscribers/questions/:questionId/answers')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Post an answer in the Subscribers Q&A Community' })
  createSubscriberAnswer(
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.community.createSubscriberAnswer(questionId, user, body, req.ip);
  }

  @Post('subscribers/questions/:questionId/upvote')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Toggle upvote on a Subscriber Q&A question' })
  toggleQuestionUpvote(
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthenticatedContextUser,
  ) {
    return this.community.toggleSubscriberQuestionUpvote(questionId, user);
  }

  @Post('subscribers/answers/:answerId/upvote')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Toggle upvote on a Subscriber Q&A answer' })
  toggleAnswerUpvote(
    @Param('answerId') answerId: string,
    @CurrentUser() user: AuthenticatedContextUser,
  ) {
    return this.community.toggleSubscriberAnswerUpvote(answerId, user);
  }

  @Post('subscribers/questions/:questionId/accept-answer')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Mark an answer as the accepted solution on a Subscriber Q&A question' })
  acceptSubscriberAnswer(
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: { answerId: string | null },
  ) {
    return this.community.acceptSubscriberAnswer(questionId, user, body?.answerId ?? null);
  }
}

@ApiTags('Instructor Community Management')
@Controller('instructor/communities')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles('INSTRUCTOR', 'ADMIN')
export class InstructorCommunityController {
  constructor(
    @Inject(CommunityService) private readonly community: CommunityService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get instructor courses community overview, analytics, and questions' })
  listInstructorCommunities(
    @CurrentUser() user: AuthenticatedContextUser,
    @Query('courseId') courseId?: string,
    @Query('filter') filter?: string,
  ) {
    return this.community.getInstructorCommunitiesDashboard(
      user.id,
      courseId || undefined,
      filter || 'all',
    );
  }

  @Patch('courses/:courseId/settings')
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Update instructor-managed community settings (respecting admin lock)' })
  updateCourseSettings(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.community.updateCourseSettingsByInstructor(user.id, courseId, body, req.ip);
  }
}

@ApiTags('Admin Community Governance')
@Controller('admin/communities')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminCommunityController {
  constructor(
    @Inject(CommunityService) private readonly community: CommunityService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get platform-wide community analytics, courses, and moderation history' })
  overview() {
    return this.community.getAdminCommunitiesOverview();
  }

  @Get('posts')
  @ApiOperation({ summary: 'List and filter community posts across all courses for admin oversight' })
  listPosts(
    @Query('courseId') courseId?: string,
    @Query('filter') filter?: string,
    @Query('search') search?: string,
  ) {
    return this.community.listAdminPosts({
      courseId: courseId || undefined,
      filter: filter || undefined,
      search: search || undefined,
    });
  }

  @Patch('courses/:courseId/settings')
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Enable or disable course community visibility (Admin control)' })
  updateCourseSettings(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.community.updateCourseSettingsByAdmin(user.id, courseId, body, req.ip);
  }

  @Get('reports')
  @ApiOperation({ summary: 'List submitted community moderation reports' })
  listReports(@Query('status') status?: string) {
    return this.community.listReports(status || undefined);
  }

  @Post('reports/:reportId/resolve')
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Resolve a community report and optionally remove flagged content' })
  resolveReport(
    @Param('reportId') reportId: string,
    @CurrentUser() user: AuthenticatedContextUser,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.community.resolveReport(user.id, reportId, body, req.ip);
  }
}
