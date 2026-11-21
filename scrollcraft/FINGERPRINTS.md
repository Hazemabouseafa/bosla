# Fingerprints

Every site you build with **scroll-craft** gets one row here, appended after it
ships. The registry exists so your next build can prove it is a different page
rather than a re-skin of one you already made.

This file is **yours**. It starts empty on purpose: the gate is about not
repeating *yourself*, so it has nothing to say until you have built something.

The rules and the gate live in the skill's
`references/uniqueness.md`. Short version:

**A new build must differ from EVERY row below on at least 4 of the 6
dimensions.** Four against each row individually, not four on average across the
table. If a planned build fails, change the plan. Never edit a row to make room
for it.

The six dimensions are: **grammar**, **nav treatment**, **hero device**,
**act-sequence shape**, **close pattern**, **signature move**.

Dimension 6 is free, because a signature move is unique by definition. So the
gate really asks for three more out of the remaining five, and a build that
changes only grammar and world will fail it.

---

## The registry

| Build | Grammar | Nav treatment | Hero device | Act-sequence shape | Close pattern | Signature move | World | Port |
|---|---|---|---|---|---|---|---|---|
| `bosla-academy` | Chaptered Monument × Architectural Polarity Split (5 contrasting exhibition movements) | Top minimal sticky bar + Floating bottom Meridian Horizon Telemetry Rail (`000°→360°`, SVG trace + clickable chapter waypoints) | Asymmetric 3-plane spatial depth (masked portrait + fine-pointer reactive SVG Astrolabe centered on BOSLA logo + open-air magnet CTA) | Flow Hero (100svh) → Pinned Self-Drawing SVG Peak (300svh) → Light Polarity Split & Hairline Manifesto → Telemetry Ruler + Interactive Compass Quiz → Broadsheet + Orbital Gate + B2B Split | Centered orbital BOSLA portal seal monolith + open-air B2B advisory form & hairline `<details>` FAQ archive | Interactive Astrolabe compass needle + Scroll-as-Playhead Bottom Meridian HUD + `--sc-p` stroke-drawn architectural technical blueprint (`BoslaSchematicSvg`) | Photography + Precision Astrolabe Ink (`#050A24` / `#070D2B` / `#7C95FF` / `#EEF0FF` / `#F5B94A`) | 3000 |

---

## What is taken

Add a bullet here whenever a build claims something a later build should avoid
reusing: a grammar, a nav treatment, a close pattern, a signature move, an
act-count-and-length band. The shared columns are what the next build inherits
as a constraint, so writing them down is the whole point.

- `bosla-academy`: Architectural Polarity Inversion Split (`#050A24` → `#EEF0FF` → `#070D2B`), Persistent Bottom Meridian Horizon Rail HUD, Self-Drawing Agriscience Schematic (`BoslaSchematicSvg` scrubbed via `sc:progress`), and Fine-Pointer Astrolabe (`BoslaAstrolabeHeroSvg`) framing genuine BOSLA emblem.

---

## Appending a row

After shipping, add one line to the table and one bullet to **What is taken** if
the build claimed something new. Fill every column. Say what the build shares
with existing rows.

Rows are append-only. A build that has been superseded stays in the table,
because the space it occupies is still occupied.

---

## Worked example

The skill's author kept a registry of twelve builds across eight page grammars.
If you want to see what a filled-in table looks like, and which shapes tend to
collide, read `EXAMPLES.md` in the scroll-craft repository. Treat it as
illustration only: those rows are somebody else's builds and they do **not**
constrain yours.
