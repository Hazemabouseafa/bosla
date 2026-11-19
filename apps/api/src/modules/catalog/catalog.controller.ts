import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { leadSubmissionSchema } from '@bosla/shared';
import { SkipCsrf } from '../../core/decorators';
import { ZodValidationPipe } from '../../core/zod-validation.pipe';
import { CatalogService } from './catalog.service';

@ApiTags('Public Catalog & CMS')
@Controller('catalog')
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get('home')
  @ApiOperation({ summary: 'Get database-driven homepage CMS, featured courses, paths, diplomas, and specialization quiz' })
  getHomeBundle() {
    return this.catalog.getHomeBundle();
  }

  @Get('section-visibility')
  @ApiOperation({ summary: 'Get admin-controlled visibility flags for public storefront sections' })
  getSectionVisibility() {
    return this.catalog.getPublicSectionVisibility();
  }

  @Get('courses')
  @ApiOperation({ summary: 'List published courses with search and filtering' })
  listCourses(
    @Query('search') search?: string,
    @Query('category') categorySlug?: string,
    @Query('difficulty') difficulty?: string,
    @Query('free') free?: string,
  ) {
    return this.catalog.listPublishedCourses({
      search,
      categorySlug,
      difficulty,
      freeOnly: free === 'true',
    });
  }

  @Get('courses/:slug')
  @ApiOperation({ summary: 'Get published course details by slug' })
  getCourse(@Param('slug') slug: string) {
    return this.catalog.getPublishedCourseBySlug(slug);
  }

  @Get('learning-paths')
  @ApiOperation({ summary: 'List published learning paths' })
  listLearningPaths() {
    return this.catalog.listPublishedLearningPaths();
  }

  @Get('learning-paths/:slug')
  @ApiOperation({ summary: 'Get published learning path details by slug' })
  getLearningPath(@Param('slug') slug: string) {
    return this.catalog.getPublishedLearningPathBySlug(slug);
  }

  @Get('diplomas')
  @ApiOperation({ summary: 'List published diplomas' })
  listDiplomas() {
    return this.catalog.listPublishedDiplomas();
  }

  @Get('diplomas/:slug')
  @ApiOperation({ summary: 'Get published diploma details by slug' })
  getDiploma(@Param('slug') slug: string) {
    return this.catalog.getPublishedDiplomaBySlug(slug);
  }

  @Get('pages/:slug')
  @ApiOperation({ summary: 'Get CMS static/legal page by slug' })
  getPage(@Param('slug') slug: string) {
    return this.catalog.getCmsPage(slug);
  }

  @Post('specialization/rank')
  @SkipCsrf()
  @ApiOperation({ summary: 'Rank career specialization domains based on quiz weights' })
  rankSpecializations(
    @Body()
    body: {
      dimensionScores: Record<string, number>;
      speciesScores: Record<string, number>;
    },
  ) {
    return this.catalog.rankSpecializations(body);
  }

  @Post('leads')
  @SkipCsrf()
  @ApiOperation({ summary: 'Submit individual, corporate B2B, sponsor, or waitlist lead' })
  submitLead(@Body(new ZodValidationPipe(leadSubmissionSchema)) body: any) {
    return this.catalog.submitLead(body);
  }
}
