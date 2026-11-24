import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { processAutoCaptionJob } from './captions';

const execFileAsync = promisify(execFile);

const WINGET_FFMPEG =
  'C:\\Users\\w.i\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-essentials_build\\bin\\ffmpeg.exe';

async function resolveFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    await fs.access(WINGET_FFMPEG);
    return WINGET_FFMPEG;
  } catch {
    return 'ffmpeg';
  }
}

describe('Worker Automatic WebVTT Subtitle Pipeline (3.G — No Searchable Transcripts)', () => {
  let tmpRoot = '';
  let ffmpegPath = 'ffmpeg';

  beforeAll(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'bosla-caption-test-'));
    ffmpegPath = await resolveFfmpeg();
  });

  afterAll(async () => {
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('marks track BLOCKED honestly when no local ASR CLI engine is configured', async () => {
    const mediaRoot = path.join(tmpRoot, 'media-blocked');
    await fs.mkdir(path.join(mediaRoot, 'sources'), { recursive: true });

    const trackState: Record<string, any> = {
      id: 'cap_blocked_1',
      videoAssetId: 'vid_1',
      language: 'ar',
      labelAr: 'العربية',
      status: 'PENDING',
      source: 'AUTO',
    };

    const fakePrisma = {
      videoCaptionTrack: {
        findUnique: async () => ({
          ...trackState,
          videoAsset: { id: 'vid_1', sourcePath: 'sample.mp4' },
        }),
        update: async ({ data }: any) => {
          Object.assign(trackState, data);
          return { ...trackState };
        },
      },
    } as any;

    const res = await processAutoCaptionJob({
      prisma: fakePrisma,
      captionTrackId: 'cap_blocked_1',
      config: {
        mediaRoot,
        ffmpegPath,
        whisperCliPath: '',
      },
    });

    expect(res.status).toBe('BLOCKED');
    expect(trackState.status).toBe('BLOCKED');
    expect(trackState.errorMessageAr).toContain('Whisper');
  });

  it('extracts audio with real FFmpeg and stores validated WebVTT when local ASR CLI is configured', async () => {
    const mediaRoot = path.join(tmpRoot, 'media-local-asr');
    const sourcesDir = path.join(mediaRoot, 'sources');
    await fs.mkdir(sourcesDir, { recursive: true });

    const sourceAbs = path.join(sourcesDir, 'lecture.mp4');
    await execFileAsync(ffmpegPath, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=2:size=320x240:rate=15',
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

    // Local Node mock CLI simulating local Whisper CLI (`node cli.cjs <wavPath> <lang> <outVttPath>`)
    const localCliScript = path.join(tmpRoot, 'local-whisper-stub.cjs');
    await fs.writeFile(
      localCliScript,
      [
        'const fs = require("fs");',
        'const [wavPath, lang, outVttPath] = process.argv.slice(2);',
        'if (!fs.existsSync(wavPath)) process.exit(2);',
        'fs.writeFileSync(outVttPath, "WEBVTT\\n\\n00:00:00.000 --> 00:00:02.000\\nترجمة عربية مولدة محلياً (" + lang + ")\\n", "utf8");',
      ].join('\n'),
      'utf8',
    );

    const trackState: Record<string, any> = {
      id: 'cap_ready_1',
      videoAssetId: 'vid_local_1',
      language: 'ar',
      labelAr: 'العربية',
      status: 'PENDING',
      source: 'AUTO',
    };

    const fakePrisma = {
      videoCaptionTrack: {
        findUnique: async () => ({
          ...trackState,
          videoAsset: { id: 'vid_local_1', sourcePath: 'lecture.mp4' },
        }),
        update: async ({ data }: any) => {
          Object.assign(trackState, data);
          return { ...trackState };
        },
      },
    } as any;

    const res = await processAutoCaptionJob({
      prisma: fakePrisma,
      captionTrackId: 'cap_ready_1',
      config: {
        mediaRoot,
        ffmpegPath,
        whisperCliPath: process.execPath,
        whisperCliFixedArgs: [localCliScript],
      },
    });

    expect(res.status).toBe('READY');
    expect(trackState.status).toBe('READY');
    expect(trackState.cueCount).toBe(1);
    expect(trackState.storageKey).toBe('vid_local_1/ar.vtt');

    const writtenVtt = await fs.readFile(
      path.join(mediaRoot, 'captions', 'vid_local_1', 'ar.vtt'),
      'utf8',
    );
    expect(writtenVtt).toContain('WEBVTT');
    expect(writtenVtt).toContain('ترجمة عربية مولدة محلياً (ar)');
  }, 30000);
});
