import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { probeVideoMetadata, transcodeVideoToHls } from './transcoder';

const execFileAsync = promisify(execFile);

const WINGET_FFMPEG =
  'C:\\Users\\w.i\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-essentials_build\\bin\\ffmpeg.exe';
const WINGET_FFPROBE =
  'C:\\Users\\w.i\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-essentials_build\\bin\\ffprobe.exe';

async function resolveBin(envPath: string | undefined, winFallback: string, unixFallback: string) {
  if (envPath) return envPath;
  try {
    await fs.access(winFallback);
    return winFallback;
  } catch {
    return unixFallback;
  }
}

describe('Worker HLS Transcoder (Real FFmpeg + FFprobe)', () => {
  let tmpRoot = '';
  let ffmpegPath = 'ffmpeg';
  let ffprobePath = 'ffprobe';

  beforeAll(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'bosla-worker-test-'));
    ffmpegPath = await resolveBin(process.env.FFMPEG_PATH, WINGET_FFMPEG, 'ffmpeg');
    ffprobePath = await resolveBin(process.env.FFPROBE_PATH, WINGET_FFPROBE, 'ffprobe');
  });

  afterAll(async () => {
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('probes 720p MP4 and transcodes to 480p + 720p HLS without upscaling to 1080p', async () => {
    const mediaRoot = path.join(tmpRoot, 'media-1');
    const sourcesDir = path.join(mediaRoot, 'sources');
    await fs.mkdir(sourcesDir, { recursive: true });

    const sourceRel = 'sample-720p.mp4';
    const sourceAbs = path.join(sourcesDir, sourceRel);

    await execFileAsync(ffmpegPath, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=2:size=1280x720:rate=24',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=2',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      sourceAbs,
    ]);

    const probe = await probeVideoMetadata(sourceAbs, ffprobePath);
    expect(probe.width).toBe(1280);
    expect(probe.height).toBe(720);
    expect(probe.durationSeconds).toBeGreaterThanOrEqual(2);
    expect(probe.hasAudio).toBe(true);

    const state: Record<string, any> = {
      id: 'vid_test_720p',
      sourcePath: sourceRel,
      status: 'QUEUED',
    };

    const fakePrisma = {
      videoAsset: {
        findUnique: async ({ where }: any) => (where.id === state.id ? { ...state } : null),
        update: async ({ data }: any) => {
          Object.assign(state, data);
          return { ...state };
        },
      },
    } as any;

    const result = await transcodeVideoToHls({
      prisma: fakePrisma,
      videoAssetId: 'vid_test_720p',
      config: {
        mediaRoot,
        ffmpegPath,
        ffprobePath,
      },
    });

    expect(result.status).toBe('READY');
    expect(result.qualities.map((q) => q.label)).toEqual(['480p', '720p']);
    expect(result.hlsTotalBytes).toBeGreaterThan(0);

    const masterContent = await fs.readFile(result.masterAbsPath, 'utf8');
    expect(masterContent).toContain('480p/index.m3u8');
    expect(masterContent).toContain('720p/index.m3u8');
    expect(masterContent).not.toContain('1080p');

    const playlist720 = await fs.readFile(
      path.join(mediaRoot, 'hls', 'vid_test_720p', '720p', 'index.m3u8'),
      'utf8',
    );
    expect(playlist720).toContain('seg_00000.ts');

    const thumbStat = await fs.stat(result.thumbAbsPath);
    expect(thumbStat.size).toBeGreaterThan(500);
  }, 30000);

  it('transcodes silent video without failing on missing audio stream', async () => {
    const mediaRoot = path.join(tmpRoot, 'media-silent');
    const sourcesDir = path.join(mediaRoot, 'sources');
    await fs.mkdir(sourcesDir, { recursive: true });

    const sourceAbs = path.join(sourcesDir, 'silent-480p.mp4');
    await execFileAsync(ffmpegPath, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=1:size=640x360:rate=24',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      sourceAbs,
    ]);

    const state: Record<string, any> = {
      id: 'vid_silent',
      sourcePath: 'silent-480p.mp4',
      status: 'QUEUED',
    };
    const fakePrisma = {
      videoAsset: {
        findUnique: async () => ({ ...state }),
        update: async ({ data }: any) => {
          Object.assign(state, data);
          return { ...state };
        },
      },
    } as any;

    const result = await transcodeVideoToHls({
      prisma: fakePrisma,
      videoAssetId: 'vid_silent',
      config: { mediaRoot, ffmpegPath, ffprobePath },
    });

    expect(result.status).toBe('READY');
    expect(result.qualities.map((q) => q.label)).toEqual(['480p']);
  }, 30000);
});
