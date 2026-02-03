# WCAG Accessibility Audit - Phase 1

**Date:** February 3, 2026
**Standard:** WCAG 2.1 Level AA
**Pages Audited:** All major pages

---

## Executive Summary

This audit covers accessibility compliance across the no-bhad-codes application. The codebase already includes several accessibility features (ARIA labels, screen reader text, semantic HTML). This document identifies areas for improvement.

**Overall Status:** Mostly Compliant (Minor Issues)

---

## Audit Results by WCAG Criterion

### 1.1 Text Alternatives

| Issue | Severity | Location | Status |
|-------|----------|----------|--------|
| SVG icons have `aria-hidden="true"` | N/A | Throughout | PASS |
| Form inputs have labels | N/A | Forms | PASS |
| Images have alt text | N/A | Images | PASS |

**Findings:** Good use of `aria-hidden` on decorative icons. All interactive SVGs have associated text labels.

---

### 1.3 Adaptable

| Issue | Severity | Location | Status |
|-------|----------|----------|--------|
| Semantic HTML structure | N/A | All pages | PASS |
| Form field groupings | Minor | Modals | Recommend `<fieldset>` |
| Tables have headers | N/A | Data tables | PASS |

**Recommendations:**

- Consider adding `<fieldset>` and `<legend>` for related form field groups in modals
- Ensure data tables use `<th scope="col">` for column headers

---

### 1.4 Distinguishable

| Issue | Severity | Location | Status |
|-------|----------|----------|--------|
| Color contrast | Medium | Status badges | Review needed |
| Color alone for meaning | Medium | Status badges | REVIEW (1.4.1) |
| Text resize | N/A | All pages | PASS (using rem/em) |
| Focus visible | N/A | Interactive elements | PASS |

**Findings - 1.4.1 (Use of Color):**

Status badges currently rely on color to convey meaning:

- `status-active` (green)
- `status-pending` (amber)
- `status-completed` (blue)
- `status-cancelled` (gray)

**Recommendation:** Add visual indicator (icon prefix) to badges. See Phase 4 (Badge Redesign) in implementation plan.

**Findings - 1.4.3 (Contrast):**

Review needed for:

- Muted text (`--portal-text-muted`) against dark backgrounds
- Badge text colors against badge backgrounds

---

### 2.1 Keyboard Accessible

| Issue | Severity | Location | Status |
|-------|----------|----------|--------|
| All interactive elements focusable | N/A | Throughout | PASS |
| Custom dropdowns keyboard navigable | N/A | Dropdowns | PASS |
| Tab panels keyboard navigable | N/A | Tab strips | PASS |
| No keyboard traps | N/A | Modals | PASS |

**Findings:** Good keyboard support implemented:

- Dropdowns support Enter, Space, Escape, Arrow keys
- Modals trap focus correctly
- Tab order is logical

---

### 2.4 Navigable

| Issue | Severity | Location | Status |
|-------|----------|----------|--------|
| Page titles | N/A | All pages | PASS |
| Focus order | N/A | Forms/modals | PASS |
| Link purpose | Minor | Some links | Review |
| Skip links | Medium | Main pages | Missing |

**Recommendation - Skip Links:**

Add skip link at top of pages to jump to main content:

```html
<a href="#main-content" class="skip-link">Skip to main content</a>
```

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  padding: 8px 16px;
  background: var(--color-primary);
  color: white;
  z-index: 1000;
}

.skip-link:focus {
  top: 0;
}
```

---

### 3.2 Predictable

| Issue | Severity | Location | Status |
|-------|----------|----------|--------|
| Consistent navigation | N/A | Admin/Portal | PASS |
| Consistent identification | N/A | UI components | PASS |
| On focus changes | N/A | Form inputs | PASS |

---

### 4.1 Compatible

| Issue | Severity | Location | Status |
|-------|----------|----------|--------|
| Valid HTML | N/A | All pages | PASS |
| Name, role, value | Minor | Custom components | Review |
| Status messages | N/A | Notifications | PASS (`aria-live`) |

**Findings - ARIA Usage:**

Good ARIA implementation found:

- `aria-live="polite"` on message threads
- `role="listbox"` and `role="option"` on thread lists
- `aria-expanded` on dropdowns
- `aria-label` on icon buttons

**Minor improvements:**

- Ensure all `role="listbox"` containers have `aria-activedescendant` for keyboard navigation
- Add `aria-describedby` to complex form fields for additional context

---

## Page-Specific Findings

### Admin Dashboard (`/admin`)

| Feature | Status | Notes |
|---------|--------|-------|
| Sidebar navigation | PASS | Good focus management |
| Tab navigation | PASS | Arrow key support |
| Data tables | PASS | Sortable headers announced |
| Modals | PASS | Focus trap works correctly |
| Messages split-view | PASS | Thread list has proper ARIA |

### Client Portal (`/client/portal`)

| Feature | Status | Notes |
|---------|--------|-------|
| Navigation | PASS | Clear active states |
| Dashboard cards | PASS | Semantic structure |
| Messages | PASS | Live region for updates |
| File uploads | PASS | Progress announced |

### Client Intake (`/client/intake`)

| Feature | Status | Notes |
|---------|--------|-------|
| Form structure | PASS | Labels present |
| Validation errors | PASS | Associated with fields |
| Progress indication | Minor | Consider aria-valuenow |

### Set Password (`/client/set-password`)

| Feature | Status | Notes |
|---------|--------|-------|
| Password field | PASS | Has visibility toggle |
| Form validation | PASS | Errors announced |

---

## Priority Actions

### Critical (Must Fix)

None identified - no critical WCAG failures found.

### High Priority

1. **Add skip links** to main pages (2.4.1)
2. **Badge icon indicators** for status (1.4.1) - Pending design decision

### Medium Priority

3. **Review color contrast** for muted text and badges (1.4.3)
4. **Add fieldset/legend** to form groups in modals (1.3.1)

### Low Priority

5. Add `aria-describedby` for complex form fields
6. Add `aria-activedescendant` to listbox components

---

## Testing Tools Recommended

For ongoing accessibility testing:

1. **axe-core** - Automated accessibility testing

   ```bash
   npm install --save-dev @axe-core/playwright
   ```

2. **Lighthouse** - Built into Chrome DevTools
3. **WAVE** - Browser extension for manual review
4. **NVDA/VoiceOver** - Screen reader testing

---

## Integration with E2E Tests

Add accessibility checks to Playwright tests:

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('admin dashboard has no accessibility violations', async ({ page }) => {
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});
```

---

## Appendix: ARIA Patterns Used

### Thread List Pattern

```html
<div class="thread-list" role="listbox" aria-label="Client conversations">
  <div class="thread-item" role="option" aria-selected="true" tabindex="0">
    <!-- content -->
  </div>
</div>
```

### Modal Dialog Pattern

```html
<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <h2 id="modal-title">Modal Title</h2>
  <!-- content -->
</div>
```

### Live Region Pattern

```html
<div class="messages-thread" aria-live="polite" aria-atomic="false">
  <!-- messages dynamically added here are announced -->
</div>
```

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-02-03 | Initial Phase 1 audit | Claude |
