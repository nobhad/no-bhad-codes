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

## RESOLVED — curtain reveal never fired (was OPEN BUG 1)

**Root cause:** scroll heights are fractional. A tile visually at its end reports ~0.5-1px
remaining and never reaches 0, so the `remaining >= 1` test read as "still scrollable" forever.
The reveal only fires once the content is done, and by that test it never was — so pulling the
page up at the end of a case study did nothing at all.

Fixed in `8c24a895`: one named `SCROLL_EDGE_EPSILON = 2` used by every scroll-edge test in
`page-transition.ts`, replacing hard 1px comparisons.

**Two hypotheses in the earlier draft of this file were wrong** — disregard them:
- *"`currentPageId` is stale as 'projects'"* — disproved. ArrowUp at the top of a case study
  correctly exits to `#/projects`, so the module knows which page it is on. Only the **compass
  cues** were stale (`updateCompass` had not re-run), which is a separate cosmetic issue.
- *"shrink the page from its bottom edge instead of translating it"* — do NOT do this. The user
  has since specified the page height must not change. That stash has been dropped.

## The intended mechanic (user's words)

> "I WANT THE FOOTER TO BE A SET HEIGHT AND THE PAGE HEIGHT TO NOT CHANGE - I WANT PULLING THE
> PAGE UP TO REVEAL THE FOOTER THAT IS BEHIND THE PAGE"

That is the committed model: band fixed at 232px behind the page, page keeps its height and
translates up to uncover it. **Do not change the spacing (108px top and bottom) and do not
change `--footer-curtain-height`.** Both were reverted once already after being changed without
being asked.

## NEEDS VERIFICATION ON REAL HARDWARE

The reveal could never be exercised in automation: the browser-automation `scroll` action
produces **no wheel events** (`window.__wheels === 0` with a capture listener on window), and
synthetic `WheelEvent` does not reach the handlers either. So `8c24a895` is reasoned from the
measured boundary values, not observed working.

To verify by hand: open a case study, scroll to the very end with a trackpad, keep scrolling.
The band should rise. Scroll back up and it should retract in step. Instrument with:
```js
window.__evts=[];
window.addEventListener('footer-curtain:set-progress', e=>window.__evts.push(e.detail.progress));
// ...scroll...  window.__evts   // should be non-empty and climb toward 1
```

## Known remaining trade

With the slide model, the band occupies the bottom 232px of the viewport when revealed, so that
much less of the case study is visible at once. Content is not lost — the page moves up with it —
but the cut edge at the band's top has repeatedly been read as "content behind the footer". The
stacking is correct and was verified many times (`main` z-index 1, footer 0, hit-testing over the
band returns page content).

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
