import { execFile } from 'node:child_process';
import * as fsSync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import {
  VIDEO_QUALITY_PROFILES,
  type VideoQualityProfile,
  selectTranscodeQualities,
} from '@bosla/shared';
import type { PrismaService } from '../../core/prisma.service';
import type { MediaStorageService } from './media-storage.service';

const execFileAsync = promisify(execFile);

const WINGET_FFMPEG_DIR =
  'C:\\Users\\w.i\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-essentials_build\\bin';

export function resolveLocalBinary(binaryName: 'ffmpeg' | 'ffprobe'): string {
  const envKey = binaryName === 'ffmpeg' ? process.env.FFMPEG_PATH : process.env.FFPROBE_PATH;
  if (envKey && fsSync.existsSync(envKey)) {
    return envKey;
  }
  const wingetCandidate = path.join(
    WINGET_FFMPEG_DIR,
    process.platform === 'win32' ? `${binaryName}.exe` : binaryName,
  );
  if (fsSync.existsSync(wingetCandidate)) {
    return wingetCandidate;
  }
  return binaryName;
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
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += await calculateDirectoryBytes(full);
    } else if (entry.isFile()) {
      const stat = await fs.stat(full).catch(() => null);
      total += stat?.size ?? 0;
    }
  }
  return total;
}

// Bounded concurrency queue so VPS CPU/RAM resources are never exhausted by simultaneous uploads
let activeTranscodes = 0;
const pendingQueue: Array<() => void> = [];

async function acquireTranscodeSlot(): Promise<void> {
  const maxConcurrent = Math.max(1, Math.min(2, Number(process.env.FFMPEG_CONCURRENCY || '1')));
  if (activeTranscodes < maxConcurrent) {
    activeTranscodes += 1;
    return;
  }
  await new Promise<void>((resolve) => {
    pendingQueue.push(resolve);
  });
  activeTranscodes += 1;
}

function releaseTranscodeSlot(): void {
  activeTranscodes = Math.max(0, activeTranscodes - 1);
  const next = pendingQueue.shift();
  if (next) next();
}

export async function runLocalHlsTranscode(params: {
  prisma: PrismaService;
  storage: MediaStorageService;
  videoAssetId: string;
}) {
  await acquireTranscodeSlot();
  try {
    await params.storage.ensureDirectories();
    const asset = await params.prisma.videoAsset.findUnique({
      where: { id: params.videoAssetId },
    });
    if (!asset) {
      throw new Error(`أصل الفيديو غير موجود: ${params.videoAssetId}`);
    }

    const sourceAbsPath = params.storage.resolveSafeSubpath(
      params.storage.sourcesDir,
      asset.sourcePath,
    );
    if (!fsSync.existsSync(sourceAbsPath)) {
      throw new Error('ملف الفيديو المصدري غير موجود على وحدة التخزين');
    }

    const ffmpegPath = resolveLocalBinary('ffmpeg');
    const ffprobePath = resolveLocalBinary('ffprobe');
    const ffmpegThreads = Math.max(1, Math.min(4, Number(process.env.FFMPEG_THREADS || '1')));

    const assetHlsDir = params.storage.resolveSafeSubpath(params.storage.hlsDir, asset.id);
    const thumbFilename = `${asset.id}.jpg`;
    const thumbAbsPath = params.storage.resolveSafeSubpath(
      params.storage.thumbnailsDir,
      thumbFilename,
    );

    await params.prisma.videoAsset.update({
      where: { id: asset.id },
      data: {
        status: 'PROCESSING',
        processingProgress: 10,
        processingError: null,
      },
    });

    await fs.rm(assetHlsDir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(assetHlsDir, { recursive: true });

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
      streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
    };
    const videoStream = parsed.streams?.find((s) => s.codec_type === 'video');
    if (!videoStream || !videoStream.width || !videoStream.height) {
      throw new Error('لم يتم العثور على مسار فيديو صالح داخل الملف المرفوع');
    }

    const hasAudio = Boolean(parsed.streams?.some((s) => s.codec_type === 'audio'));
    const rawDuration = Number(parsed.format?.duration ?? 0);
    const durationSeconds = Number.isFinite(rawDuration) ? Math.max(1, Math.round(rawDuration)) : 1;

    await params.prisma.videoAsset.update({
      where: { id: asset.id },
      data: {
        durationSeconds,
        sourceWidth: videoStream.width,
        sourceHeight: videoStream.height,
        processingProgress: 20,
      },
    });

    const captureAtSec = Math.min(2, Math.max(0, Math.floor(durationSeconds / 2)));
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

    const configuredQualities = (process.env.ALLOWED_VIDEO_QUALITIES || '480p,720p,1080p')
      .split(',')
      .map((q) => q.trim())
      .filter((q): q is VideoQualityProfile =>
        (VIDEO_QUALITY_PROFILES as readonly string[]).includes(q),
      );

    const targetProfiles = selectTranscodeQualities(
      videoStream.height,
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
        videoStream.width,
        videoStream.height,
        profile.height,
      );
      const bandwidthBps =
        (profile.videoBitrateKbps + (hasAudio ? profile.audioBitrateKbps : 0)) * 1000;

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

      if (hasAudio) {
        ffmpegArgs.push('-c:a', 'aac', '-b:a', `${profile.audioBitrateKbps}k`, '-ac', '2');
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

      const pct = Math.min(92, Math.round(25 + ((i + 1) / targetProfiles.length) * 65));
      await params.prisma.videoAsset.update({
        where: { id: asset.id },
        data: { processingProgress: pct },
      });
    }

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
        durationSeconds,
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

    // Propagate extracted durationSeconds to any linked lessons that still have durationSeconds = 0
    await params.prisma.lesson.updateMany({
      where: {
        videoAssetId: asset.id,
        durationSeconds: { lte: 0 },
      },
      data: {
        durationSeconds,
      },
    });

    return {
      ...updated,
      sourceSizeBytes: Number(updated.sourceSizeBytes ?? 0n),
      hlsTotalBytes: Number(updated.hlsTotalBytes ?? 0n),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'فشلت معالجة الفيديو';
    await params.prisma.videoAsset
      .update({
        where: { id: params.videoAssetId },
        data: {
          status: 'FAILED',
          processingError: message.slice(0, 1000),
        },
      })
      .catch(() => {});
    throw err;
  } finally {
    releaseTranscodeSlot();
  }
}
