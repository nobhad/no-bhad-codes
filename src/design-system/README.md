# Design System

The token layer behind nobhad.codes. **943 tokens across 11 files**, serving three surfaces —
the main site, the admin portal, and the client portal — from one foundation.

Browse it live: **[nobhad.codes/design-system](https://nobhad.codes/design-system)**

---

## The one rule

**No component stylesheet contains a literal colour, measurement, or duration.** Every value is a
named token. If you find yourself typing `#dc2626` or `16px` into a component file, the token
either exists and you haven't found it, or it doesn't exist and needs adding here first.

This is what makes theming possible at all: three surfaces can look completely different because
they resolve the same token names to different values, not because they run different stylesheets.

---

## Layer order

Declared once, in [`src/styles/core/layer-order.css`](../styles/core/layer-order.css) — and that
file says so itself: *"Never declare @layer order in any other file."*

```css
@layer reset, tokens, base, components, layouts, pages, states, responsive, utilities;
```

Specificity fights are the most common way a design system dies. Layers make position in the
cascade a decision rather than a side effect of how many classes you happened to chain together.
A single-class rule in `utilities` beats a five-selector rule in `components`, because the layer
order says so.

### The deliberate exception

`portal-theme.css` is **not** imported by `tokens/index.css`. It is imported *unlayered* by
`src/styles/bundles/admin.css` and `client.css`.

Unlayered styles beat every layered style. That is precisely what a surface theme has to do — the
portal must override the main site's palette wholesale. Folding it into `@layer tokens` would put
it underneath the component layer and the portals would silently render in main-site colours.

**If you add a portal-wide override, it goes in `portal-theme.css`, not in `colors.css`.**

---

## Naming

```text
--color-brand-primary          primitive  · names a colour
--color-text-primary           semantic   · names a job
--portal-btn-hover-bg          component  · names a part
```

Three tiers, and they only ever point downward:

1. **Primitives** (`--color-gray-500`, `--font-size-base-px`) are literal values. They are the only
   place a raw hex or pixel number is allowed to appear.
2. **Semantics** (`--color-text-primary`, `--color-bg-hover`) alias primitives and describe a
   *role*. Components should reach for these, not for primitives.
3. **Component tokens** (`--form-btn-bg`, `--btn-portal-primary-border`) alias semantics and belong
   to one part of the UI.

A component token pointing straight at a primitive is a smell: it means the surface can't retheme
that component, because there's no semantic layer in between to reassign.

---

## The files

| File | Holds |
| --- | --- |
| `colors.css` | Primitive palette, then the semantic colour roles built on it |
| `typography.css` | Font families and the fluid `clamp()` type scale |
| `spacing.css` | The spacing rhythm, fluid where it should scale |
| `dimensions.css` | Fixed component and container measurements |
| `borders.css` | Widths and radii |
| `shadows.css` | Elevation, each shadow named for the surface it belongs to |
| `animations.css` | Durations, easing curves, motion distances |
| `z-index.css` | Stacking order, named rather than numbered at the call site |
| `buttons.css` | Button measurements, kept separate so button work can't disturb global dimensions |
| `breakpoints.css` | Named breakpoints and custom media queries |
| `portal-theme.css` | The portal surface theme — imported unlayered, see above |

`tokens/index.css` imports all of them except `portal-theme.css`.

---

## Adding a token

1. Put it in the file that matches its **category**, not the feature that prompted it. A new
   spacing value for a modal goes in `spacing.css`, not into a modal stylesheet.
2. Pick the tier. If it's a literal, it's a primitive. If a component needs to name it, add a
   semantic alias too — don't let the component point at the primitive.
3. Follow `--[category]-[thing]-[modifier]`. Match the neighbours in the file.
4. Comment the *why*, not the what. `--color-gray-400: #a3a3a3;` doesn't need a comment.
   `--color-neutral-400: color-mix(... 47%)` earns the one it has.
5. Run `npm run docs:design-system` — the reference page regenerates from the tokens.
6. Run `npx vitest -u tests/unit/design-system` and **read the snapshot diff**. If it shows
   anything you didn't intend, that's the bug the test exists to catch.

---

## The token contract

`tests/unit/design-system/tokens.test.ts` treats these files as a public API, because they are:
fifteen-plus stylesheets and three bundles import them by name.

A rename is not a refactor. CSS resolves an unknown custom property to nothing and carries on, so a
typo doesn't throw — the layout just moves, and nobody finds out until someone looks at the page.

The tests make that loud:

- **Name snapshot** — every token name. A rename or deletion has to be acknowledged in a diff.
- **Value snapshot** — every literal value. Palette and scale changes have to be deliberate.
- **No dangling `var()`** — every bare reference resolves to a token that exists.
- **No duplicate in the same scope** — re-declaring under a dark-mode query is theming; doing it
  twice in one block means the first is dead code. *(This test found one on the day it was
  written: `--form-btn-shadow` was declared twice inside the portal block.)*
- **`portal-theme.css` stays out of the index** — the architecture guarantee above, enforced.

---

## Documentation

`public/design-system/index.html` is **generated, never hand-edited**. `scripts/build-design-system-docs.mjs`
reads `tokens/*.css` and renders every token with a live preview — swatches for colours, bars for
lengths, real specimens for font stacks, and resolved values for aliases.

```bash
npm run docs:design-system
```

Vercel copies `public/` to the deploy root verbatim and `cleanUrls` is on, so the page ships at
**nobhad.codes/design-system** with no routing to configure.

Hand-written documentation of a token layer is wrong within a month. Generating it means the page
cannot drift from what ships.
