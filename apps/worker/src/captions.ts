import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { PrismaClient } from '@bosla/db';
import { validateAndNormalizeWebVtt } from '@bosla/shared';

const execFileAsync = promisify(execFile);

export interface CaptionWorkerConfig {
  mediaRoot: string;
  ffmpegPath?: string;
  /**
   * Local self-hosted CLI engine path (e.g., local faster-whisper / whisper.cpp wrapper).
   * Private BOSLA lecture videos are NEVER uploaded to external third-party ASR services.
   * Expected CLI invocation contract: `<whisperCliPath> [...fixedArgs] <inputWavPath> <language> <outputVttPath>`
   */
  whisperCliPath?: string;
  whisperCliFixedArgs?: string[];
  timeoutMs?: number;
}

export async function processAutoCaptionJob(params: {
  prisma: PrismaClient;
  captionTrackId: string;
  config: CaptionWorkerConfig;
}): Promise<{ status: 'READY' | 'BLOCKED' | 'FAILED'; cueCount: number; errorMessageAr?: string }> {
  const { prisma, captionTrackId, config } = params;

  const track = await prisma.videoCaptionTrack.findUnique({
    where: { id: captionTrackId },
    include: {
      videoAsset: {
        select: { id: true, sourcePath: true },
      },
    },
  });

  if (!track || !track.videoAsset) {
    return { status: 'FAILED', cueCount: 0, errorMessageAr: 'مسار الترجمة أو الفيديو غير موجود' };
  }

  const cliPath = (config.whisperCliPath ?? process.env.ASR_WHISPER_CLI_PATH ?? '').trim();
  if (!cliPath) {
    const blockedMsg =
      'التوليد التلقائي للترجمة متوقف حالياً (BLOCKED): لا يوجد محرك تفريغ صوتي محلي (Whisper CLI) مضبوط في ASR_WHISPER_CLI_PATH حفاظاً على خصوصية المحاضرات وعدم إرسالها لأي خدمة خارجية. يمكنك رفع أو تحرير ملف WebVTT يدوياً، أو ضبط المحرك المحلي ثم إعادة المحاولة.';
    await prisma.videoCaptionTrack.update({
      where: { id: track.id },
      data: {
        status: 'BLOCKED',
        errorMessageAr: blockedMsg,
      },
    });
    return { status: 'BLOCKED', cueCount: 0, errorMessageAr: blockedMsg };
  }

  await prisma.videoCaptionTrack.update({
    where: { id: track.id },
    data: {
      status: 'PROCESSING',
      errorMessageAr: null,
    },
  });

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bosla-asr-'));
  try {
    const sourceAbs = path.resolve(config.mediaRoot, 'sources', track.videoAsset.sourcePath);
    const wavPath = path.join(tmpDir, 'audio-16k.wav');
    const outVttPath = path.join(tmpDir, 'generated.vtt');
    const ffmpegBin = config.ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg';
    const timeout = config.timeoutMs ?? 15 * 60 * 1000;

    // Extract 16kHz mono PCM audio for local ASR without touching original video
    await execFileAsync(
      ffmpegBin,
      ['-y', '-i', sourceAbs, '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', wavPath],
      { timeout },
    );

    const cliArgs = [
      ...(config.whisperCliFixedArgs ?? []),
      wavPath,
      track.language,
      outVttPath,
    ];
    await execFileAsync(cliPath, cliArgs, { timeout });

    const rawVtt = await fs.readFile(outVttPath, 'utf8');
    const check = validateAndNormalizeWebVtt(rawVtt);
    if (!check.valid) {
      throw new Error(check.errorAr || 'مخرج محرك الترجمة لا يطابق صيغة WebVTT القياسية');
    }

    const safeLang = track.language.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase() || 'ar';
    const relStorageKey = `${track.videoAsset.id}/${safeLang}.vtt`;
    const destDir = path.resolve(config.mediaRoot, 'captions', track.videoAsset.id);
    await fs.mkdir(destDir, { recursive: true });
    await fs.writeFile(path.join(destDir, `${safeLang}.vtt`), check.normalizedVtt, 'utf8');

    await prisma.videoCaptionTrack.update({
      where: { id: track.id },
      data: {
        status: 'READY',
        storageKey: relStorageKey,
        cueCount: check.cueCount,
        errorMessageAr: null,
        generatedAt: new Date(),
      },
    });

    return { status: 'READY', cueCount: check.cueCount };
  } catch (err: any) {
    const msg =
      typeof err?.message === 'string' && err.message.trim().length > 0
        ? `تعذر توليد الترجمة التلقائية: ${err.message.slice(0, 300)}`
        : 'تعذر توليد الترجمة التلقائية محلياً';
    await prisma.videoCaptionTrack.update({
      where: { id: track.id },
      data: {
        status: 'FAILED',
        errorMessageAr: msg,
      },
    });
    return { status: 'FAILED', cueCount: 0, errorMessageAr: msg };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
