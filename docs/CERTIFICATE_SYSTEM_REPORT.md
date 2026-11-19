# BOSLA Academy — Certificate System Report (v1.2)

## 1. Preserved & Extended Certificate Architecture
- **Preserved Kinds:** `ATTENDANCE_COMPLETION` (automatic upon 100% completion) and `COMPETENCY` (student request routed to Administration & assigned Instructor via `CompetencyCertificateRequest`).
- **Additive v1.2 Enhancements (`packages/db/prisma/schema.prisma`, `apps/api/src/modules/lms-advanced/lms-advanced.service.ts`):**
  - `CertificateTemplate`: customizable Arabic templates (`bosla-attendance-v1`, `bosla-competency-v1`) storing headline, body template, primary/accent colors, logo URL, and signature title (`GET/POST /api/v1/lms/certificates/templates`).
  - `CertificateReissueLog` & `Certificate.reissueCount`: tracks every reissuance with actor, reason, and timestamp (`POST /api/v1/lms/certificates/:id/reissue`, logged to `AuditLog`).
  - `Certificate.revokedAt`: explicit administrative revocation with mandatory reason (`POST /api/v1/lms/certificates/:id/revoke`, `@RequirePermissions('certificates.revoke')`, logged to `AuditLog`).

## 2. Public QR Verification (`/certificates/[code]`)
- `GET /api/v1/lms/certificates/:code/verify` returns certificate metadata, live `isValid` boolean (`!revokedAt`), reissue count, public verification URL, an inline SVG **QR Code** (`qrcode`), and a clear electronic issuance notice without making unapproved government or syndicate accreditation claims.
- `apps/web/src/app/certificates/[code]/page.tsx` renders the verified certificate card, live QR code, reissue indicator, and a prominent danger alert if revoked.
