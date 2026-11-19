# BOSLA Academy — Internal CRM & Marketing Campaigns Report (v1.2)

## 1. Scope & Section 15 Exclusion Compliance
- Built strictly as an **internal** CRM and campaign attribution system inside PostgreSQL (`apps/api/src/modules/crm/`, integrated into `/admin` -> `CRM والحملات`).
- **Excluded (OUT OF SCOPE per §15):** Tally external forms, WhatsApp Business API, Meta Pixel, Google Analytics, external email/CRM automation platforms. Internal capture endpoints, activity reminders, consent flags, and campaign metrics provide full operational utility plus clean extension hooks.

## 2. Features Delivered
- **Lead Capture & Duplicate Detection:** Public (`POST /api/v1/crm/public/leads`) and internal (`POST /api/v1/crm/leads`) lead creation normalizes phone numbers (`normalizePhoneToE164`) and emails, returning `duplicateDetected: true` and `existingLeadId` whenever a prior lead matches.
- **Customizable Pipeline Stages (`CrmPipelineStage`):** Seeded with `NEW`, `CONTACTED`, `QUALIFIED`, `PROPOSAL`, `WON`, `LOST`, editable via `POST /api/v1/crm/pipeline-stages`.
- **Activity Log & Follow-Up Reminders (`LeadActivity`):** Records calls, notes, follow-up due dates, and stage transitions with overdue follow-up surfacing in `GET /api/v1/crm/leads`.
- **Segmentation & Consent Tracking:** Filter leads by pipeline stage, priority (`LOW`/`MEDIUM`/`HIGH`), interested course, and `consentMarketing` opt-in status.
- **Internal Marketing Campaigns (`MarketingCampaign`):** Tracks budget, spend, linked coupon, lead count, won leads, attributed paid order revenue, computed **CAC** (Customer Acquisition Cost), and **ROAS** (Return on Ad Spend).
