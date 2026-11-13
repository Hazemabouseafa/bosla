# BOSLA Academy — REST API Reference

Base URL: `/api/v1`  
Interactive OpenAPI / Swagger documentation is mounted at `/api-docs` when the API server runs (`apps/api/src/main.ts`).

All state-changing authenticated routes validate HTTP-only session cookie (`bosla_session`) + `X-CSRF-Token` header via `SessionAuthGuard` and `CsrfGuard`, except public entrypoints explicitly annotated `@SkipCsrf()`.

## Health & Catalog (`/api/v1/catalog/*`, `/api/v1/health`)
- `GET /api/v1/health`: Service readiness check.
- `GET /api/v1/catalog/home`: Public homepage payload (categories, courses, learning paths, diplomas, instructors, testimonials, partners, FAQs, settings, visible plans, specialization taxonomy & questions).
- `GET /api/v1/catalog/courses`: Filterable list of published courses (`COURSE` content type).
- `GET /api/v1/catalog/courses/:slug`: Published course details with sections, lesson previews, attachments, and published reviews.
- `GET /api/v1/catalog/learning-paths` & `GET /api/v1/catalog/learning-paths/:slug`: Published Learning Paths (`LEARNING_PATH`) ordered by existing courses.
- `GET /api/v1/catalog/diplomas` & `GET /api/v1/catalog/diplomas/:slug`: Published Diplomas (`DIPLOMA`) with hours, course sequence, and final assessments.
- `GET /api/v1/catalog/pages/:slug`: Published CMS static pages (`about`, `contact`, `privacy`, `terms`, `home`).
- `POST /api/v1/catalog/specialization/rank`: Computes top specialization matches from submitted question selections (`@SkipCsrf()`).
- `POST /api/v1/catalog/leads`: Stores individual consultation or corporate B2B training requests (`@SkipCsrf()`).

## Authentication & Passkey Security (`/api/v1/auth/*` — Zero OTP)
- `GET /api/v1/auth/me`: Current session profile, Passkey enrollment requirement flag, registered Passkeys, and CSRF token.
- `POST /api/v1/auth/google`: Google Identity Services OpenID Connect login/registration.
- `POST /api/v1/auth/google/link`: Link Google provider subject to authenticated user.
- `POST /api/v1/auth/register/phone`: Option B E.164 phone + Argon2id password registration creating an `ENROLLMENT_PENDING` account requiring WebAuthn Passkey setup.
- `POST /api/v1/auth/login/phone`: Mobile + Argon2id password authentication.
- `POST /api/v1/auth/passkeys/register/options` & `POST /api/v1/auth/passkeys/register/verify`: FIDO2/WebAuthn Passkey enrollment (activates `ENROLLMENT_PENDING` accounts and issues 10 single-use recovery codes once).
- `POST /api/v1/auth/passkeys/login/options` & `POST /api/v1/auth/passkeys/login/verify`: Passwordless WebAuthn Passkey sign-in.
- `POST /api/v1/auth/reauth/password`, `POST /api/v1/auth/reauth/passkey/options`, `POST /api/v1/auth/reauth/passkey/verify`: Step-up reauthentication required before Passkey deletion (`DELETE /api/v1/auth/passkeys/:id`).
- `POST /api/v1/auth/logout`: Clears session cookie and revokes server session.

## Non-OTP Password Recovery (`/api/v1/auth/recovery/*`)
- `POST /api/v1/auth/recovery/identify`: Discovers available recovery methods (`passkey`, `recoveryCode`, `supportAssisted`) for a normalized E.164 phone without exposing sensitive PII or sending OTPs.
- `POST /api/v1/auth/recovery/passkey/options` & `POST /api/v1/auth/recovery/passkey/verify`: Method A Passkey assertion returning a short-lived `resetToken`.
- `POST /api/v1/auth/recovery/code/verify`: Method B rate-limited single-use hashed recovery code verification returning `resetToken` and consuming the code atomically.
- `POST /api/v1/auth/recovery/reset-password`: Consumes `resetToken`, updates Argon2id password hash, revokes existing sessions, and records security audit event.
- `POST /api/v1/auth/recovery/support-request`: Method C support-assisted recovery ticket creation for Admin verification.

## Student Learning, Quizzes & Certificates (`/api/v1/learning/*`)
- `GET /api/v1/learning/dashboard`: Student active subscription, enrollments, progress summary, diploma submissions, and earned certificates.
- `GET /api/v1/learning/courses/:slug/player`: Entitlement-aware course player payload (unlocks full lessons for subscribed users/instructors/admins or free courses, otherwise limits to `isFreePreview` lessons).
- `POST /api/v1/learning/lessons/:lessonId/progress`: Upserts watched duration/completion state and auto-issues eligible Course/Path/Diploma certificates upon completion.
- `POST /api/v1/learning/quizzes/:quizId/attempts`: Grades student quiz answers, records pass/fail attempt, and returns `issuedCertificate` when completion criteria are met.
- `POST /api/v1/learning/diplomas/assessments/:assessmentId/submissions`: Submits a diploma practical assessment/project for instructor/admin grading.
- `GET /api/v1/learning/certificates/verify/:code`: Public certificate verification lookup by `certificateCode`.
- `GET /api/v1/learning/attachments/:attachmentId/download`: Entitlement-verified lesson attachment download.

## Self-Hosted Video Upload & Protected HLS Streaming (`/api/v1/*`)
- `POST /api/v1/instructor/videos/uploads/initiate`: Starts chunked upload session with MIME, max size, and per-instructor quota enforcement.
- `POST /api/v1/instructor/videos/uploads/:sessionId/chunk`: Streams raw binary chunk at `X-Chunk-Index` / `chunkIndex` offset into temporary storage.
- `GET /api/v1/instructor/videos/uploads/:sessionId`: Returns uploaded chunk indices for resumable upload recovery and asset processing status.
- `POST /api/v1/instructor/videos/uploads/:sessionId/complete` & `POST /api/v1/instructor/videos/uploads/:sessionId/cancel`: Finalizes upload to `MEDIA_ROOT/sources`, creates `VideoAsset`, enqueues BullMQ FFmpeg HLS transcode job, or cleans up cancelled uploads.
- `POST /api/v1/lessons/:lessonId/playback-session`: Verifies active entitlement and mints short-lived HMAC-signed HLS playlist/thumbnail URLs.
- `GET /api/v1/videos/stream/:videoAssetId/*`: Validates HMAC token and dynamic user/subscription access, rewrites `.m3u8` token links, and serves `.ts` segments (via Nginx `X-Accel-Redirect` in production or range stream locally).

## Memberships & Paymob Payments (`/api/v1/*`)
- `GET /api/v1/memberships/plans`: Visible active plans (`MONTHLY`, `ANNUAL`) with included courses, learning paths, and diplomas.
- `GET /api/v1/memberships/me`: Current user's active/past subscriptions and transaction history.
- `POST /api/v1/memberships/checkout`: Creates a `PENDING` payment transaction and returns a Paymob live checkout URL or local Sandbox URL.
- `GET /api/v1/memberships/transactions/:merchantOrderId`: Authoritative payment transaction lookup.
- `POST /api/v1/payments/paymob/webhook`: Paymob callback verifying `HMAC-SHA512` and deduplicating via `WebhookEvent.externalEventId` before activating subscriptions.
- `POST /api/v1/payments/paymob/sandbox-simulate`: Sandbox checkout helper generating real signed HMAC payloads processed through the production verification handler.

## Instructor & Admin Endpoints (`/api/v1/instructor/*`, `/api/v1/admin/*`)
- **Instructor (`INSTRUCTOR` / `ADMIN`)**: Course creation (`POST /instructor/courses`), draft version updates (`PATCH /instructor/courses/:courseId/draft`), submit/withdraw review (`POST /submit`, `/withdraw`), lesson attachment upload/delete, quiz CRUD, course analytics, video asset list.
- **Admin (`ADMIN`)**: Overview KPIs + media storage health, user management & instructor provisioning, editorial queue (`APPROVE`, `REQUEST_CHANGES`, `REJECT`, `publish`, `unpublish`, `schedule`), categories, Learning Paths, Diplomas & submission grading, membership plan revisions, payment logs, support-recovery resolution, certificate revocation, CMS/leads/audit logs.
