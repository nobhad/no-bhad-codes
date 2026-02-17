# Component Library Documentation

**Last Updated:** February 15, 2026

---

## Component Inventory with Visual Examples

| Component            | Description                  | Example Preview |
|----------------------|------------------------------|----------------|
| ButtonComponent      | Standard button UI           | ![Button Preview](../mockups/3d-button-preview.html) |
| ModalComponent       | Modal dialog                 | ![Modal Preview](../mockups/portal-header-dropdown.html) |
| TagInput             | Tag entry/input field        | ![TagInput Preview](../mockups/client-portal-designs.html) |
| StatusBadge          | Status indicator badge       | ![Badge Preview](../mockups/portal-header-icon.html) |
| ConsentBanner        | Cookie consent banner        | ![ConsentBanner Preview](../mockups/portal-variants.html) |
| AnalyticsDashboard   | Analytics dashboard widget   | ![Analytics Preview](../mockups/client-portal-sections.html) |
| ViewToggle           | Toggle between views         | ![ViewToggle Preview](../mockups/portal-variants.html) |
| Dropdown             | Dropdown menu                | ![Dropdown Preview](../mockups/portal-header-dropdown.html) |
| PortalModal          | Portal modal dialog          | ![PortalModal Preview](../mockups/portal-header-dropdown.html) |
| ...                  | ...                          | ...            |

---

## API Reference for Each Component

- See TypeScript types in each component file under `src/components/`
- Example:
  - ButtonComponent: `ButtonProps`, `ButtonState` ([button-component.ts](../../src/components/button-component.ts))
  - ModalComponent: `ModalProps`, `ModalState` ([modal-component.ts](../../src/components/modal-component.ts))
  - TagInput: `TagInputConfig`, `TagInputTag` ([tag-input.ts](../../src/components/tag-input.ts))
  - StatusBadge: `StatusBadgeVariant` ([status-badge.ts](../../src/components/status-badge.ts))
  - ...

---

## CSS Variable Dependencies

- All components use CSS variables for color, spacing, and typography.
- See `docs/design/CSS_ARCHITECTURE.md` for global variables.
- Example variables:
  - `--color-primary`, `--color-accent`, `--spacing-xs`, `--font-size-base`
- Component-specific variables are documented in each component's CSS or style file.

---

## Accessibility Notes (ARIA, Keyboard)

- All interactive components use ARIA roles and attributes.
- Button: `role="button"`, supports keyboard activation (Enter/Space)
- Modal: `role="dialog"`, focus trap, ESC to close
- Dropdown: `role="menu"`, keyboard navigation
- StatusBadge: `aria-label` for status
- See [COMPONENT_ACCESSIBILITY.md](COMPONENT_ACCESSIBILITY.md) for detailed notes.

---

## Migration Guide from Inline Patterns

- Replace inline button markup with `<ButtonComponent />` or `createButton()`
- Use `ModalComponent` for dialogs instead of custom HTML
- Use `TagInput` for tag entry fields
- Use `StatusBadge` for status indicators
- See `src/components/index.ts` for grouped exports and recommended usage
- Refactor legacy code to use component props/types for consistency

---

For full inventory and updates, see `src/components/` and mockups in `mockups/`.
