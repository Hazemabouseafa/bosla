# BOSLA Academy — Setup, Architectural Disclosures & External Blockers

**Branch:** `feat/audit-video-commerce-certificates`

---

## 1. Honest Architectural Disclosures

1. **Personalized Video Watermark (`3.C`) — Client Overlay vs. Forensic Burn-in:**
   - The moving learner watermark rendered by `BoslaHlsPlayer.tsx` (`data-testid="bosla-video-watermark"`) is a **dynamic client-side HTML/CSS overlay** mounted inside the fullscreen video container.
   - It deters casual screen recording and camera capture while displaying a non-sensitive masked learner code (`USR-<6-char-id> • **1201`), course code, and date without exposing full phone numbers or emails.
   - It is **not** a server-side per-learner forensic video transcode burn-in; a user who modifies the browser DOM via DevTools can hide a client overlay.

2. **Membership Renewal Model (`4.A`) — Term Pass vs. Recurring Card Vaulting:**
   - Memberships (`MONTHLY`, `ANNUAL`) operate as **prepaid term passes (`MANUAL_TERM_RENEWAL`)** settled via Paymob frame/redirect checkout and HMAC webhook verification.
   - Automatic recurring off-session card charging is **not** enabled (`autoRenewSupported: false` in `/api/v1/memberships/me`), because no tokenized recurring card vault webhook flow is configured.

3. **Accredited Program Certificates (`Section 5.3`) — Disabled by Default:**
   - `CertificateKind.ACCREDITED_PROGRAM` is **disabled by default** (`accreditationEnabled: false`).
   - Any attempt to enable an `ACCREDITED_PROGRAM` template or issue an accredited certificate without configuring an authentic `accreditingBodyNameAr` and `authorizationRef` is rejected by `validateAccreditedCertificateIssuance` with `400 Bad Request`.
   - No fabricated accreditation seals, bodies, or reference numbers are shipped in seed data or defaults.

4. **Excluded Scope — Searchable AI Transcription:**
   - Per project instructions, searchable AI transcription (transcript pages, transcript search, and transcription APIs) is **explicitly excluded**. Only timed WebVTT subtitles (`3.G`) are implemented.

---

## 2. Environment Blockers & Exact Setup Commands

### Blocker A — Automatic Speech-to-Text Subtitle Generation (`3.G` Auto ASR Mode)
- **What is verified:**
  - Manual WebVTT (`.vtt`) upload, validation, XSS sanitization, signed playback URLs, and player `<track kind="subtitles">` switching are **100% VERIFIED** end-to-end.
  - The worker pipeline (`apps/worker/src/captions.ts`) is **100% unit-tested** with real FFmpeg 16 kHz mono WAV audio extraction and a mock local Whisper executable (`apps/worker/src/captions.test.ts`).
- **What is blocked locally:**
  - Running automatic speech-to-text on the local Windows workstation against a live Whisper model is **BLOCKED** unless a local Whisper CLI binary (`whisper-cli.exe` / `whisper.cpp` / Python `whisper`) and model file are installed and configured via `ASR_WHISPER_CLI_PATH` (because private course videos must never be uploaded to third-party cloud APIs).
  - When `ASR_WHISPER_CLI_PATH` is unset, `POST /api/v1/instructor/videos/:videoId/captions/auto` records `status = 'BLOCKED'` with a clear Arabic diagnostic message on the `VideoCaptionTrack` row.
- **How to enable local Whisper ASR on the host:**
  ```powershell
  # 1. Install whisper.cpp or OpenAI Whisper CLI locally on the worker host
  # Example with whisper.cpp binary + multilingual model:
  mkdir C:\bosla-asr
  # Place whisper-cli.exe and ggml-base.bin in C:\bosla-asr\

  # 2. Configure environment variables in .env before starting @bosla/worker:
  $env:ASR_WHISPER_CLI_PATH="C:\bosla-asr\whisper-cli.exe"
  $env:ASR_WHISPER_MODEL_PATH="C:\bosla-asr\ggml-base.bin"

  # 3. Start the worker:
  npm run dev --workspace=@bosla/worker
  ```

### Blocker B — Live Nginx Reverse-Proxy Process Execution (`3.D` / `3.E` X-Accel-Redirect)
- **What is verified:**
  - Application-level HMAC-SHA256 signed playback authorization, session revocation checks (`AuthSession.revokedAt`), token refresh, and `Origin`/`Referer` hotlink blocking are **100% VERIFIED** in NestJS (`VideoController.serveHlsFile`, `VideoService.authorizeHlsFile`) and tested in `test/feature-audit.integration.test.ts`.
  - When `MEDIA_USE_X_ACCEL=true`, NestJS sets `X-Accel-Redirect: /_protected_media/hls/...` (or `/_protected_media/captions/...`) instead of streaming directly from Node.js.
  - `infrastructure/nginx/nginx.conf` has been updated with `valid_referers` hotlink protection and `internal;` locations for `/_protected_media/hls/`, `/_protected_media/captions/`, and `/_protected_media/attachments/`.
- **What is blocked locally:**
  - Executing the Nginx binary directly on this Windows workstation is **BLOCKED** because neither `nginx`, `docker`, nor a WSL Linux distribution is installed on the host.
- **How to verify on a Linux / Docker host with Nginx:**
  ```bash
  # Validate nginx.conf syntax:
  nginx -t -c /path/to/bosla-academy/infrastructure/nginx/nginx.conf

  # Enable X-Accel-Redirect in the API service environment:
  export MEDIA_USE_X_ACCEL=true
  export MEDIA_ACCEL_HLS_PREFIX=/_protected_media/hls
  export MEDIA_ACCEL_CAPTIONS_PREFIX=/_protected_media/captions
  export MEDIA_ACCEL_ATTACHMENTS_PREFIX=/_protected_media/attachments
  ```

### Blocker C — Live Paymob Production Merchant Credentials (`4.E`)
- **What is verified:**
  - Full HMAC-SHA512 webhook verification (`PaymobClient.verifyTransactionHmac`), sandbox checkout signature verification, currency mismatch rejection (`400`), idempotent duplicate webhook handling, and out-of-order post-success failure rejection are **100% VERIFIED** in integration tests.
- **What is blocked locally:**
  - Live production card charges are intentionally disabled (`PAYMOB_SANDBOX_MODE=true`) per safety rules.
- **How to configure Paymob staging/production credentials when ready:**
  ```env
  PAYMOB_SANDBOX_MODE=false
  PAYMOB_API_KEY=<your-paymob-api-key>
  PAYMOB_INTEGRATION_ID=<your-paymob-integration-id>
  PAYMOB_IFRAME_ID=<your-paymob-iframe-id>
  PAYMOB_HMAC_SECRET=<your-paymob-hmac-secret>
  ```
