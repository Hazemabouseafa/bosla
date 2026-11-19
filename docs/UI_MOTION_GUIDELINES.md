# BOSLA Academy — UI & Motion Guidelines

This document defines the implemented visual tokens, contrast rules, motion primitives, and reduced-motion accessibility policies for the BOSLA Academy Next.js frontend (`apps/web`).

---

## 1. Approved Brand Color System

Defined in `apps/web/tailwind.config.ts` and CSS custom properties in `apps/web/src/app/globals.css`:

| Token | Hex | Role |
|---|---|---|
| `--bosla-navy` (`bosla-navy`) | `#06142D` | Primary dark navy header, footer, hero background, dashboard sidebar, highlighted card |
| `--bosla-deep` (`bosla-deep`) | `#081E40` | Secondary dark navy surfaces and subtle dark elevation |
| `--bosla-sapphire` (`bosla-sapphire`) | `#0C2B55` | Hover surface inside dark navy navigation and sidebars |
| `--bosla-primary` (`bosla-primary`) | `#05C6C3` | Signature turquoise accent: primary buttons, scroll progress bar, active progress fill, icons on dark surfaces |
| `bosla-primaryHover` | `#04AAA7` | Hover background for primary turquoise buttons |
| `--bosla-teal-text` (`bosla-tealText`) | `#037A77` | Accessible deep teal for small text links, badges, and numeric callouts on light/white surfaces |
| `--bosla-soft` (`bosla-soft`) | `#D8F8F5` | Soft turquoise wash for active lesson items, highlights, and info callouts |
| `--bosla-amber` (`bosla-amber`) | `#F6B950` | Secondary accent for Diplomas, certificates, and featured highlights |
| `--bosla-bg` (`bosla-bg`) | `#F6F8FC` | Clean canvas background behind white content cards |
| `--bosla-card` (`bosla-card`) | `#FFFFFF` | Clean elevated content surface |
| `--bosla-ink` (`bosla-ink`) | `#102744` | Primary readable dark ink on light surfaces |
| `--bosla-muted` (`bosla-muted`) | `#63728A` | Muted metadata and secondary captions |
| `--bosla-line` (`bosla-line`) | `#E1E8F2` | 1px subtle card and table dividers |

### Contrast Guardrails (WCAG AA)
- **NEVER** place white text on `#05C6C3` backgrounds (contrast ratio is ~2.2:1). Primary turquoise buttons (`variant="primary"`, `bg-bosla-primary`) ALWAYS pair with dark navy text `#06142D` (`9.15:1` contrast).
- **NEVER** use raw `#05C6C3` for small prose links or small body text on white `#FFFFFF`. Use `text-bosla-tealText` (`#037A77`) or `text-bosla-navy` (`#06142D`).

---

## 2. Subtle Cinematic Motion Rules

Implemented in `apps/web/src/app/globals.css` and `apps/web/src/components/motion/ScrollMotionSystem.tsx`:

1. **GPU-Compositor Only**: Animations animate only `transform` and `opacity` (never `width`, `height`, `top`, `left`, or layout properties).
2. **Hero Entrance Sequence**: Staggered classes `.hero-seq-1`, `.hero-seq-2`, `.hero-seq-3`, `.hero-seq-4`, and `.hero-seq-media` complete within `< 1.05s` (`280ms–650ms` durations, short translate distances `<= 16px`).
3. **Single-Pass Scroll Reveals**:
   - `ScrollMotionSystem` adds `html.bosla-motion-ready` on mount.
   - An `IntersectionObserver` observes `[data-reveal]` elements (`threshold: 0.08`, `rootMargin: '0px 0px -30px 0px'`) and sets `data-revealed="true"` once, then unobserves (`unobserve`) so sections never flicker or re-hide on scroll.
   - Optional `.scroll-stagger-1`..`.scroll-stagger-5` delays (`60ms` intervals) stagger card grids.
4. **Thin Scroll Progress Bar**: Fixed `h-[3px]` `#05C6C3` bar along top viewport updated cleanly on `scroll` using passive listeners and `scaleX`.
5. **Native Dialog Entry/Exit**: Uses `<dialog>` with CSS `@starting-style` + `allow-discrete` transitions in `globals.css`.
6. **Card Hover Micro-Interaction**: `.bosla-card-hover` lifts `translateY(-4px)` with refined border highlight on hover only when motion is enabled.

---

## 3. Reduced Motion Accessibility (`prefers-reduced-motion`)

- Motion CSS rules in `globals.css` are **opt-in** under `@media (prefers-reduced-motion: no-preference)`.
- Under `@media (prefers-reduced-motion: reduce)`:
  - Hero sequence elements, reveal elements, scroll progress bar transform transitions, and card hover lift transitions remain static (`opacity: 1; transform: none;`).
  - `ScrollMotionSystem.tsx` detects `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, sets `data-revealed="true"` immediately on all `[data-reveal]` nodes, and disables the scroll progress scale updater.

---

## 4. Layout, RTL & Navigation Engineering

- Root `<html lang="ar" dir="rtl">` enforces full Arabic RTL mirroring.
- Logical spacing utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`) replace physical left/right utilities.
- `DashboardShell.tsx` (`apps/web/src/components/layout/DashboardShell.tsx`) anchors a dark navy `#06142D` RTL sidebar (`264px` desktop) alongside `#F6F8FC` white workspaces across `/student`, `/student/settings`, `/instructor`, `/instructor/videos`, `/instructor/courses/[courseId]`, and `/admin`.
- Single semantic navigation tree inside `DashboardShell` prevents duplicate accessible button/link targets across responsive breakpoints.
