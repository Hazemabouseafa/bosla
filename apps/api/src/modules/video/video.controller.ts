import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
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
import { VideoService } from './video.service';

@ApiTags('Self-Hosted Video Upload & Protected HLS Streaming')
@Controller()
export class VideoController {
  constructor(@Inject(VideoService) private readonly videoService: VideoService) {}

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
    return this.videoService.getUploadSessionStatus(sessionId, user.id);
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
    return this.videoService.cancelUpload(sessionId, user.id);
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
      lessonId,
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
    @Res() res: Response,
  ) {
    const thumb = await this.videoService.resolveThumbnail(videoAssetId, token);
    if (process.env.USE_NGINX_ACCEL === 'true') {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('X-Accel-Redirect', thumb.internalAccelPath);
      res.end();
      return;
    }
    res.setHeader('Content-Type', 'image/jpeg');
    fsSync.createReadStream(thumb.absFile).pipe(res);
  }

  @Get('admin/infrastructure/media-health')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Inspect VPS disk capacity, BullMQ processing stats, and bandwidth usage' })
  getMediaHealth() {
    return this.videoService.getInfrastructureHealthForAdmin();
  }
}
