---
version: 1
slug: "src-app-admin-page-tsx"
primary_target: "src/app/admin/page.tsx"
related_targets: ["src/components/layout/DashboardShell.tsx","src/components/dashboard/DashboardWidgets.tsx","src/components/ui/primitives.tsx"]
---

# Surface Brief: Admin Control Dashboard (`/admin`)

## Visitor Mode
operate

## Scope & Constraints
- Route & Shared Admin Chrome: `apps/web/src/app/admin/page.tsx`, `apps/web/src/components/layout/DashboardShell.tsx`, `apps/web/src/components/dashboard/DashboardWidgets.tsx`, `apps/web/src/components/ui/primitives.tsx`, and child panels/modals under `apps/web/src/components/admin/` + `apps/web/src/components/community/AdminCommunitiesPanel.tsx`.
- Retain EVERY route, tab (`13` full-admin sections + role-scoped subviews for `SUPPORT`, `FINANCE_OFFICER`, `TRAINING_COORDINATOR`, `ACADEMY_MANAGER`), form field ID (`#ac-*`, `#ap-*`, `#ev-*`, `#fin-target-id`, etc.), API payload, modal/inline workflow, command palette (`Ctrl+K`), E2E test hook (`div.rounded-2xl` selector compatibility in editorial & course panels!), CSV export, and RBAC visibility behavior.

## Direction contract

THESIS: Strip away heavy bubbly Bento glass stacking and noisy spotlight cards that force administrators to scroll past redundant promo tiles; transform `/admin` into an **Architectural Operations Ledger** anchored by clear hairline rules, high-contrast semantic state signals, grouped multi-role navigation, tabular numerals (`Readex Pro`), and immediate inline density across desktop (`1440px`) and mobile (`390px`).

OWN-WORLD: Strict flat layered Cobalt Navy architecture (`#050A24` canvas, `#070D2B` structured sidebar rail & top command bar, `#0B1440` panel plane, `#101C54` interactive surface hover) joined by continuous hairline rules (`1px` `rgba(140,162,255,0.16)`). Shared UI type face: `Readex Pro` (`300..700`, `tabular-nums` enforced across KPIs, EGP currency, percentages, counts, dates). Color works strictly semantically: `#7C95FF` primary action/focus selection, `#F5B94A` pending editorial queues/warnings, `#77E2B5` published/active/verified status, `#FF9CAA` rejected/suspended/danger. Signature move: **Three-Domain Operational Ledger Architecture** — persistent top KPI datum strip with hairline dividers + inline workflow status indicators + instant inline filter/batch-action docking bar + streamlined Overview split pairing performance trends and active course management directly beside pending review & event schedule radar without filler cards.

STORY: Full administrators (`ADMIN`/`SUPER_ADMIN`) and scoped staff (`SUPPORT`, `FINANCE_OFFICER`) immediately see system health, pending review queue counts, revenue trends, and primary actions above the fold, switch across grouped domains cleanly without visual disorientation, trigger `Ctrl+K` quick actions, and execute reviews, course/media/user 360° edits, finance reconciliation, and CMS updates smoothly.

FIRST VIEWPORT: Fixed-width `268px` RTL start rail cleanly grouped into 3 labelled domains (`العمليات التنفيذية`, `المحتوى والبرامج`, `الأعضاء والظهور`) with subtle left/start hairline rule, bottom queue status chip, and compact collapsible mobile drawer; `56px` sticky workspace header combining context breadcrumb, `Ctrl+K` command search bar, primary `إضافة كورس جديد` trigger, refresh button, notifications, and profile link; main stage opening directly onto a clean 4-datum Architectural Pulse Bar + Course & Review Overview Ledger + Trend Chart + Schedule Radar within one coherent desktop viewport.

FORM: Candidate 7 of Operate Roll (Architectural Cobalt Ledger informed by disciplined tabular clarity and hairline cell organization while keeping standard semantic web controls), `seed:b36c43ab5cf920f9`.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
