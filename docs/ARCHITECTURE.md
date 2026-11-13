# BOSLA Academy — System Architecture

**BOSLA Academy (`أكاديمية بوصلة`)** — *"من الطالب إلى المدير"* — is a full-stack Arabic-first (`dir="rtl"`, `lang="ar"`) enterprise Learning Management System (LMS) tailored for veterinary medicine and agribusiness education.

## Monorepo Layout

```text
bosla-academy/
├── apps/
│   ├── web/        # Next.js 15 App Router frontend + runtime /api proxy handler
│   ├── api/        # NestJS REST API, Swagger/OpenAPI, RBAC, Auth, Paymob, HLS authority
│   └── worker/     # BullMQ background jobs, FFmpeg/FFprobe HLS transcoding, scheduler/cleanup
├── packages/
│   ├── shared/     # Zod schemas, phone E.164 normalization, entitlement & specialization rankers
│   ├── config/     # Environment parsing & validation
│   ├── db/         # Prisma ORM schema, UTF-8 migrations, seed data & PrismaClient export
│   └── ui/         # Shared UI configuration/utilities
├── infrastructure/
│   ├── docker/     # Multi-stage Dockerfiles for api, worker, and web
│   ├── nginx/      # Reverse proxy + internal X-Accel-Redirect HLS/attachment gateway
│   └── scripts/    # Postgres backup, media rsync backup, disk threshold monitor
├── docker-compose.yml      # Production multi-container orchestration (Coolify compatible)
├── docker-compose.dev.yml  # Local Postgres 16 + Redis 7 services
└── docs/                   # Architecture, API, Deployment, Security, Admin/Instructor guides
```

## Core Architectural Decisions

1. **Runtime API Proxy (`apps/web/src/app/api/[...path]/route.ts`)**
   All client API fetches target same-origin `/api/v1/...`. A runtime Node.js App Router route handler reads `INTERNAL_API_URL` at request time (supporting `http://api:4000` inside Docker Compose and custom test ports locally without rebuilding `.next`) and forwards cookies, CSRF headers, binary upload chunks, and HLS streams. Server Components call `serverApiGet()` directly against `INTERNAL_API_URL`.

2. **Strictly Three Educational Content Types**
   `COURSE`, `LEARNING_PATH`, and `DIPLOMA`. Courses live independently and are ordered inside Learning Paths and Diplomas through relational join tables without duplicating content. No `Program` content type exists anywhere in schema, API, or frontend routes (`/programs` returns HTTP 404).

3. **Draft vs. Published Course Versioning**
   Instructors author and update isolated `draftVersion` snapshots with sections, lessons, quizzes, video bindings, and attachments while previously approved learners continue viewing `publishedVersion` without interruption until an `ADMIN` approves and publishes the new version.

4. **Strictly Three User Roles**
   `ADMIN`, `INSTRUCTOR`, and `STUDENT`, enforced on the backend by `SessionAuthGuard`, `RolesGuard`, `@Roles(...)`, and per-resource ownership checks.

5. **Self-Hosted Video Pipeline (`Nginx + FFmpeg + HLS`)**
   - Binary chunked upload sessions stream chunks sequentially into `MEDIA_ROOT/uploads-tmp` without buffering entire videos in memory.
   - Completed uploads move to `MEDIA_ROOT/sources` and trigger a BullMQ job processed by `apps/worker` (`transcodeVideoToHls`) using `ffprobe` + `ffmpeg` to generate adaptive HLS renditions (`480p`/`720p`/`1080p` constrained by source height), master/variant `.m3u8` manifests, `.ts` segments, and JPEG thumbnails.
   - Student playback requests `POST /api/v1/lessons/:lessonId/playback-session`, which checks course entitlement and mints short-lived HMAC-signed playback tokens (`PLAYBACK_TOKEN_TTL_SECONDS`, default 120s). Manifests rewrite `.m3u8`/`.ts` URLs with the token, and in Nginx mode segment requests return `X-Accel-Redirect` to `/_internal_hls/` (`internal;` in Nginx) so media files are never directly exposed.

6. **Database-Driven Specialization Recommender**
   Questions (`SpecializationQuestion`), weighted career domains (`SpecializationDomain`), subfields, and course links (`SpecializationLeaf`) are seeded and manageable in PostgreSQL, ranked server-side by `POST /api/v1/catalog/specialization/rank`.
