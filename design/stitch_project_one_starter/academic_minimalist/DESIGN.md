---
name: Academic Minimalist
colors:
  surface: '#f9f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f9f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeef'
  surface-container-high: '#e8e8e9'
  surface-container-highest: '#e2e2e3'
  on-surface: '#1a1c1d'
  on-surface-variant: '#45474b'
  inverse-surface: '#2f3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#76777b'
  outline-variant: '#c6c6cb'
  surface-tint: '#5d5e63'
  primary: '#06080c'
  on-primary: '#ffffff'
  primary-container: '#1e2024'
  on-primary-container: '#86878c'
  inverse-primary: '#c6c6cb'
  secondary: '#665399'
  on-secondary: '#ffffff'
  secondary-container: '#c5b0fe'
  on-secondary-container: '#523f84'
  tertiary: '#030911'
  on-tertiary: '#ffffff'
  tertiary-container: '#1a2129'
  on-tertiary-container: '#818893'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e7'
  primary-fixed-dim: '#c6c6cb'
  on-primary-fixed: '#1a1c20'
  on-primary-fixed-variant: '#45474b'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#cfbcff'
  on-secondary-fixed: '#210952'
  on-secondary-fixed-variant: '#4e3b80'
  tertiary-fixed: '#dce3ef'
  tertiary-fixed-dim: '#c0c7d2'
  on-tertiary-fixed: '#151c24'
  on-tertiary-fixed-variant: '#404751'
  background: '#f9f9fa'
  on-background: '#1a1c1d'
  surface-variant: '#e2e2e3'
typography:
  display:
    fontFamily: Be Vietnam Pro
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 58px
    letterSpacing: -0.02em
  display-mobile:
    fontFamily: Be Vietnam Pro
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Be Vietnam Pro
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Be Vietnam Pro
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  label-md:
    fontFamily: Be Vietnam Pro
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  gutter-lg: 2rem
  margin: 2rem
  margin-sm: 1rem
  margin-lg: 3.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system delivers a refined, contemporary academic environment tailored for the Faculty of Information Technology at University of Transport and Communications (UTC). The interface balances institutional credibility with modern engineering elegance. 

### Design Philosophy
- **Modern Academic Minimalism**: Moves away from dated, dense government and institutional portals toward an uncluttered, spacious editorial experience.
- **Calm Focus & Legibility**: High whitespace-to-content ratios, soft pastel ambient containers, and disciplined typographical rhythm ensure long-duration digital focus for students, faculty, and researchers.
- **Architectural Structure**: Crisp structural micro-borders (#E2E0EC) combine with generous, humanized radii (16px, 20px, 24px) to suggest precision, technical rigor, and digital craftsmanship.

### Target Audience & Tone
- **Audience**: Computer science undergraduate/graduate students, academic researchers, prospective candidates, and technical faculty.
- **Emotional Response**: Progressive, organized, approachable, focused, and intellectually elevated.

## Colors

The color palette establishes an inviting, warm academic canvas accented by deep ink tones and muted pastel lilacs and skies.

### Palette Architecture
- **Canvas Base (`#FBFBFC`)**: Warm white ground eliminating screen glare while preserving clarity.
- **Primary Ink (`#1E2024`) & Core Deep (`#121316`)**: Rich charcoal blacks utilized for high-priority typography, high-impact buttons, and critical status markers. Replaces pure black to avoid clinical sterility.
- **Secondary / Soft Lilac (`#8E7AC4`)**: Subtle academic accent for interactive states, focused tabs, category badges, and active metadata highlights.
- **Surface Tiers**:
  - `surface-subtle`: `#F3F2F8` (Table headers, inset wells, secondary search containers)
  - `surface-nested`: `#EDEAF5` (Elevated tags, pill badges, active navigation items)
- **Pastel Functional Tints**:
  - `tint-lilac-soft`: `#EAE6F8` (Info cards, badge backgrounds, selected states)
  - `tint-sky`: `#EBF2FE` (Notices, announcements, lab reservation highlights)
- **Structural Border (`#E2E0EC`)**: A low-contrast hairline boundary keeping large layout panels crisp and distinct without visual noise.

## Typography

The type system is powered exclusively by **Be Vietnam Pro**, engineered to deliver native linguistic balance for Vietnamese diacritics while offering crisp, modern geometric neutrality for technical content and code snippets.

### Implementation Principles
- **Vietnamese Typography Optimization**: Diacritic stacking remains balanced without glyph clipping thanks to generous line-height ratios (minimum 1.5x on body text).
- **Hierarchical Balance**: Strict contrast between the weight of display headlines (600–700) and running body text (400) creates effortless scannability across dense academic curriculum pages, schedules, and research publications.
- **Letter Spacing**: Slight negative tracking on titles (`-0.01em` to `-0.02em`) creates optical coherence, while small labels use positive tracking (`+0.01em` to `+0.04em`) for clear uppercase/metadata reading.

## Layout & Spacing

The portal adheres to an airy, intentional structural grid that promotes readability over compact density.

### Grid & Layout Rules
- **Desktop (12 Columns, max-width 1360px)**: 12-column layout with `gutter-lg` (2rem / 32px) and `margin-lg` (3.5rem / 56px) outer bounds. Sidebars (student profiles, department navigation) occupy 3 columns, and primary academic modules occupy 9 columns.
- **Tablet (8 Columns, 768px – 1024px)**: 8-column layout with `gutter` (1.5rem / 24px) and `margin` (2rem / 32px). Two-column modular cards collapse to single or dual stacked cards.
- **Mobile (4 Columns, < 768px)**: 4-column fluid layout with `gutter-sm` (1rem / 16px) and `margin-sm` (1rem / 16px). All modular cards flow into a unified single column.

### Rhythm
- Component interior padding relies on consistent steps: `space-md` (16px) for compact widgets, `space-lg` (24px) for cards, and `space-xl` (40px) for prominent hero and dashboard section blocks.

## Elevation & Depth

Visual depth is achieved through **tonal layering and low-contrast outlines** rather than heavy drop shadows, reinforcing a clean, modern aesthetic.

### Depth Strategy
- **Layer 0 (Base)**: `#FBFBFC` (The infinite canvas).
- **Layer 1 (Card & Section Containers)**: `#FFFFFF` or `#F3F2F8` bound by a solid `1px` border of `#E2E0EC`.
- **Layer 2 (Floating Modals & Dropdowns)**: `#FFFFFF` with an ambient, diffused shadow:
  `box-shadow: 0 12px 32px -4px rgba(30, 32, 36, 0.05), 0 4px 12px -2px rgba(30, 32, 36, 0.03);`
  Border: `1px solid #E2E0EC`.
- **Layer 3 (Active Focus & Insets)**: Soft background transitions to `#EDEAF5` with an accent perimeter ring of `rgba(142, 122, 196, 0.35)`.

## Shapes

The design system incorporates generous, friendly curvature that softens technical data and elevates the digital campus environment.

### Curvature Tokens
- **Standard Corners (`16px` / 1rem)**: Inputs, buttons, data metric cards, dropdown panels, and course chips.
- **Medium Structural (`20px` / 1.25rem)**: Standard dashboard cards, content containers, grade report modules, and modal dialogues.
- **Large Hero Enclosures (`24px` / 1.5rem)**: Primary featured announcements, departmental highlights, and portal hero headers.
- **Pills (`9999px`)**: User status tags, semester badges, filter chips, and interactive pill-buttons.

## Components

### Buttons
- **Primary**: Solid `#1E2024` with `#FFFFFF` text. Height: 44px; Padding: 0 20px; Radius: 16px. Hover: `#121316` with smooth micro-scale (scale 0.99).
- **Secondary**: `#EDEAF5` surface with `#1E2024` text and `1px solid transparent`. Hover: `#EAE6F8`.
- **Ghost / Outline**: Transparent fill, `#1E2024` text, `1px solid #E2E0EC`. Hover: `#F3F2F8`.

### Input Fields & Search Bars
- **Style**: Background `#FFFFFF` or `#F3F2F8`, height 46px, border `1px solid #E2E0EC`, radius 16px. Padding: 0 16px.
- **Focus**: Background `#FFFFFF`, border-color `#8E7AC4`, box-shadow `0 0 0 3px rgba(142, 122, 196, 0.18)`.
- **Placeholder**: Color `#8A8A93`, font-size 14px.

### Cards & Modules
- **Academic Content Card**: Background `#FFFFFF`, radius 20px, border `1px solid #E2E0EC`, padding 24px.
- **Notice Card (Pastel Sky Tint)**: Background `#EBF2FE`, radius 20px, border `1px solid rgba(142, 122, 196, 0.15)`, padding 24px.

### Chips & Badges
- **Status Pills**: Height 28px, radius 9999px, padding 0 12px, font size 11px, font-weight 600.
  - Active/Enrolled: Background `#EAE6F8`, text `#4F3B84`.
  - Open Notice: Background `#EBF2FE`, text `#2A4B82`.
  - Neutral Tag: Background `#F3F2F8`, text `#1E2024`, border `1px solid #E2E0EC`.

### Checkboxes & Radio Buttons
- **Shape**: Checkbox radius 6px; Radio radius 9999px. Dimensions: 20px × 20px.
- **Rest State**: Background `#FFFFFF`, border `1.5px solid #E2E0EC`.
- **Selected State**: Background `#1E2024`, border-color `#1E2024`, icon stroke `#FFFFFF`.

### Lists & Academic Course Schedules
- Divided rows separated by `1px solid #E2E0EC`. Hover state shifts background softly to `#F3F2F8` with a 4px transition curve.
- Left-aligned metadata featuring code badges in monospaced or semibold style with muted credit counts (`#71717A`).