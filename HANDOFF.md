# Handoff — footer curtain / project-detail map tile

> **This handoff describes the session that ended at `086cdb65`.** The branch has moved on
> substantially since (50+ commits, including the fixes noted inline below). Treat the commit
> table as a record of that session, not as the current state of `main`. For live status see
> [`CURRENT_WORK.md`](./CURRENT_WORK.md).

**Branch:** `main` · **Session HEAD:** `086cdb65` · **Working tree at handoff:** clean

`stash@{0}` held an unverified experiment at the time of writing; the shrink-from-bottom stash
referenced below has since been dropped.

---

## What this session did

Reworked the footer curtain and turned project-detail into a real map tile. Commits, oldest first:

| commit | what |
|---|---|
| `17ec06e6` | curtain mechanic: page slides up off a stationary ink band; old copyright strip removed |
| `c3a75b30` | gesture-driven reveal on map tiles (vertical axis on intro/about/contact) |
| `c045a7e5` | mobile tiles reach viewport edges, clear the header, curtain-sliver fix |
| `ca6c5090` | `--section-heading-size`: one source of truth for `.section-heading` |
| `9688304a` | about content column centred |
| `2dd70b7c` | detail clearance + stacking |
| `b4581ec9` | contact background avatar watermark removed |
| `24cddc16` | **project-detail becomes a vertical map tile** at grid (100,100) below projects |
| `8cf45e02` | about: one measure (`--map-tile-pad-y`) for every gap on the tile |
| `a5cf179e` | detail tile spacing/framing/curtain reveal |
| `8248a7fc` | one header-gap measure for every tile; TV live-link hit area |
| `9df77e81` | TOOLS aligned with ROLE, divider, symmetric spacing |
| `1f204eb3` / `379c2536` | divider matches frame border weight |
| `8a536ded` / `c4cbd05e` | curtain retract fixes (see below) |
| `086cdb65` | bottom space = header inset + tile gap (matches top) |

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

Fixed in `4b250227`: one named `SCROLL_EDGE_EPSILON = 2` used by every scroll-edge test in
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
synthetic `WheelEvent` does not reach the handlers either. So `4b250227` is reasoned from the
measured boundary values, not observed working.

Still open: per `CURRENT_WORK.md`, a real trackpad's momentum tail remains the one input profile
never exercised, and `CURTAIN_SETTLE_MS` is the constant most likely to need tuning against real
hardware. Follow-up commits `8c47f616` and `af76cdb2` refined the settle/resize behaviour.

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

- ~~**TV title-card click**~~ — **RESOLVED** in `9cec7666` ("invisible panels no longer swallow
  clicks on the title card"). The cause was invisible case-study panels sitting over the screen
  and capturing the click, not the handler `wireTuneInScreenClick()` in
  `src/modules/ui/projects.ts`. Note the fix is committed but, per `CURRENT_WORK.md`, was still
  unpushed at last check — the deployed site may lag.
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
