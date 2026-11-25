---
version: 1
slug: "src-components-home-boslaintrohome-tsx"
primary_target: "src/components/home/BoslaIntroHome.tsx"
related_targets: []
---

# Surface Brief: Public Homepage (`/`)

## Visitor Mode
persuade

## Scope & Constraints
- Route: `apps/web/src/app/page.tsx`, `apps/web/src/components/home/BoslaIntroHome.tsx`, `apps/web/src/components/home/HomepageShell.tsx`, `apps/web/src/components/home/BoslaHeroEditorial.tsx`, `apps/web/src/components/home/BoslaCoursesShowcase.tsx`, `apps/web/src/components/home/BoslaPricingSection.tsx`, `apps/web/src/components/home/BoslaTrainersMarquee.tsx`, `apps/web/src/components/home/BoslaPartnersSection.tsx`, `apps/web/src/components/home/BoslaPartnerApplySection.tsx`, `apps/web/src/components/home/BoslaTestimonialsSection.tsx`.
- Remove completely from `/` (DOM, copy, anchors, backgrounds, and ScrollTriggers): Scene 2 («المعيار الميداني» / «العشوائية مكلفة... والتشخيص يبدأ من العينة»), Storytelling journey («رحلة التأهيل التطبيقي في بوصلة» / `#storytelling`), 4 Pillars («أربعة أركان تشغيلية بلغة قرار واحدة» / `#methodology`), Quiet Thesis («المعلومة النظريّة متاحة للجميع... الفارق الحقيقي يبدأ عند قرار اللحظة الميدانية.» / `#thesis-band`), and Progression («من الطالب إلى المدير» / `#elevation`).
- Retain official `bosla-logo.webp` unchanged and keep 100% live DB/CMS & Live Editor binding without altering dashboards, auth, payments, or video pipeline.

## Direction contract

THESIS: Inspired by gsap.com and gsap.com/scroll spatial instrument choreography (without copying its dark palette or greens), re-architect `/` as **"بوصلة تحرّك مستقبلك"** — an unmistakably Light Blue (`#CDEAFF`) sky-meridian field layered with `#B7DEFA` sky depths, `#E5F3FF` airy cards, `#4A1FB0` / `#351078` Royal Purple precision compass mechanics, `#152344` Deep Ink Arabic display typography, and restrained `#FFFFFF` highlights (~70% Light Blue, ~20% Purple & Dark Ink, ~10% White).

OWN-WORLD: Primary canvas `#CDEAFF`, structural sky bands `#B7DEFA`, raised panels `#E5F3FF`, primary accents `#4A1FB0`, deep accents `#351078`, text ink `#152344` (`>11:1` on `#CDEAFF`), sparse `#FFFFFF` accents only. Typography blends bold `Alexandria` headings with readable `IBM Plex Sans Arabic`. Connected Arabic letterforms stay intact (animating whole headlines/lines/groups cleanly).

STORY & SCROLL STORYBOARD:
- State 1 (0% scroll): Bold corner-anchored monumental headline + bracketed manifesto + primary jump CTA + interactive SVG compass instrument (`#CDEAFF` dominant), immediately visible with zero blocking reveal walls.
- State 2 (scroll start): Desktop/tablet stage pins smoothly for a tight span (`+=105%`), rotating compass rotor/meridians reversibly (`scrub`), translating multi-speed parallax sky layers & framed academy portholes, shifting typographic groups smoothly with live azimuth gauge progress (`000° -> 180°`). Mobile executes clean unpinned scroll-linked rotation/parallax.
- State 3 (handoff to `#courses-showcase`): The compass bridge container expands into position presenting real DB course/path anchors, unpinning smoothly straight into `#courses-showcase` (courses filter/search, stepped learning paths rail, structured diplomas spread), followed cleanly by `#pricing`, `#trainers`, `#testimonials`, `#partners`, `#partner-apply`, `#faqs`, and `#contact`.

FINISH: Verify via real browser scroll screenshots (Start, Mid-Scrub Transition, Catalog Arrival) + short scroll video walkthrough, TypeScript build, integration + Live Editor E2E tests, and Impeccable detect check.
