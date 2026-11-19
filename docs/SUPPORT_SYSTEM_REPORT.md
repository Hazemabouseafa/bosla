# BOSLA Academy — Help, Support Ticketing & Executive Analytics Report (v1.2)

## 1. Support Ticketing System (`apps/api/src/modules/support/` & `/support`)
- **Database Tables:** `SupportTicket`, `SupportTicketReply`.
- **Categories & Priorities:** `TECHNICAL`, `BILLING`, `CONTENT`, `CERTIFICATES`, `OTHER` with SLA target windows (`URGENT`: 4h, `HIGH`: 12h, `MEDIUM`: 24h, `LOW`: 48h).
- **Strict Role & Confidentiality Controls:**
  - Students only access their own tickets (`mineOnly` / owner check) and NEVER see internal staff notes (`where: { isInternalNote: false }`).
  - Support staff (`support.manage`) can post public replies OR internal staff notes, update status/priority/assignee, and track SLA — while remaining **strictly prohibited** from approving or executing financial payouts.
- **Safe Attachment Validation:** Ticket reply attachments reject path traversal (`..`), unsafe protocols, and disallowed MIME types (allowlist strictly limited to `image/png`, `image/jpeg`, `image/webp`, `application/pdf`).
- **CSAT Feedback:** Students submit 1–5 star satisfaction ratings via `POST /api/v1/support/tickets/:id/satisfaction`, aggregated into Support KPIs.

## 2. Executive Analytics & KPIs (`GET /api/v1/support/analytics/executive`)
- Real PostgreSQL-backed aggregations surfaced inside `/admin` -> `منظومة الإدارة الشاملة v1.2` -> `التحليلات التنفيذية`:
  - Daily, Monthly, and Annual paid sales in EGP
  - Total users, monthly new signups, active enrollments, lesson completion rate, course waitlist demand
  - B2B organizations count, seat capacity, used seats, and utilization percentage
  - Support ticket totals, open vs resolved counts, and average CSAT score
  - Top Approved Sellers ranked by net commissions and attributed order count
