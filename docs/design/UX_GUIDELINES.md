# UX Guidelines

## Table of Contents

1. [Overview](#overview)
2. [Design Principles](#design-principles)
3. [Typography Standards](#typography-standards)
4. [Icon Usage](#icon-usage)
5. [Visual Elements](#visual-elements)
6. [Button Standards](#button-standards)
7. [Form Standards](#form-standards)
8. [Spacing Standards](#spacing-standards)
9. [Feedback & States](#feedback--states)
10. [Accessibility](#accessibility)
11. [User Preferences](#user-preferences)

---

## Overview

This document defines the user experience standards for the project. All UI implementations must follow these guidelines to ensure consistency and usability.

**Last Updated:** February 7, 2026

---

## Design Principles

Following Dieter Rams' Ten Principles of Good Design:

### 1. Good design is innovative

Developing new opportunities for original designs in tandem with improving technology.

### 2. Good design makes a product useful

Satisfies functional, psychological, and aesthetic criteria.

### 3. Good design is aesthetic

Integral to product usefulness; well-executed objects can be beautiful.

### 4. Good design makes a product understandable

Clarifies structure and expresses function intuitively.

### 5. Good design is unobtrusive

Neutral and restrained, leaving room for user self-expression.

### 6. Good design is honest

Does not manipulate consumers with false promises.

### 7. Good design is long-lasting

Avoids being fashionable; lasts many years.

### 8. Good design is thorough down to the last detail

Shows respect towards the consumer.

### 9. Good design is environmentally friendly

Conserves resources and minimizes pollution.

### 10. Good design is as little design as possible

Less but better; simple as possible but not simpler.

---

## Typography Standards

### Font Families

|Variable|Font|Usage|
|----------|------|-------|
|`--font--acme`|Acme|Headers, card titles, uppercase labels|
|`--font-body`|System fonts|Body text, paragraphs, form inputs|

### Font Sizes (Fluid Typography)

|Token|Value|Usage|
|-------|-------|-------|
|`--font-size-xs`|`clamp(0.75rem, 2vw, 0.875rem)`|Fine print, captions|
|`--font-size-sm`|`clamp(0.875rem, 2.5vw, 1rem)`|Secondary text, labels|
|`--font-size-base`|`clamp(1rem, 3vw, 1.125rem)`|Body text|
|`--font-size-lg`|`clamp(1.125rem, 3.5vw, 1.25rem)`|Emphasis text|
|`--font-size-xl`|`clamp(1.25rem, 4vw, 1.5rem)`|Section headers|
|`--font-size-2xl`|`clamp(1.5rem, 5vw, 2rem)`|Page headers|
|`--font-size-3xl`|`clamp(2rem, 6vw, 3rem)`|Hero text|

### Font Weights

|Weight|Usage|
|--------|-------|
|400|Body text|
|600|Emphasis, buttons, labels|
|700|Headers, stat numbers|

### Text Transform

- **UPPERCASE**: Card headers, buttons, status badges, navigation items
- **Sentence case**: Body text, descriptions, form labels

---

## Icon Usage

### Critical Rule

**NO EMOJIS IN DESIGN - USE LUCIDE ICONS**
All icons must use the Lucide icon library. Never use emojis as visual elements in the UI.

### Icon Sizing

|Size|Pixels|Usage|
|------|--------|-------|
|Small|16px|Inline with text, form field icons|
|Medium|20px|Buttons, navigation items|
|Large|24px|Section headers, feature cards|
|XL|32px|Hero sections, empty states|

### Icon + Text Alignment

- Icons should be vertically centered with adjacent text
- Use `gap: 0.5rem` between icon and text
- Icon color should match or complement text color

### Common Icon Mappings

|Purpose|Lucide Icon|
|---------|-------------|
|Close/Cancel|`X`|
|Edit|`Pencil`|
|Delete|`Trash2`|
|Add/Create|`Plus`|
|Settings|`Settings`|
|User/Profile|`User`|
|Search|`Search`|
|Menu|`Menu`|
|Check/Success|`Check`|
|Warning|`AlertTriangle`|
|Error|`AlertCircle`|
|Info|`Info`|
|Download|`Download`|
|Upload|`Upload`|
|Send|`Send`|
|Eye (show)|`Eye`|
|Eye (hide)|`EyeOff`|

### Enable/Disable Toggle Pattern

All enable/disable toggles use the eye/eye-off icon pattern:

- **Eye icon** = Active/Enabled (click to disable)
- **Eye-off icon** = Inactive/Disabled (click to enable)
- Use `.icon-btn` class with proper `title` and `aria-label`
- Do NOT use text buttons like "Pause/Resume"

**Locations using this pattern:**

- Leads: Scoring rules toggle
- Workflows: Trigger toggle
- Analytics: Schedule toggle, Alert toggle
- Invoices: Recurring invoice toggle

### View Toggle Pattern

All view toggles must include SVG icons alongside text labels:

| View Type | Icon | Description |
|-----------|------|-------------|
| Board/Kanban | Columns layout | 3 vertical rectangles of varying heights |
| List | Horizontal lines | 3 lines with bullet points |
| Table | Grid | Rectangle with dividing lines |
| Grid | 4 squares | 2x2 grid layout |
| Proposals | Document | File with lines |
| Templates | Layout | Rectangle with dividing sections |

**Implementation:** Use the `createViewToggle` component with `iconSvg` property.

---

## Visual Elements

### Borders

- **Standard border**: `4px solid #000000`
- **Light border**: `2px solid var(--color-dark)`
- **Focus border**: `2px solid var(--color-primary)`
- **No border-radius** for cards (brutalist aesthetic)
- **Small radius**: `4px` for inputs and buttons

### Shadows

Use multi-layer shadows for depth:

```css
/* Standard card shadow */
box-shadow:
  20px 6px 30px rgba(0, 0, 0, 0.6),
  8px 8px 16px rgba(0, 0, 0, 0.8),
  3px 3px 6px rgba(0, 0, 0, 0.9);
```

### Color Usage

**Theme-Aware Primary Colors:**

- **Light Mode Primary**: `var(--color-brand-primary)` (#dc2626 - Crimson red)
- **Dark Mode Primary**: `var(--color-brand-primary)` (#00ff41 - Matrix green)
- **Text**: `var(--color-text-primary)`, `var(--color-text-secondary)`, `var(--color-text-tertiary)`
- **Backgrounds**: `var(--color-bg-primary)`, `var(--color-bg-secondary)`, `var(--color-bg-tertiary)`
- **Interactive**: `var(--color-interactive-primary)` with hover and active variants
- **Never hardcode colors** - always use CSS variables

---

## Button Standards

### Button Hierarchy

|Type|Class|Usage|
|------|-------|-------|
|Primary|`.btn-primary`, `.cp-btn-primary`|Main actions (Submit, Save, Confirm)|
|Secondary|`.btn-secondary`|Secondary actions (Cancel, Back)|
|Danger|`.btn-danger`|Destructive actions (Delete)|
|Outline|`.btn-outline`|Tertiary actions|

### Button Sizing

|Size|Class|Padding|
|------|-------|---------|
|Default|`.btn`|`0.75rem 1.5rem`|
|Small|`.btn-sm`|`0.5rem 1rem`|

### Button States

- **Default**: Neutral background with dark border
- **Hover**: Primary color background
- **Active/Pressed**: Slightly darker primary
- **Disabled**: Reduced opacity, no pointer events

### Button Text

- Always UPPERCASE
- Font weight: 600
- Font size: 0.9rem (default), 0.8rem (small)

---

## Form Standards

### Input Fields

- **Width**: 100% of container
- **Padding**: `0.75rem`
- **Border**: `2px solid var(--color-dark)`
- **Border radius**: `4px`
- **Focus state**: Primary color border with subtle shadow

### Password Fields

**All password fields MUST have a view toggle button.**

Implementation pattern:

```html
<div class="cp-password-wrapper">
  <input type="password" class="cp-input" />
  <button type="button" class="cp-password-toggle">
    <!-- Lucide Eye/EyeOff icon -->
  </button>
</div>
```

### Labels

- Position: Above input field
- Font size: `--font-size-sm`
- Font weight: 600
- Text transform: None (sentence case)

### Validation States

|State|Border Color|Message Color|
|-------|--------------|---------------|
|Default|`var(--color-dark)`|-|
|Focus|`var(--color-primary)`|-|
|Error|`var(--color-error-500)`|`var(--color-error-500)`|
|Success|`var(--color-success-500)`|`var(--color-success-500)`|

### Error Messages

- Position: Below input field
- Font size: `--font-size-sm`
- Color: Error color
- Include relevant Lucide icon

---

## Spacing Standards

### Spacing Scale

|Token|Value|Usage|
|-------|-------|-------|
|`--space-xs`|`clamp(0.25rem, 1vw, 0.5rem)`|Tight spacing, inline elements|
|`--space-sm`|`clamp(0.5rem, 2vw, 1rem)`|Form gaps, button groups|
|`--space-md`|`clamp(1rem, 3vw, 1.5rem)`|Card padding, section gaps|
|`--space-lg`|`clamp(1.5rem, 4vw, 2rem)`|Section padding|
|`--space-xl`|`clamp(2rem, 5vw, 3rem)`|Page sections|
|`--space-2xl`|`clamp(3rem, 6vw, 4rem)`|Major sections|

### Component Spacing

|Component|Internal Padding|External Margin|
|-----------|------------------|-----------------|
|Card|`1.5rem`|`0 0 1.5rem 0`|
|Button|`0.75rem 1.5rem`|Context-dependent|
|Input|`0.75rem`|`0 0 1rem 0`|
|Section|`var(--section-padding)`|-|

---

## Feedback & States

### Loading States

- Use spinner animation for async operations
- Show skeleton loaders for content areas
- Disable interactive elements during loading

### Empty States

- Center content vertically and horizontally
- Use large icon (32px+)
- Provide clear message and action button
- Keep text concise

### Success Feedback

- Brief toast notification or inline message
- Green color indicator
- Auto-dismiss after 3-5 seconds

### Error Feedback

- Persistent until user dismisses or fixes
- Red color indicator
- Clear explanation of what went wrong
- Suggested action if applicable

---

## Accessibility

### Color Contrast

- Text on background: minimum 4.5:1 ratio
- Large text (18px+): minimum 3:1 ratio
- Interactive elements: clearly distinguishable

### Focus States

- All interactive elements must have visible focus
- Focus ring: `0 0 0 3px rgba(var(--color-primary-rgb), 0.2)`
- Never remove focus outlines without replacement

### Keyboard Navigation

- All functionality accessible via keyboard
- Logical tab order
- Skip links for main content

### Screen Readers

- Meaningful alt text for images
- ARIA labels for icon-only buttons
- Proper heading hierarchy

### Reduced Motion

Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## User Preferences

### Documented Preferences

The following are explicit user preferences that MUST be maintained:

1. **No emojis in design** - Use Lucide icons instead
2. **All password fields need view toggle button**
3. **GSAP for complex animations** - Not CSS animations
4. **No hardcoded colors** - Always use CSS variables
5. **Semantic class names** - Describe purpose, not appearance

### Theme Support

- Light and dark themes must be supported
- Theme persists via localStorage
- System preference respected as default

---

## Related Documentation

- [CSS Architecture](./CSS_ARCHITECTURE.md) - CSS variables and component classes
- [Animations](./ANIMATIONS.md) - Animation standards and GSAP usage
