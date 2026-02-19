# Background Color Usage Guide

**Goal:** Consistent, purposeful use of existing background colors to create clear visual hierarchy in dark mode.

---

## Core Principle: Elevation = Lightness

In dark mode, **lighter = elevated/floating** and **darker = recessed/inset**.

Elements that float above others should be lighter to catch more "light". Elements that are recessed (like inputs) should be darker.

---

## Current Color Palette

| Variable | Hex | Lightness | Purpose |
|----------|-----|-----------|---------|
| `--portal-bg-darkest` | `#1a1a1a` | 10% | Canvas (base layer), inputs |
| `--portal-bg-readonly` | `#222222` | 13% | Disabled/readonly |
| `--portal-bg-darker` | `#2a2a2a` | 17% | Cards, panels, sidebar |
| `--portal-bg-dark` | `#333333` | 20% | Nested elements, borders |
| `--portal-bg-hover` | `#3a3a3a` | 23% | Hover states |
| `--portal-bg-medium` | `#444444` | 27% | Emphasis, lighter elements |
| `--portal-bg-light` | `#555555` | 33% | Active borders |
| `--portal-bg-lighter` | `#666666` | 40% | High emphasis |

---

## Usage Rules

### Main Canvas (Body/Content Area)

```css
/* The main content area - DARKEST as base */
background: var(--portal-bg-darkest);  /* #1a1a1a */
```

Use for: `body[data-page="admin"]`, `.dashboard-content`

### Sidebar & Global Header (Fixed Elements)

```css
/* Fixed navigation - slightly lighter than canvas */
background: var(--portal-bg-darker);  /* #2a2a2a */
```

Use for: `.sidebar`, `.portal-global-header`

### Cards & Panels (Floating Elements)

```css
/* Cards float above canvas */
background: var(--portal-bg-darker);  /* #2a2a2a */
border: 1px solid var(--portal-bg-dark);
```

Use for: `.stat-card`, `.admin-table-card`, `.overview-panel`

### Nested Elements (Inside Cards)

```css
/* Elements inside cards */
background: var(--portal-bg-dark);  /* #333333 */
```

Use for: table rows, inner sections

### Inputs & Form Fields

```css
/* Inputs are recessed - use darkest */
background: var(--portal-bg-darkest);  /* #1a1a1a */
```

Use for: `input`, `textarea`, `select`

### Hover States

```css
/* Interactive hover - lighter than resting state */
background: var(--portal-bg-dark);  /* #333333 */
```

Or use `var(--portal-bg-hover)` (#3a3a3a) for more contrast.

---

## Hierarchy Pattern

```text
┌─────────────────────────────────────────────────────────────┐
│ Canvas: --portal-bg-darkest (#1a1a1a)                        │  ← DARKEST
│                                                              │
│  ┌────────────┐  ┌─────────────────────────────────────┐   │
│  │ Sidebar    │  │ Card: --portal-bg-darker (#2a2a2a)   │   │  ← Lighter
│  │ --darker   │  │ border: --portal-bg-dark             │   │
│  │ (#2a2a2a)  │  │                                       │   │
│  │            │  │  ┌─────────────────────────────────┐ │   │
│  │            │  │  │ Nested: --portal-bg-dark (#333) │ │   │  ← Lighter still
│  │            │  │  │                                   │ │   │
│  │            │  │  │  ┌─────────────────────────┐    │ │   │
│  │            │  │  │  │ Input: --darkest (#1a1a)│    │ │   │  ← Recessed
│  │            │  │  │  └─────────────────────────┘    │ │   │
│  │            │  │  │                                   │ │   │
│  │            │  │  └─────────────────────────────────┘ │   │
│  │            │  │                                       │   │
│  └────────────┘  └─────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Reference

| Component | Background | Border | Why |
|-----------|------------|--------|-----|
| Page body | `--portal-bg-darkest` | - | Base canvas |
| Dashboard content | `--portal-bg-darkest` | - | Same as body |
| Sidebar | `--portal-bg-darker` | - | Fixed, grounding |
| Global header | `--portal-bg-darker` | - | Fixed, matches sidebar |
| Cards/Panels | `--portal-bg-darker` | `--portal-bg-dark` | Float above canvas |
| Stat cards | `--portal-bg-darker` | `--portal-bg-dark` | Float above canvas |
| Table card | `--portal-bg-darker` | `--portal-bg-dark` | Container |
| Nested/Inner | `--portal-bg-dark` | - | Inside cards |
| Table rows | `--portal-bg-dark` | - | Inside table card |
| Hover state | `--portal-bg-dark` or `--portal-bg-hover` | - | Interactive |
| Inputs | `--portal-bg-darkest` | `--portal-bg-dark` | Recessed |
| Dropdowns | `--portal-bg-darker` | `--portal-bg-dark` | Floating |

---

## Anti-Patterns

### Wrong: Card same as canvas

```css
/* Card doesn't stand out */
body { background: var(--portal-bg-darkest); }
.card { background: var(--portal-bg-darkest); }  /* Same! */
```

### Right: Card lighter than canvas

```css
/* Card floats above canvas */
body { background: var(--portal-bg-darkest); }
.card { background: var(--portal-bg-darker); }  /* Lighter */
```

### Wrong: Inputs same as card

```css
/* Input doesn't look editable */
.card { background: var(--portal-bg-darker); }
.card input { background: var(--portal-bg-darker); }  /* Same! */
```

### Right: Inputs darker (recessed)

```css
/* Input looks inset/editable */
.card { background: var(--portal-bg-darker); }
.card input { background: var(--portal-bg-darkest); }  /* Darker = recessed */
```

---

## Audit Checklist

When reviewing a component, check:

- [ ] Is the canvas the darkest element?
- [ ] Do cards/panels float above canvas (lighter)?
- [ ] Are nested elements lighter than their container?
- [ ] Are inputs darker (recessed) than their container?
- [ ] Do hover states provide visible feedback (lighter)?
- [ ] Are borders using `--portal-bg-dark` for subtle definition?
