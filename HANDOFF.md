# Handoff — footer curtain / project-detail map tile

**Branch:** `main` · **HEAD:** `b7d2bdae` · **Working tree:** clean · **Nothing pushed** (ahead of origin)

`stash@{0}` holds an unverified experiment (see "Recommended next step"). Older stashes are unrelated/pre-existing.

---

## What this session did

Reworked the footer curtain and turned project-detail into a real map tile. Commits, oldest first:

| commit | what |
|---|---|
| `af3ab05b` | curtain mechanic: page slides up off a stationary ink band; old copyright strip removed |
| `3e0746c3` | gesture-driven reveal on map tiles (vertical axis on intro/about/contact) |
| `3faa1575` | mobile tiles reach viewport edges, clear the header, curtain-sliver fix |
| `7a788b1d` | `--section-heading-size`: one source of truth for `.section-heading` |
| `9f392a10` | about content column centred |
| `970961a6` | detail clearance + stacking |
| `bf18b4e6` | contact background avatar watermark removed |
| `a0316aa1` | **project-detail becomes a vertical map tile** at grid (100,100) below projects |
| `655c9594` | about: one measure (`--map-tile-pad-y`) for every gap on the tile |
| `42a89409` | detail tile spacing/framing/curtain reveal |
| `b3c317c3` | one header-gap measure for every tile; TV live-link hit area |
| `7d8b886d` | TOOLS aligned with ROLE, divider, symmetric spacing |
| `aadbd784` / `f63dfde5` | divider matches frame border weight |
| `2499c729` / `e81a7e90` | curtain retract fixes (see below) |
| `b7d2bdae` | bottom space = header inset + tile gap (matches top) |

## Verified working (measured in-browser)

- **Spacing on project-detail is correct and the user has confirmed it.** `padding-top` = `padding-bottom` = `calc(var(--map-header-inset) + var(--map-tile-pad-y))` = 108px. Do not change this.
- project-detail is a real map tile: `camera: detail`, transform `translate(-1512, -773)` = one viewport left + one up. Scrolls internally, top-aligned, 16px clear of the header.
- Stacking is correct: `main` z-index 1, `.footer` and `.footer-curtain` z-index 0. Hit-testing over the band returns page content, not the curtain.
- TOOLS label aligns with ROLE (both `top: 544`). Divider 900px inside the 1000px frame at 2px, matching the border.
- Header scrolls away with content; page returns to rest (`matrix(1,0,0,1,0,0)`, `mainBottom: 773`).
- Carousel order: `nobhad-codes → the-backend → hedgewitch → nobhad-codes` both directions.

---

## OPEN BUG 1 — curtain reveal does not fire on project-detail

**Symptom:** at the end of a case study, scrolling further does nothing. The band never rises.

**Evidence (decisive):**
```js
window.__evts=[];
window.addEventListener('footer-curtain:set-progress', e=>window.__evts.push(e.detail.progress));
// scroll to end, then wheel down with REAL input (synthetic WheelEvent does NOT
// reproduce — it never reaches the handler)
window.__evts.length   // => 0
```
`driveCurtain()` never dispatches, so `PageTransitionModule.handleWheel` is not reaching the
`else if (this.currentPageId === 'project-detail')` branch (page-transition.ts, in the
`absY >= absX` block).

**Prime suspect:** `this.currentPageId` is stale — `'projects'` rather than `'project-detail'` —
so the projects channel-surf branch runs instead. There is a known staleness problem with
`data-active-page` during transitions, observed earlier this session.

**Next step:** log `this.currentPageId` at the top of `handleWheel` and confirm. If stale, fix
where `currentPageId` is committed (page-transition.ts lines ~1851 and ~1915).

## OPEN BUG 2 — content cropped when the band is revealed

**This is NOT a z-index problem** — that was checked repeatedly and the stacking is correct.
When the curtain opens, `main` translates up by the band's height (232px) and its
`overflow: hidden` **crops** whatever is in that strip. The user reads the cut edge as
"content behind the footer".

**Hard constraint from the user:** do **not** change the spacing (108/108) and do **not**
change the footer/band size (`--footer-curtain-height: clamp(200px, 30vh, 320px)`).

That rules out both padding-reservation and shrinking the band. Approaches already tried and
rejected/failed:

- reserve band height as `padding-bottom` → works, but 280px of dead space at rest (rejected)
- shrink `--footer-curtain-height` → rejected outright
- grow padding dynamically as the band rises → **feedback loop**: growing padding restores
  `canScrollDown`, which is the condition that triggers the reveal, so it can never finish

### Recommended next step

**Shrink the page from its bottom edge instead of translating it.** This changes neither the
spacing nor the band size — only how the reveal happens — and removes the crop entirely,
because the scroller's range grows by exactly the amount the window shrinks.

Proven by hand in the console:
```js
main.style.setProperty('bottom','232px','important');
// mainBottom 773 -> 541  (band revealed)
// maxScroll  1111 -> 1343 (grew by the same 232 — nothing unreachable)
```

The code for this is in **`stash@{0}`** (`git stash show -p stash@{0}`): the timeline tweens
`bottom` instead of `y`, with a function value so the height is read at run time, and
`applyHeaderOffset` drops the curtain term. It is **unverified** only because OPEN BUG 1 stops
the reveal from firing at all. **Fix bug 1 first, then pop the stash and verify.**

---

## Also open

- **TV title-card click** — user reports clicking the screen during the title card opens the
  project's live site in a new tab. Never reproduced: sampling the screen every 260ms through a
  tune-in never caught an anchor under the cursor, and a synthetic click always routed to
  `#/projects/<slug>`. Handler is `wireTuneInScreenClick()` in `src/modules/ui/projects.ts`.
- **`_to_delete/`** is in git history from an early commit this session (320K stale generated
  design-system page). Removing it now needs a rebase or a delete commit.
- Flaky entrance animation on project-detail: `worksub-header` / `worksub-intro` occasionally
  stranded at `opacity: 0` from `animateDetailEntrance()` (`projects.ts:2462`). Pre-existing.

## Gotchas worth knowing (each cost real time)

- **Layer order** is `reset, tokens, base, components, layouts, pages, states, responsive, utilities`.
  `mobile/*.css` is `layer(responsive)` and **outranks** `components/site-map.css` (`layer(states)`).
  `pages/projects-detail.css` is imported **UNLAYERED** and outranks everything layered.
- **Declaration order beats intuition:** a media query adds no specificity, so a rule inside
  `@media` at line 450 loses to the same selector at line 500. Custom properties dodge this —
  they only conflict with another declaration of themselves.
- A `margin` shorthand later in the same rule silently resets an earlier `margin-inline`.
- `getComputedStyle` lies while a transition is in flight (`main` has a `background-color`
  transition). Screenshots were the only reliable read.
- Synthetic `WheelEvent` does not exercise the wheel handlers. Use real input.
- Media queries respond to an **iframe's** own width — the fastest way to test narrow
  breakpoints when the window can't be resized.
