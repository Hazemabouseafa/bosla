import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { PrismaClient } from '@bosla/db';
import {
  VIDEO_QUALITY_PROFILES,
  type VideoQualityProfile,
  selectTranscodeQualities,
} from '@bosla/shared';

const execFileAsync = promisify(execFile);

export interface VideoProbeMetadata {
  durationSeconds: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

export interface TranscodePathsConfig {
  mediaRoot: string;
  sourcesDir?: string;
  hlsDir?: string;
  thumbnailsDir?: string;
  ffmpegPath?: string;
  ffprobePath?: string;
  ffmpegThreads?: number;
  allowedQualities?: VideoQualityProfile[];
}

export async function probeVideoMetadata(
  sourceAbsPath: string,
  ffprobePath = process.env.FFPROBE_PATH || 'ffprobe',
): Promise<VideoProbeMetadata> {
  const { stdout } = await execFileAsync(ffprobePath, [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    sourceAbsPath,
  ]);

  const parsed = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{
      codec_type?: string;
      width?: number;
      height?: number;
    }>;
  };

  const videoStream = parsed.streams?.find((s) => s.codec_type === 'video');
  if (!videoStream || !videoStream.width || !videoStream.height) {
    throw new Error('لم يتم العثور على مسار فيديو صالح داخل الملف المرفوع');
  }

  const hasAudio = Boolean(parsed.streams?.some((s) => s.codec_type === 'audio'));
  const rawDuration = Number(parsed.format?.duration ?? 0);
  const durationSeconds = Number.isFinite(rawDuration) ? Math.max(1, Math.round(rawDuration)) : 1;

  return {
    durationSeconds,
    width: videoStream.width,
    height: videoStream.height,
    hasAudio,
  };
}

function resolveEvenScaledDimensions(
  srcWidth: number,
  srcHeight: number,
  targetHeight: number,
): { width: number; height: number } {
  const effectiveTargetHeight = Math.min(srcHeight, targetHeight);
  const evenHeight = Math.max(2, Math.floor(effectiveTargetHeight / 2) * 2);
  const ratioWidth = Math.round((srcWidth * evenHeight) / srcHeight);
  const evenWidth = Math.max(2, Math.floor(ratioWidth / 2) * 2);
  return { width: evenWidth, height: evenHeight };
}

async function calculateDirectoryBytes(dirPath: string): Promise<number> {
  let total = 0;
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += await calculateDirectoryBytes(full);
    } else if (entry.isFile()) {
      const stat = await fs.stat(full);
      total += stat.size;
    }
  }
  return total;
}

export async function transcodeVideoToHls(params: {
  prisma: PrismaClient;
  videoAssetId: string;
  config?: Partial<TranscodePathsConfig>;
}) {
  const mediaRoot = path.resolve(
    params.config?.mediaRoot ||
      process.env.MEDIA_ROOT ||
      path.resolve(process.cwd(), '../../storage/media'),
  );
  const sourcesDir = path.resolve(
    params.config?.sourcesDir ||
      process.env.MEDIA_SOURCES_DIR ||
      path.join(mediaRoot, 'sources'),
  );
  const hlsDir = path.resolve(
    params.config?.hlsDir || process.env.MEDIA_HLS_DIR || path.join(mediaRoot, 'hls'),
  );
  const thumbnailsDir = path.resolve(
    params.config?.thumbnailsDir ||
      process.env.MEDIA_THUMBNAILS_DIR ||
      path.join(mediaRoot, 'thumbnails'),
  );
  const ffmpegPath = params.config?.ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg';
  const ffprobePath = params.config?.ffprobePath || process.env.FFPROBE_PATH || 'ffprobe';
  const rawThreads =
    params.config?.ffmpegThreads ?? Number(process.env.FFMPEG_THREADS || '1');
  const ffmpegThreads = Number.isFinite(rawThreads)
    ? Math.max(1, Math.min(8, Math.floor(rawThreads)))
    : 1;

  const asset = await params.prisma.videoAsset.findUnique({
    where: { id: params.videoAssetId },
  });
  if (!asset) {
    throw new Error(`VideoAsset not found: ${params.videoAssetId}`);
  }

  const normalizedSource = asset.sourcePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalizedSource.includes('..')) {
    throw new Error('Invalid sourcePath detected');
  }
  const sourceAbsPath = path.resolve(sourcesDir, normalizedSource);

  const assetHlsDir = path.join(hlsDir, asset.id);
  const thumbFilename = `${asset.id}.jpg`;
  const thumbAbsPath = path.join(thumbnailsDir, thumbFilename);

  await params.prisma.videoAsset.update({
    where: { id: asset.id },
    data: {
      status: 'PROCESSING',
      processingProgress: 5,
      processingError: null,
    },
  });

  try {
    await Promise.all([
      fs.mkdir(hlsDir, { recursive: true }),
      fs.mkdir(thumbnailsDir, { recursive: true }),
      fs.rm(assetHlsDir, { recursive: true, force: true }),
    ]);
    await fs.mkdir(assetHlsDir, { recursive: true });

    const meta = await probeVideoMetadata(sourceAbsPath, ffprobePath);

    await params.prisma.videoAsset.update({
      where: { id: asset.id },
      data: {
        durationSeconds: meta.durationSeconds,
        sourceWidth: meta.width,
        sourceHeight: meta.height,
        processingProgress: 15,
      },
    });

    // Generate JPEG poster thumbnail
    const captureAtSec = Math.min(2, Math.max(0, Math.floor(meta.durationSeconds / 2)));
    await execFileAsync(ffmpegPath, [
      '-y',
      '-ss',
      String(captureAtSec),
      '-i',
      sourceAbsPath,
      '-vframes',
      '1',
      '-q:v',
      '3',
      thumbAbsPath,
    ]);

    const configuredQualities = (
      params.config?.allowedQualities ??
      (process.env.ALLOWED_VIDEO_QUALITIES || '480p,720p,1080p')
        .split(',')
        .map((q) => q.trim())
        .filter((q): q is VideoQualityProfile =>
          (VIDEO_QUALITY_PROFILES as readonly string[]).includes(q),
        )
    );

    const targetProfiles = selectTranscodeQualities(
      meta.height,
      configuredQualities.length > 0 ? configuredQualities : ['480p', '720p'],
    );

    const generatedVariants: Array<{
      label: VideoQualityProfile;
      width: number;
      height: number;
      bandwidthBps: number;
      playlistRelPath: string;
    }> = [];

    for (let i = 0; i < targetProfiles.length; i += 1) {
      const profile = targetProfiles[i]!;
      const variantDir = path.join(assetHlsDir, profile.name);
      await fs.mkdir(variantDir, { recursive: true });

      const { width, height } = resolveEvenScaledDimensions(
        meta.width,
        meta.height,
        profile.height,
      );
      const bandwidthBps =
        (profile.videoBitrateKbps + (meta.hasAudio ? profile.audioBitrateKbps : 0)) * 1000;

      const playlistPath = path.join(variantDir, 'index.m3u8');
      const segmentPattern = path.join(variantDir, 'seg_%05d.ts');

      const ffmpegArgs = [
        '-y',
        '-threads',
        String(ffmpegThreads),
        '-i',
        sourceAbsPath,
        '-vf',
        `scale=${width}:${height}:flags=lanczos`,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-profile:v',
        'main',
        '-pix_fmt',
        'yuv420p',
        '-b:v',
        `${profile.videoBitrateKbps}k`,
        '-maxrate',
        `${profile.videoBitrateKbps}k`,
        '-bufsize',
        `${profile.videoBitrateKbps * 2}k`,
        '-g',
        '48',
        '-keyint_min',
        '48',
        '-sc_threshold',
        '0',
      ];

      if (meta.hasAudio) {
        ffmpegArgs.push(
          '-c:a',
          'aac',
          '-b:a',
          `${profile.audioBitrateKbps}k`,
          '-ac',
          '2',
        );
      } else {
        ffmpegArgs.push('-an');
      }

      ffmpegArgs.push(
        '-f',
        'hls',
        '-hls_time',
        '4',
        '-hls_playlist_type',
        'vod',
        '-hls_flags',
        'independent_segments',
        '-hls_segment_filename',
        segmentPattern,
        playlistPath,
      );

      await execFileAsync(ffmpegPath, ffmpegArgs);

      generatedVariants.push({
        label: profile.name,
        width,
        height,
        bandwidthBps,
        playlistRelPath: `${profile.name}/index.m3u8`,
      });

      const pct = Math.min(92, Math.round(20 + ((i + 1) / targetProfiles.length) * 70));
      await params.prisma.videoAsset.update({
        where: { id: asset.id },
        data: { processingProgress: pct },
      });
    }

    // Write master.m3u8 linking each generated quality variant
    const masterLines = ['#EXTM3U', '#EXT-X-VERSION:3'];
    for (const v of generatedVariants) {
      masterLines.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${v.bandwidthBps},RESOLUTION=${v.width}x${v.height}`,
      );
      masterLines.push(v.playlistRelPath);
    }
    const masterAbsPath = path.join(assetHlsDir, 'master.m3u8');
    await fs.writeFile(masterAbsPath, `${masterLines.join('\n')}\n`, 'utf8');

    const hlsTotalBytes = await calculateDirectoryBytes(assetHlsDir);

    const updated = await params.prisma.videoAsset.update({
      where: { id: asset.id },
      data: {
        status: 'READY',
        hlsMasterPath: `${asset.id}/master.m3u8`,
        thumbnailPath: thumbFilename,
        qualities: generatedVariants.map((v) => ({
          label: v.label,
          width: v.width,
          height: v.height,
          bandwidthBps: v.bandwidthBps,
        })),
        hlsTotalBytes: BigInt(hlsTotalBytes),
        processingProgress: 100,
        processingError: null,
        processedAt: new Date(),
      },
    });

    return {
      videoAssetId: updated.id,
      status: updated.status,
      durationSeconds: updated.durationSeconds,
      qualities: generatedVariants,
      hlsTotalBytes,
      masterAbsPath,
      thumbAbsPath,
    };
  } catch (err) {
    await fs.rm(assetHlsDir, { recursive: true, force: true }).catch(() => {});
    const message = err instanceof Error ? err.message : 'فشلت معالجة الفيديو';
    await params.prisma.videoAsset.update({
      where: { id: asset.id },
      data: {
        status: 'FAILED',
        processingError: message.slice(0, 1000),
      },
    });
    throw err;
  }
}
