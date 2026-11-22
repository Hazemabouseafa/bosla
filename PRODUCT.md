# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

1. **Public Visitors & Prospective Members (Public Homepage `/`)**: Veterinary and agricultural college students, recent graduates and field practitioners, and owners or managers of poultry/livestock farms, feed mills, and agribusiness companies evaluating BOSLA Academy's practical ethos, institutional training readiness, and direct onboarding/contact channels.
2. **Administrators & Operational Staff (Admin Dashboard `/admin`)**: Platform administrators (`ADMIN`, `SUPER_ADMIN`) and permission-scoped operational roles (`SUPPORT`, `FINANCE_OFFICER`, `TRAINING_COORDINATOR`, `ACADEMY_MANAGER`) performing daily management across courses, editorial publishing queues, learning paths, diplomas and practical submissions, media/HLS video pipelines, offline events, user 360° accounts and RBAC, memberships and subscriptions, B2B cohorts, seller commissions, CRM pipelines, financial reconciliation, CMS pages, section visibility controls, and audit logs.

## Product Purpose

BOSLA Academy (أكاديمية بوصلة) is a specialized Arabic-language applied educational platform for veterinary medicine, poultry and livestock production, animal nutrition, and agribusiness management. Its purpose is to bridge theoretical academic study with disciplined field operations and commercial decision-making inside an authenticated members portal (`/student`, `/instructor`, `/seller`, `/org`, `/admin`) while keeping the public unauthenticated homepage (`/`) focused strictly on institutional introduction, contact, and account access.

## Positioning

Unlike generic online video course marketplaces or unaccredited social media groups, BOSLA unites four interconnected technical and commercial field pillars under one Arabic RTL academy operated by an enterprise LMS backend—gating curriculum catalogs strictly behind authentication while exposing an editorial brand entry point for serious practitioners and corporate agricultural teams.

## Operating Context

- Full-stack Next.js 15 App Router + React 19 web frontend paired with a NestJS + PostgreSQL backend (`apps/api`) and FFmpeg HLS worker (`apps/worker`).
- Public `/` fetches live CMS copy via `/catalog/pages/home` and `/catalog/pages/contact`, and submits individual or corporate B2B inquiries via `POST /catalog/leads`.
- Authenticated `/admin` renders both full super-admin tabs and role-scoped views strictly determined by RBAC permissions, preserving WebAuthn passkey enrollment flows, live SQL-backed data, E2E test contracts, CSV exports, inline editors, and modal workflows.

## Capabilities and Constraints

- **Homepage Content Gate (Strict)**: The public homepage (`/`) must NOT display or link to courses, learning paths, diplomas, catalogs, curricula, pricing, or checkout/purchasing flows—including across desktop navigation, mobile drawers, interactive widgets, artwork, and footers. Only introduction, institutional narrative, contact (`WhatsApp` / `Email` / lead form), legal pages (`/privacy`, `/terms`), and account links (`/login`, `/register`, `/security/passkey-setup`, or authenticated dashboard jump) belong on `/`.
- **CMS Continuity**: Existing homepage CMS bindings (`titleAr`, hero `sloganAr`, hero `subtitleAr`, contact `whatsapp` and `email`) remain active without inventing overrides that break editorial control.
- **Admin Parity**: All existing tabs, sub-panels (`AdminEnterpriseSuitePanel`, `AdminFinanceProgramsPanel`, `AdminCrmProfessionalPanel`, `AdminOfflineEventsPanel`, `AdminSectionVisibilityPanel`, `AdminMediaControlPanel`, `AdminCmsSettingsPanel`, `AdminUserControlPanel`, `AdminCourseModals`, `AdminCatalogModals`, `AdminMembershipModals`, `AdminCommunitiesPanel`, `AdminCommandPalette`), API payloads, form field IDs, and workflow semantics on `/admin` must remain intact.
- **No Unverified Claims**: Do not invent testimonials, partner logos, accreditations, statistics, cohort counts, or guaranteed outcomes.
- **Protected Routes Scope**: Only the public homepage (`/`) and existing admin dashboard (`/admin` + its shared admin chrome/components) are redesigned; student, instructor, seller, org, and course player routes preserve their functionality and existing scope.

## Brand Commitments

- **Official Asset**: Retain `apps/web/public/images/brand/bosla-logo.webp` unchanged.
- **Core Palette Family**: Retain recognizable BOSLA Royal Navy / Deep Indigo (`#050A24`, `#070D2B`, `#0B1440`, `#0F1A4A`) with Signature Indigo (`#7C95FF` / `#8CA2FF` / `#4A67F0`), Precision Amber (`#F5B94A`), and Clinical Emerald (`#77E2B5`) as core identity anchors, while reinterpreting proportions, luminance contrast, tactile surfaces, and supporting neutrals freely.
- **Language & Script**: Strict Arabic RTL (`dir="rtl"`, `lang="ar"`), authentic Arabic shaping, legible tabular numerals, and non-English-centric layout flow.

## Evidence on Hand

- Verified brand asset: `apps/web/public/images/brand/bosla-logo.webp`.
- Verified contact metadata defaults/fallbacks in code: WhatsApp `+201001226683`, support email `support@boslaagri.com`, Cairo, Egypt.
- Live database data powering `/admin` overview, courses, users, revenue transactions, reconciliation `REC-01`, CRM leads, offline events, and audit logs.
- Absences that must not be fabricated: public student testimonials, third-party partner endorsements (deprecated brand images excluded from homepage claims), external university accreditations, and invented marketing percentages or graduate counters.

## Product Principles

1. Earned trust through clarity and restraint: communicate serious scientific and field discipline without noisy hype or unverified vanity metrics.
2. Strict audience separation: treat `/` as a Persuade/Experience architectural portal into the academy and `/admin` as a high-clarity Operate control center.
3. Truthful bilingual Arabic-first execution: preserve full RTL reading logic, crisp glyph shaping, and tabular data alignment across every device width.
4. Zero operational regression: visual elevation serves comprehension and workflow speed in `/admin` without hiding or altering real data or controls.

## Accessibility & Inclusion

- WCAG AA contrast across dark and luminous surfaces, visible focus outlines, full keyboard navigation (including Ctrl/Cmd+K command palette and Escape dismissal on dialogs/drawers), semantic landmarks/tables, usable ≥44px touch targets on mobile/tablet, and respectful `prefers-reduced-motion` alternatives across 2D and WebGL 3D scenes.
