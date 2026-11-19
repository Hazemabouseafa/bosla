import 'reflect-metadata';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import EmbeddedPostgres from 'embedded-postgres';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/core/prisma.service';
import { configureApp } from '../src/main';
import { transcodeVideoToHls } from '../../worker/src/transcoder';

const execFileAsync = promisify(execFile);

const WINGET_FFMPEG =
  'C:\\Users\\w.i\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-essentials_build\\bin\\ffmpeg.exe';
const WINGET_FFPROBE =
  'C:\\Users\\w.i\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-essentials_build\\bin\\ffprobe.exe';

async function resolveBinary(winPath: string, fallback: string) {
  try {
    await fs.access(winPath);
    return winPath;
  } catch {
    return fallback;
  }
}

async function main() {
  const repoRoot = path.resolve(__dirname, '../../..');
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bosla-e2e-'));
  const pgDir = path.join(tmpDir, 'pg-data');
  const mediaDir = path.join(tmpDir, 'media');
  await fs.mkdir(mediaDir, { recursive: true });

  const ffmpegPath = await resolveBinary(WINGET_FFMPEG, 'ffmpeg');
  const ffprobePath = await resolveBinary(WINGET_FFPROBE, 'ffprobe');
  const dbPort = Number(process.env.E2E_PG_PORT || 54339);
  const apiPort = Number(process.env.E2E_API_PORT || 4100);
  const webPort = Number(process.env.E2E_WEB_PORT || 3000);

  const pg = new EmbeddedPostgres({
    databaseDir: pgDir,
    user: 'bosla_e2e',
    password: 'bosla_e2e_password',
    port: dbPort,
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--no-locale'],
    onLog: () => {},
    onError: () => {},
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase('bosla_academy_e2e');

  const dbUrl = `postgresql://bosla_e2e:bosla_e2e_password@127.0.0.1:${dbPort}/bosla_academy_e2e?schema=public&connection_limit=5&pool_timeout=30`;
  process.env.NODE_ENV = 'test';
  process.env.PORT = String(apiPort);
  process.env.DATABASE_URL = dbUrl;
  process.env.ALLOW_INMEMORY_REDIS = 'true';
  process.env.ALLOW_TEST_GOOGLE_TOKENS = 'true';
  process.env.SESSION_SECRET = 'bosla_e2e_session_secret_64_characters_minimum_required';
  process.env.RECOVERY_CODE_PEPPER = 'bosla_e2e_recovery_pepper_64_characters_minimum';
  process.env.PLAYBACK_TOKEN_SECRET = 'bosla_e2e_playback_secret_64_characters_minimum';
  process.env.PAYMOB_MODE = 'sandbox';
  process.env.PAYMOB_HMAC_SECRET = 'bosla_e2e_paymob_hmac_secret_value';
  process.env.WEBAUTHN_RP_NAME = 'BOSLA Academy';
  process.env.WEBAUTHN_RP_ID = 'localhost';
  process.env.WEBAUTHN_ORIGIN = `http://localhost:${webPort}`;
  process.env.APP_URL = `http://localhost:${webPort}`;
  process.env.API_URL = `http://127.0.0.1:${apiPort}`;
  process.env.CORS_ORIGINS = `http://localhost:${webPort},http://127.0.0.1:${webPort}`;
  process.env.COOKIE_SECURE = 'false';
  process.env.MEDIA_ROOT = mediaDir;
  process.env.FFMPEG_PATH = ffmpegPath;
  process.env.FFPROBE_PATH = ffprobePath;
  process.env.USE_NGINX_ACCEL = 'false';

  const migrationsDir = path.join(repoRoot, 'packages/db/prisma/migrations');
  const migrationDirs = (await fs.readdir(migrationsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const client = pg.getPgClient('bosla_academy_e2e');
  await client.connect();
  for (const dirName of migrationDirs) {
    const migrationSql = await fs.readFile(path.join(migrationsDir, dirName, 'migration.sql'), 'utf8');
    await client.query(migrationSql);
  }
  await client.end();

  const seedPath = path.join(repoRoot, 'packages/db/prisma/seed.ts');
  const tsxBin = path.join(
    repoRoot,
    'node_modules/.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
  );
  await execFileAsync(tsxBin, [seedPath], {
    env: { ...process.env, DATABASE_URL: dbUrl },
    shell: process.platform === 'win32',
  });

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app: INestApplication = moduleRef.createNestApplication();
  await configureApp(app);
  await app.listen(apiPort, '127.0.0.1');
  const prisma = app.get(PrismaService);
  console.log(`[e2e-server] NestJS API listening on http://127.0.0.1:${apiPort}`);

  // Warm up Prisma connection pool & catalog/home before booting Next.js
  const warmRes = await fetch(`http://127.0.0.1:${apiPort}/api/v1/catalog/home`);
  if (!warmRes.ok) {
    throw new Error(`[e2e-server] Warmup /api/v1/catalog/home failed with ${warmRes.status}`);
  }
  console.log('[e2e-server] Warmed up catalog/home HTTP 200');

  // Local FFmpeg HLS worker loop for queued VideoAsset rows when ALLOW_INMEMORY_REDIS=true
  let transcodingBusy = false;
  let shuttingDown = false;
  const workerTimer = setInterval(() => {
    if (transcodingBusy || shuttingDown) return;
    transcodingBusy = true;
    void (async () => {
      try {
        const queued = await prisma.videoAsset.findFirst({
          where: { status: 'QUEUED' },
          orderBy: { createdAt: 'asc' },
        });
        if (queued) {
          console.log(`[e2e-server] Transcoding queued video ${queued.id}...`);
          await transcodeVideoToHls({
            prisma: prisma as any,
            videoAssetId: queued.id,
            config: {
              mediaRoot: mediaDir,
              ffmpegPath,
              ffprobePath,
            },
          });
          console.log(`[e2e-server] Video ${queued.id} READY for HLS playback`);
        }
      } catch (err) {
        console.error('[e2e-server] Worker error:', err);
      } finally {
        transcodingBusy = false;
      }
    })();
  }, 350);

  // Start Next.js production server against the live E2E API
  const nextBin = path.join(repoRoot, 'node_modules/next/dist/bin/next');
  const nextChild: ChildProcess = spawn(
    process.execPath,
    [nextBin, 'start', '-p', String(webPort), '-H', 'localhost'],
    {
      cwd: path.join(repoRoot, 'apps/web'),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(webPort),
        INTERNAL_API_URL: `http://127.0.0.1:${apiPort}`,
        NEXT_PUBLIC_API_URL: '/api/v1',
        NEXT_PUBLIC_APP_URL: `http://localhost:${webPort}`,
      },
      stdio: 'inherit',
    },
  );

  const cleanup = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(workerTimer);
    try {
      if (!nextChild.killed) nextChild.kill('SIGTERM');
    } catch {
      // Ignore child kill errors
    }
    try {
      await app.close();
    } catch {
      // Ignore Nest shutdown errors
    }
    try {
      await pg.stop();
    } catch {
      // Ignore PG shutdown errors
    }
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    process.exit(0);
  };

  process.on('SIGINT', () => void cleanup());
  process.on('SIGTERM', () => void cleanup());
  nextChild.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`[e2e-server] Next.js exited unexpectedly with code ${code}`);
      void cleanup();
    }
  });
}

main().catch((err) => {
  console.error('[e2e-server] Fatal startup error:', err);
  process.exit(1);
});
