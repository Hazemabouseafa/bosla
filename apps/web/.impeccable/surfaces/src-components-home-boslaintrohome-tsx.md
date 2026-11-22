---
version: 1
slug: "src-components-home-boslaintrohome-tsx"
primary_target: "src/components/home/BoslaIntroHome.tsx"
related_targets: ["src/app/page.tsx","src/components/home/HomepageShell.tsx","src/components/home/BoslaMonolithCanvas.tsx"]
---

# Surface Brief: Public Homepage (`/`)

## Visitor Mode
persuade

## Scope & Constraints
- Route: `apps/web/src/app/page.tsx`, `apps/web/src/components/home/BoslaIntroHome.tsx`, `apps/web/src/components/home/HomepageShell.tsx`, `apps/web/src/components/home/BoslaMonolithCanvas.tsx`, `apps/web/src/components/home/BoslaArchVectors.tsx`
- Strict Content Gate: Zero links, cards, curricula, or teasers for courses, learning paths, diplomas, pricing, or checkout anywhere in header, drawer, sections, interactive graphics, or footer.
- Keep live CMS binding (`titleAr`, `sloganAr`, `subtitleAr`, `whatsapp`, `email`), direct lead submission (`POST /catalog/leads`), account routes (`/login`, `/register`, `/security/passkey-setup`), and legal pages (`/privacy`, `/terms`).
- Retain official `bosla-logo.webp` unchanged and preserve recognizable BOSLA Royal Navy/Indigo + Signature Indigo + Amber/Gold + Clinical Emerald family.

## Direction contract

THESIS: Reject both SaaS bento grids and passive hero banners with floating stock gradients; treat BOSLA's public entry as the **Al-Mizan Architectural Field Atlas**—asymmetrical obsidian-and-limestone spreads anchored by hairline meridian axes, sculptural Kufam display typography, a real-time interactive 3D BOSLA Spire Sculpture (`Three.js` with WebGL drag/scroll slice inspection + SVG/media reduced-motion fallback), and a full-scale Interactive Field Atlas Dossier where visitors switch the four real agricultural & veterinary domains in one curated architectural viewport rather than scanning four equal cards.

OWN-WORLD: Deep Cobalt Obsidian (`#050A24`, `#070D2B`) paired in deliberate editorial polarity shifts against cool Sunlit Field Chalk (`#F2F4FC`), Signature Ultramarine/Indigo (`#4A67F0`, `#7C95FF`, `#8CA2FF`), Calibration Brass Amber (`#F5B94A` on dark / `#9B6508` ink on light for ≥4.5:1 AA contrast), and Emerald (`#77E2B5` / `#0C7A52`), separated strictly by hairline `1px` architectural joints (`rgba(140,162,255,0.18)` / `rgba(7,13,43,0.12)`). Primary type pairing: architectural `Kufam` (weights 500–700) for expressive RTL display headlines + `Beiruti` (weights 400–700) for calm body clarity. Zero pill eyebrow tags above headings, zero card-in-card borders, zero gradient text.

STORY: Within seconds, a student, practicing veterinarian, or agribusiness manager grasps that BOSLA bridges academic theory and operational farm/enterprise execution; inspects the career transition ledger (`من مقعد الدراسة` -> `الممارسة الميدانية` -> `قيادة المنشآت`), explores the four sector pillars (`الطب البيطري` / `إنتاج الدواجن والثروة الحيوانية` / `تغذية الحيوان والعلائق` / `الأجريبيزنس والإدارة التجارية`), interacts with the live WebGL geodesic prism and direct WhatsApp/B2B/individual contact concierge, or enters `/login` / `/register`.

FIRST VIEWPORT: Top minimal architectural navigation rail (`64px`) with unchanged BOSLA emblem + anchor index (`المنطلق`, `التحوّل الميداني`, `ميادين العمل`, `التواصل`) and sharp rectangular action gate (`دخول الأعضاء` / `تسجيل عضوية` or portal jump). Below, asymmetric `min-h-[calc(100svh-64px)]` full-bleed studio atlas frame: left third holds `atlas-hero-studio.webp` (anodized veterinary microscope + brass caliper + amber beam) with razor-clean architectural shadow falloff; start column (right in RTL) commands 45% negative studio space holding a bare monumental `Kufam` statement (`clamp(2.45rem,5vw,4.6rem)`), single crisp sentence of reality, primary action (`ابدأ الانضمام للأكاديمية`), secondary action (`استكشف المنهج التطبيقي`), and a quiet structural datum hairline.

FORM: Candidate 5 of Direction Roll (Architectural Field Atlas paired with Crouwel-informed hairline index precision and Ikebana asymmetric breathing room), `seed:b06f60c3d5e87b71`.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
