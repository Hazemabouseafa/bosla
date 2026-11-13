# BOSLA Academy — Security Architecture

## 1. Zero-OTP Authentication Policy
BOSLA Academy deliberately prohibits SMS OTP, email OTP, verification codes, Firebase Phone Auth, and OTP-based password resets.

### Primary Registration Options
- **Option A — Continue with Google (OpenID Connect)**:
  Validates Google ID tokens on the backend via `google-auth-library` against `GOOGLE_CLIENT_ID`, stores the unique provider subject (`sub`), auto-provisions or signs into a `STUDENT` account immediately, and does not force password or Passkey creation. (In `NODE_ENV=test` with `ALLOW_TEST_GOOGLE_TOKENS=true`, deterministic HMAC-signed test tokens are accepted solely for automated backend tests.)
- **Option B — Mobile Number + Password + Mandatory Passkey Enrollment**:
  1. Validates full name, E.164 normalized mobile number, password rules, and explicit acceptance of Terms & Privacy Policy.
  2. Hashes passwords using **Argon2id**.
  3. Creates the account in `ENROLLMENT_PENDING` state until real FIDO2/WebAuthn registration completes via `@simplewebauthn/server` + `@simplewebauthn/browser`.
  4. Never stores private keys on the server—only credential public key, credential ID, signature counter, and authenticator metadata.
  5. Validates cryptographic challenges with expiration, single-use replay consumption, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`, and user verification.
  6. Generates **10 high-entropy single-use recovery codes**, shown to the user once and stored solely as server-side salted/peppered cryptographic hashes (`RECOVERY_CODE_PEPPER`).

## 2. Password Recovery Without OTP
When a student opens `/recovery` ("نسيت كلمة المرور؟"):
- **Method A — Recover with Passkey**: Cryptographic WebAuthn assertion verified against stored public key, issuing a short-lived single-use `resetToken`.
- **Method B — Recover with Single-Use Recovery Code**: Rate-limited via Redis/sliding-window counter (`incrementRateLimit`), verified against stored hashes, atomically invalidated upon consumption, and triggers session revocation upon password reset.
- **Method C — Support-Assisted Recovery**: Audited request stored for manual identity verification and approval/rejection by an `ADMIN`.

Mobile number ownership is never assumed from phone number knowledge alone.

## 3. Session, CSRF & Transport Hardening
- HTTP-only session cookies (`bosla_session`) with `COOKIE_SECURE=true` in HTTPS production deployments.
- State-changing endpoints protected by `CsrfGuard` requiring matching `X-CSRF-Token` derived from active session context (explicit `@SkipCsrf()` applied only to public login/register/recovery/webhook entrypoints).
- Destructive Passkey removal requires recent step-up reauthentication (10-minute window via password or another registered Passkey).
- Helmet security headers enabled on API (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` also reinforced in `infrastructure/nginx/nginx.conf`).

## 4. Authorization & Content Protection
- Backend `SessionAuthGuard` + `RolesGuard` enforce `ADMIN`, `INSTRUCTOR`, and `STUDENT` privileges on every protected endpoint.
- Instructors can edit only their own courses/assets and cannot self-publish, override review state, or alter membership plans/pricing.
- Private media directories (`uploads-tmp`, `sources`, `hls`, `attachments`, `thumbnails`) reside outside Next.js `public/` and behind Nginx `internal;` locations served only via authorized API checks (`X-Accel-Redirect`) and HMAC-signed short-lived playback tokens.
- Paymob webhooks verify cryptographic `HMAC-SHA512` signatures and deduplicate using `WebhookEvent.externalEventId` before mutating subscription or transaction records.
