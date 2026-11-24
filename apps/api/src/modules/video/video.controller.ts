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
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import * as fsSync from 'node:fs';
import { initiateUploadSchema } from '@bosla/shared';
import {
  AuthenticatedContextUser,
  CurrentUser,
  Roles,
  SkipCsrf,
} from '../../core/decorators';
import { CsrfGuard, RolesGuard, SessionAuthGuard } from '../../core/guards';
import { ZodValidationPipe } from '../../core/zod-validation.pipe';
import { VideoCaptionsAndAnalyticsService } from './video-captions-analytics.service';
import { VideoService } from './video.service';

@ApiTags('Self-Hosted Video Upload & Protected HLS Streaming')
@Controller()
export class VideoController {
  constructor(
    @Inject(VideoService) private readonly videoService: VideoService,
    @Inject(VideoCaptionsAndAnalyticsService)
    private readonly captionsAnalytics: VideoCaptionsAndAnalyticsService,
  ) {}

  @Post('instructor/videos/uploads/initiate')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Initiate a resumable chunked video upload session on VPS storage' })
  initiateUpload(
    @CurrentUser() user: AuthenticatedContextUser,
    @Body(new ZodValidationPipe(initiateUploadSchema)) body: any,
  ) {
    return this.videoService.initiateUpload({
      instructorId: user.id,
      userRole: user.role,
      userRoles: user.roles,
      courseId: body.courseId,
      titleAr: body.titleAr,
      filename: body.filename,
      mimeType: body.mimeType,
      totalBytes: body.totalBytes,
      chunkSizeBytes: body.chunkSizeBytes,
    });
  }

  @Post('instructor/videos/uploads/:sessionId/chunk')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Upload raw binary chunk at chunkIndex offset without loading whole video in memory' })
  async uploadChunk(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('sessionId') sessionId: string,
    @Query('chunkIndex') chunkIndexQuery: string,
    @Headers('x-chunk-index') chunkIndexHeader: string | undefined,
    @Req() req: Request,
  ) {
    const chunkIndex = Number(chunkIndexHeader ?? chunkIndexQuery);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
      throw new BadRequestException('معامل chunkIndex غير صالح');
    }

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      if (Buffer.isBuffer(req.body)) {
        chunks.push(req.body);
        resolve();
        return;
      }
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve());
      req.on('error', reject);
    });

    const buffer = Buffer.concat(chunks);
    if (buffer.length === 0) {
      throw new BadRequestException('محتوى الجزء فارغ');
    }

    return this.videoService.uploadChunk({
      sessionId,
      instructorId: user.id,
      userRole: user.role,
      userRoles: user.roles,
      chunkIndex,
      chunkBuffer: buffer,
    });
  }

  @Get('instructor/videos/uploads/:sessionId')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Check resumable upload progress and received chunks' })
  getUploadStatus(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.videoService.getUploadSessionStatus(sessionId, user.id, user.role, user.roles);
  }

  @Post('instructor/videos/uploads/:sessionId/complete')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Finalize uploaded video and enqueue local FFmpeg HLS transcoding' })
  completeUpload(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('sessionId') sessionId: string,
    @Body() body: { titleAr: string },
  ) {
    return this.videoService.completeUpload({
      sessionId,
      instructorId: user.id,
      userRole: user.role,
      userRoles: user.roles,
      titleAr: body?.titleAr,
    });
  }

  @Post('instructor/videos/uploads/:sessionId/cancel')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Cancel upload and clean up temporary file' })
  cancelUpload(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.videoService.cancelUpload(sessionId, user.id, user.role, user.roles);
  }

  @Post('lessons/:lessonId/playback-session')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Verify entitlement and generate short-lived signed HLS playback URL' })
  createPlaybackSession(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('lessonId') lessonId: string,
  ) {
    return this.videoService.createLessonPlaybackSession({
      userId: user.id,
      userRole: user.role,
      userRoles: user.roles,
      lessonId,
      authSessionId: user.sessionId,
    });
  }

  @Get('videos/stream/:videoAssetId/*assetPath')
  @SkipCsrf()
  @ApiOperation({ summary: 'Authorized HLS manifest & segment delivery (via X-Accel-Redirect or range stream)' })
  async streamHls(
    @Param('videoAssetId') videoAssetId: string,
    @Param('assetPath') assetPathParam: string | string[],
    @Query('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const assetPath = Array.isArray(assetPathParam) ? assetPathParam.join('/') : assetPathParam;
    const result = await this.videoService.authorizeAndResolveStream({
      videoAssetId,
      assetPath,
      token,
      originHeader: req.headers.origin as string | undefined,
      refererHeader: req.headers.referer as string | undefined,
    });

    res.setHeader('Cache-Control', 'private, no-store');

    if (result.kind === 'manifest') {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.send(result.content);
      return;
    }

    if (process.env.USE_NGINX_ACCEL === 'true') {
      res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('X-Accel-Redirect', result.internalAccelPath);
      res.end();
      return;
    }

    const range = req.headers.range;
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Accept-Ranges', 'bytes');

    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      if (match) {
        const start = Number(match[1]);
        const end = match[2] ? Math.min(Number(match[2]), result.sizeBytes - 1) : result.sizeBytes - 1;
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${result.sizeBytes}`);
        res.setHeader('Content-Length', String(end - start + 1));
        fsSync.createReadStream(result.absFile, { start, end }).pipe(res);
        return;
      }
    }

    res.setHeader('Content-Length', String(result.sizeBytes));
    fsSync.createReadStream(result.absFile).pipe(res);
  }

  @Get('videos/thumbnail/:videoAssetId')
  @SkipCsrf()
  @ApiOperation({ summary: 'Authorized video poster thumbnail delivery' })
  async streamThumbnail(
    @Param('videoAssetId') videoAssetId: string,
    @Query('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const thumb = await this.videoService.resolveThumbnail(
      videoAssetId,
      token,
      req.headers.origin as string | undefined,
      req.headers.referer as string | undefined,
    );
    if (process.env.USE_NGINX_ACCEL === 'true') {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('X-Accel-Redirect', thumb.internalAccelPath);
      res.end();
      return;
    }
    res.setHeader('Content-Type', 'image/jpeg');
    fsSync.createReadStream(thumb.absFile).pipe(res);
  }

  @Post('instructor/media/images')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Upload a course cover or instructor image directly to VPS storage' })
  async uploadCoverImage(
    @CurrentUser() user: AuthenticatedContextUser,
    @Headers('content-type') contentType: string | undefined,
    @Headers('x-file-name') filenameHeader: string | undefined,
    @Query('filename') filenameQuery: string | undefined,
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

    const originalFilename = safeDecode(filenameHeader) || safeDecode(filenameQuery) || 'cover.png';

    if (
      contentType?.includes('application/json') &&
      req.body &&
      typeof req.body === 'object' &&
      !Buffer.isBuffer(req.body) &&
      typeof (req.body as any).base64Data === 'string'
    ) {
      const payload = req.body as { filename?: string; base64Data: string };
      const buf = Buffer.from(payload.base64Data, 'base64');
      return this.videoService.uploadCoverImage({
        userId: user.id,
        userRole: user.role,
        originalFilename: payload.filename || originalFilename,
        buffer: buf,
      });
    }

    const maxBytes = 10 * 1024 * 1024;
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
        if (total > maxBytes) {
          reject(new BadRequestException('يتجاوز حجم الصورة الحد الأقصى (10 ميجابايت)'));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => resolve());
      req.on('error', reject);
    });

    const buffer = Buffer.concat(chunks);
    return this.videoService.uploadCoverImage({
      userId: user.id,
      userRole: user.role,
      originalFilename,
      buffer,
    });
  }

  @Get('media/images/:filename')
  @SkipCsrf()
  @ApiOperation({ summary: 'Serve uploaded public course cover image' })
  servePublicImage(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const resolved = this.videoService.resolvePublicImage(filename);
    res.setHeader('Content-Type', resolved.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fsSync.createReadStream(resolved.absFile).pipe(res);
  }

  @Post('lessons/:lessonId/playback-session/refresh')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Refresh short-lived signed HLS & caption token for an active playback session' })
  refreshPlaybackSession(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('lessonId') lessonId: string,
    @Body() body: { playbackSessionId?: string },
  ) {
    return this.videoService.createLessonPlaybackSession({
      userId: user.id,
      userRole: user.role,
      userRoles: user.roles,
      lessonId,
      authSessionId: user.sessionId,
      existingPlaybackSessionId: body?.playbackSessionId,
    });
  }

  @Post('lessons/:lessonId/playback-heartbeat')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Record clamped active watch-time heartbeat (excludes pause & duplicate bursts)' })
  recordPlaybackHeartbeat(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('lessonId') lessonId: string,
    @Body() body: unknown,
  ) {
    return this.captionsAnalytics.recordHeartbeat(user, lessonId, body);
  }

  @Get('videos/captions/:videoAssetId/:langFile')
  @ApiOperation({ summary: 'Serve authorized WebVTT subtitle track (no searchable transcripts)' })
  async streamCaptionVtt(
    @Param('videoAssetId') videoAssetId: string,
    @Param('langFile') langFile: string,
    @Query('token') token: string | undefined,
    @Headers('origin') originHeader: string | undefined,
    @Headers('referer') refererHeader: string | undefined,
    @Res() res: Response,
  ) {
    const resolved = await this.captionsAnalytics.resolveAuthorizedCaptionFile({
      videoAssetId,
      langFilename: langFile,
      token,
      originHeader,
      refererHeader,
    });
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (process.env.USE_NGINX_ACCEL === 'true') {
      const prefix = process.env.NGINX_INTERNAL_CAPTIONS_PREFIX || '/_internal_captions';
      res.setHeader('X-Accel-Redirect', `${prefix}/${resolved.relKey}`);
      res.end();
      return;
    }
    fsSync.createReadStream(resolved.absFile).pipe(res);
  }

  @Get('videos/:videoAssetId/download')
  @UseGuards(SessionAuthGuard)
  @ApiOperation({ summary: 'Download source video file only when permitted by VideoAsset.isDownloadable & entitlement' })
  async downloadPermittedVideo(
    @CurrentUser() user: AuthenticatedContextUser,
    @Param('videoAssetId') videoAssetId: string,
    @Res() res: Response,
  ) {
    const resolved = await this.captionsAnalytics.resolveAuthorizedVideoDownload(
      user,
      videoAssetId,
    );
    const encodedName = encodeURIComponent(resolved.filename);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="bosla-lecture.mp4"; filename*=UTF-8''${encodedName}`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (process.env.USE_NGINX_ACCEL === 'true') {
      const prefix = process.env.NGINX_INTERNAL_SOURCES_PREFIX || '/_internal_sources';
      res.setHeader('X-Accel-Redirect', `${prefix}/${resolved.relSourcePath}`);
      res.end();
      return;
    }
    fsSync.createReadStream(resolved.absFile).pipe(res);
  }

  @Get('instructor/videos/:videoAssetId/captions')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'List WebVTT subtitle tracks for a video asset' })
  listVideoCaptions(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('videoAssetId') videoAssetId: string,
  ) {
    return this.captionsAnalytics.listVideoCaptions(actor, videoAssetId);
  }

  @Post('instructor/videos/:videoAssetId/captions')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Upload or replace a manual WebVTT subtitle track' })
  uploadVideoCaption(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('videoAssetId') videoAssetId: string,
    @Body() body: unknown,
  ) {
    return this.captionsAnalytics.uploadManualWebVttCaption(actor, videoAssetId, body);
  }

  @Delete('instructor/videos/:videoAssetId/captions/:language')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Remove a WebVTT subtitle track from a video asset' })
  deleteVideoCaption(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('videoAssetId') videoAssetId: string,
    @Param('language') language: string,
  ) {
    return this.captionsAnalytics.deleteVideoCaption(actor, videoAssetId, language);
  }

  @Post('instructor/videos/:videoAssetId/captions/auto-generate')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Enqueue automatic local WebVTT caption generation (never sends video externally)' })
  enqueueAutoCaption(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('videoAssetId') videoAssetId: string,
    @Body() body: unknown,
  ) {
    return this.captionsAnalytics.enqueueAutoCaptionGeneration(actor, videoAssetId, body);
  }

  @Patch('instructor/videos/:videoAssetId/download-policy')
  @UseGuards(SessionAuthGuard, RolesGuard, CsrfGuard)
  @Roles('INSTRUCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Enable or disable downloadable permission for a video asset' })
  updateVideoDownloadPolicy(
    @CurrentUser() actor: AuthenticatedContextUser,
    @Param('videoAssetId') videoAssetId: string,
    @Body() body: unknown,
  ) {
    return this.captionsAnalytics.updateVideoDownloadPolicy(actor, videoAssetId, body);
  }

  @Get('admin/infrastructure/media-health')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Inspect VPS disk capacity, BullMQ processing stats, and bandwidth usage' })
  getMediaHealth() {
    return this.videoService.getInfrastructureHealthForAdmin();
  }
}
