import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  SESSION_SECRET: z.string().min(16),
  RECOVERY_CODE_PEPPER: z.string().min(16),
  PLAYBACK_TOKEN_SECRET: z.string().min(16),
  APP_URL: z.string().default('http://localhost:3000'),
  API_URL: z.string().default('http://localhost:4000'),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  WEBAUTHN_RP_NAME: z.string().default('BOSLA Academy'),
  WEBAUTHN_RP_ID: z.string().default('localhost'),
  WEBAUTHN_ORIGIN: z.string().default('http://localhost:3000'),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  ALLOW_TEST_GOOGLE_TOKENS: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  PAYMOB_MODE: z.enum(['sandbox', 'live']).default('sandbox'),
  PAYMOB_API_KEY: z.string().optional().default(''),
  PAYMOB_SECRET_KEY: z.string().optional().default(''),
  PAYMOB_PUBLIC_KEY: z.string().optional().default(''),
  PAYMOB_INTEGRATION_ID_CARD: z.string().optional().default(''),
  PAYMOB_INTEGRATION_ID_WALLET: z.string().optional().default(''),
  PAYMOB_IFRAME_ID: z.string().optional().default(''),
  PAYMOB_HMAC_SECRET: z.string().optional().default(''),
  PAYMOB_BASE_URL: z.string().default('https://accept.paymob.com'),
  MEDIA_ROOT: z.string().default('/var/bosla/media'),
  MAX_VIDEO_UPLOAD_BYTES: z.coerce.number().int().positive().default(2147483648),
  INSTRUCTOR_STORAGE_QUOTA_BYTES: z.coerce.number().int().positive().default(21474836480),
  VIDEO_UPLOAD_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24),
  FFMPEG_PATH: z.string().default('ffmpeg'),
  FFPROBE_PATH: z.string().default('ffprobe'),
  FFMPEG_THREADS: z.coerce.number().int().min(1).max(8).default(1),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(1),
  ALLOWED_VIDEO_QUALITIES: z.string().default('480p,720p,1080p'),
  DISK_ALERT_THRESHOLD_PERCENT: z.coerce.number().int().min(50).max(99).default(85),
  NGINX_INTERNAL_HLS_PREFIX: z.string().default('/_internal_hls'),
  NGINX_INTERNAL_ATTACHMENTS_PREFIX: z.string().default('/_internal_attachments'),
  PLAYBACK_TOKEN_TTL_SECONDS: z.coerce.number().int().min(30).max(600).default(120),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, string | undefined> = process.env): AppEnv {
  return envSchema.parse(raw);
}
