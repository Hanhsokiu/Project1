# UTC Project1 — Design Specification v1.0

> **Reference**: the user-supplied responsive mockup `utc-registration-reference.png` (1536×1024). Exact HEX values are approximations sampled from the raster image, **not official UTC brand color codes**. Prefer authoritative brand assets where available. The phones on the right are presentation mockups, **not elements to recreate within the desktop web app**.

## 1. Goals

Refined Academic Workspace. Premium, legible, efficient, and clearly branded for UTC. Product UX first: visual hierarchy > usability > accessibility > motion > ornament. The source image is visual inspiration, **not permission to create nonfunctional widgets, invented features, fake data or incorrect statuses**.

## 2. Color system

| Token | HEX | Purpose |
|---|---|---|
| `navy-950` | `#001B44` | Sidebar and dark brand surfaces |
| `navy-900` | `#002454` | Sidebar gradient start |
| `navy-800` | `#0B3F7A` | Deep-blue secondary brand tone |
| `sidebar-active` | `#155BA6` | Active nav background |
| `blue-700` | `#075095` | Primary action button, dark interactive blue |
| `blue-600` | `#0D63B8` | Links, icon highlights, focus context |
| `blue-100` | `#E7F2FF` | Info panel and selection wash |
| `gold-500` | `#FFCC0A` | UTC-brand accent, active-nav keyline |
| `canvas` | `#F3F7FE` | Page background |
| `surface` | `#FFFFFF` | Main cards and form fields |
| `surface-muted` | `#F7F9FD` | Subsection background |
| `surface-blue` | `#EEF4FE` | Student identity strip and quiet highlights |
| `border` | `#D9E6F7` | Card boundaries and dividers |
| `border-control` | `#B9CDE4` | Form outlines |
| `text-primary` | `#0D1747` | Heading/body in navy ink |
| `text-secondary` | `#485D77` | Supporting descriptions |
| `text-muted` | `#60738A` | Metadata (contrast-test required) |
| `success-text/bg` | `#12652E` / `#DDF6E4` | Submitted/success state, only if factual |
| `warning-text/bg` | `#995300` / `#FFF1CE` | Deadline or intervention |
| `danger-text/bg` | `#B42332` / `#FFF0F2` | Error, delete/remove action |
| `info-text/bg` | `#0B4F93` / `#E7F2FF` | Informational message |

See `utc-design-tokens.css` for ready-to-merge CSS custom properties.

**Color behavior:** 70% neutral white/pale blue canvas, 20% navy/blue, 10% UTC yellow and status accents (approximate visual balance, not an algorithm). Yellow is an **accent**, never default small text on white; green for verified outcomes only. Avoid heavy gradients, large glows and nested shadows.

## 3. Typography

Use the project's existing `Be Vietnam Pro` setup. Page title: 26–30px desktop, 21–24px mobile, weight 700–750; section title: 16–18px, 650–700; body: 14–16px, 400–500; form labels: 13–14px, 600; metadata: 12–13px *only when tested readable*; main button labels 14px, 600. Line height 1.45–1.6 for running copy; titles about 1.25–1.35. Avoid faux-bold and multiple contrasting font families. Primary body/mobile content ideally ≥14px. Use tabular figures for deadlines and numeric counters when practical.

## 4. Desktop layout

- Global: sidebar about 248px, top bar 56–64px; content max width about 1180px, centered/left aligned in available workspace, with 24–32px breathing room depending on width.
- Sidebar: deep navy, official UTC logo at top, clear label and role, grouped links, 40–44px target rows, active blue panel + 3px yellow keyline. Campus illustration may appear in a subtle reserved lower area but **must not compete with nav, overlap menus or incur heavy download cost**. When content overflows, menu scrolls freely.
- Header: breadcrumbs, term selector, notifications/profile only when functional.
- Context header: page title and short explanatory sentence; optionally a **subtle** UTC building decoration if an approved image exists, otherwise omit.
- Registration context strip: term name, period/dates and one true status; info alert under it if relevant; date is from API, never invented.
- Main grid at wide desktops: form ~2/3 + summary ~1/3; gap 16–24px. Form sections use compact separate cards or grouped panels with clear headings 01/02/03. No unnecessary extra nested cards.
- Contact: identity summary panel + email/phone two columns on desktop, one on mobile. Topic: combobox/select with meaningful long-value display. Preferences: numbered advisor rows, reorder up/down, remove, add the next advisor; target area ≥44px on touch.
- Summary: real submitted record, last update, submission timestamp and priority list, if provided by backend. Supporting rules in quieter secondary panel; use sticky only when viewport allows.
- Remove the bottom row of **five promotional feature tiles** from the actual work page unless it serves a real user task; it is appropriate in a presentation mockup, not everyday software.

## 5. Responsive behavior

| Width | Pattern |
|---|---|
| ≥1280px | Sidebar fixed, two-column work area, relevant summary on right |
| 1024–1279px | Fixed sidebar if viable; tighter main grid or stacked summary if content width is inadequate |
| 768–1023px | Sidebar collapses into accessible drawer; main form uses available width; summary below |
| 375–767px | Mobile header; one column; accessible accordion may collapse finished sections; preference controls remain discoverable |
| 320–374px | 12px page padding; robust wrapping; two-row preference item if needed, no clipped dropdown value without alternative view |

Use container/available-width constraints, not breakpoints alone. Test 1440×900, 1280×800, 1024×768, 768×1024, 390×844, 375×812 and 320×700. No app-wide horizontal scroll. Sticky action footer can be used on mobile only if it respects `env(safe-area-inset-bottom)`, keyboard, focus and adequate bottom padding; it must not cover form contents.

## 6. Interaction system

- Buttons: primary dark blue and white text; secondary white surface with blue border, destructive actions red *icon/control* only when needed. Height about 44px, radius 10px, clear disabled/loading/focus-visible.
- Cards: border `#D9E6F7`, radius 14px, subtle shadow. Avoid “plastic” glass layers.
- Inputs: height ≥44px, label above; border `#B9CDE4`; focus ring visible; inline error tied to input via accessible description; no success tick before validation actually passes.
- Advisor preference list: explicit 1/2/3 rank, name readable, multi-line secondary metadata, 44px touch controls, truthful up/down disable states, no drag-only interaction. If drag added, preserve keyboard path.
- Accordion on mobile: preserve input values when collapsing; on validation error expand the containing panel, focus invalid field. Ensure `aria-expanded`, `aria-controls` and keyboard support.
- UI feedback: loading (never fake), empty states, errors, saved/unsaved status, success after server confirms. Don't display an autosaved timestamp if there is no proven autosave feature.
- Deadline badge: calculate from API dates using agreed local timezone, never hardcode “Còn 4 ngày.” If deadline passed, show expired state instead.

## 7. Critical workflow consistency

The reference mockup shows **“Đã nộp”**, **“Lưu nháp”**, **“Nộp đăng ký”** and an **autosave message** at the same time. This is visually attractive but logically ambiguous. Inspect real API/state machine before rendering these. Define an accurate UI decision table for supported states such as draft, submitted, changes pending, editable submission, and expired **only if actually represented in project logic**. Preserve backend behavior, do not invent state machine transitions. “Còn 4 ngày” in the screenshot is presentation text; actual period/dates can differ from the live system.

## 8. Motion / accessibility / quality

- Hover 120–160ms; dropdown 140–200ms; drawer 200–260ms; modal 180–260ms; preference reorder 160–240ms; ease `cubic-bezier(.2,.7,.2,1)`.
- Animate only opacity/transform where sensible; respect `prefers-reduced-motion` and keep focus visible.
- Target WCAG 2.2 AA with actual audits (contrast, keyboard, accessible names, reduced motion); don't declare AA purely from screenshots.
- Test mobile keyboard open, focus retention, safe-area, touch-target size and long Vietnamese labels.
- No invented search, notification counters, menus, no fake KPI, no decorative buttons lacking action.
- Run real repository typecheck/lint/build/unit tests and Playwright MCP interaction tests on approved data. Use screenshots and compare against this reference **as visual guidance**, not pixel-perfect pixel parity.

## 9. Asset policy

Use the original UTC seal uploaded by the user if available and approved. Do not use logo or university building imagery generated by AI as official identity assets. If no authorized campus photo/illustration exists in the repository, leave the background clean and adapt the composition. Compress/crop imagery and include accessible alt where meaningful. Make the source of these assets explicit in the audit.

## 10. Deliverables and acceptance

- Consistent reusable design tokens and components without full-app override regressions.
- Actual `/registration` implementation (not a screenshot or device mockup) in desktop/tablet/mobile.
- No inaccessible controls, clipped mobile fields, or incorrect submission states.
- Screenshot set before/after at required widths, validation/keyboard/mobile-interaction tests.
- Notes on intentional deviations from the mockup to protect usability/business logic.
- No backend, DB or RBAC change unless separately approved; no secrets; no force-push; no auto-commit.
