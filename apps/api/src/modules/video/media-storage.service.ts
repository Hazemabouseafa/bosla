import { BadRequestException, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface PlaybackTokenPayload {
  userId: string;
  videoAssetId: string;
  lessonId: string;
  exp: number;
}

@Injectable()
export class MediaStorageService {
  readonly mediaRoot: string;
  readonly uploadTmpDir: string;
  readonly sourcesDir: string;
  readonly hlsDir: string;
  readonly attachmentsDir: string;
  readonly thumbnailsDir: string;

  constructor() {
    this.mediaRoot = path.resolve(
      process.env.MEDIA_ROOT || path.resolve(process.cwd(), '../../storage/media'),
    );
    this.uploadTmpDir = path.resolve(
      process.env.MEDIA_UPLOAD_TMP_DIR || path.join(this.mediaRoot, 'uploads-tmp'),
    );
    this.sourcesDir = path.resolve(
      process.env.MEDIA_SOURCES_DIR || path.join(this.mediaRoot, 'sources'),
    );
    this.hlsDir = path.resolve(
      process.env.MEDIA_HLS_DIR || path.join(this.mediaRoot, 'hls'),
    );
    this.attachmentsDir = path.resolve(
      process.env.MEDIA_ATTACHMENTS_DIR || path.join(this.mediaRoot, 'attachments'),
    );
    this.thumbnailsDir = path.resolve(
      process.env.MEDIA_THUMBNAILS_DIR || path.join(this.mediaRoot, 'thumbnails'),
    );
  }

  async ensureDirectories(): Promise<void> {
    await Promise.all([
      fs.mkdir(this.uploadTmpDir, { recursive: true }),
      fs.mkdir(this.sourcesDir, { recursive: true }),
      fs.mkdir(this.hlsDir, { recursive: true }),
      fs.mkdir(this.attachmentsDir, { recursive: true }),
      fs.mkdir(this.thumbnailsDir, { recursive: true }),
    ]);
  }

  resolveSafeSubpath(baseDir: string, relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (normalized.includes('..') || normalized.includes('\0')) {
      throw new BadRequestException('مسار الملف غير صالح');
    }
    const resolved = path.resolve(baseDir, normalized);
    const resolvedBase = path.resolve(baseDir);
    if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + path.sep)) {
      throw new BadRequestException('محاولة وصول غير مصرح بها للمسار');
    }
    return resolved;
  }

  signPlaybackToken(payload: PlaybackTokenPayload): string {
    const secret =
      process.env.PLAYBACK_TOKEN_SECRET ||
      'dev_only_replace_with_64_char_random_secret_for_hls_playback';
    const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = createHmac('sha256', secret).update(data).digest('base64url');
    return `${data}.${sig}`;
  }

  verifyPlaybackToken(token: string): PlaybackTokenPayload | null {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [data, sig] = parts;
    if (!data || !sig) return null;

    const secret =
      process.env.PLAYBACK_TOKEN_SECRET ||
      'dev_only_replace_with_64_char_random_secret_for_hls_playback';
    const expectedSig = createHmac('sha256', secret).update(data).digest('base64url');

    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return null;
    }

    try {
      const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as PlaybackTokenPayload;
      if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  async getDiskStats(): Promise<{
    mediaRoot: string;
    totalBytes: number;
    freeBytes: number;
    usedPercent: number;
    alertThresholdPercent: number;
    alertTriggered: boolean;
  }> {
    await this.ensureDirectories();
    const threshold = Number(process.env.DISK_ALERT_THRESHOLD_PERCENT || 85);
    try {
      const stat = await fs.statfs(this.mediaRoot);
      const totalBytes = Number(stat.bsize) * Number(stat.blocks);
      const freeBytes = Number(stat.bsize) * Number(stat.bavail);
      const usedBytes = Math.max(0, totalBytes - freeBytes);
      const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;
      return {
        mediaRoot: this.mediaRoot,
        totalBytes,
        freeBytes,
        usedPercent,
        alertThresholdPercent: threshold,
        alertTriggered: usedPercent >= threshold,
      };
    } catch {
      return {
        mediaRoot: this.mediaRoot,
        totalBytes: 0,
        freeBytes: 0,
        usedPercent: 0,
        alertThresholdPercent: threshold,
        alertTriggered: false,
      };
    }
  }
}
