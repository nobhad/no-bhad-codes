# Portfolio Projects

**Status:** Complete
**Last Updated:** 2026-06-25

The portfolio is a single feature with two halves: the **data side**
(how a project is described in `portfolio.json`, what fields render
where) and the **interactive CRT TV** (how a visitor browses those
projects on the page — channel cycling, tune-in animation, looping
per-channel music, mute indicator, power cycle persistence). They share
a module (`src/modules/ui/projects.ts`) so they're documented together.

**Public route:** `#projects` (and `#/projects`)
**Project detail route:** `#/projects/:slug`
**Data file:** `public/data/portfolio.json`
**Module:** `src/modules/ui/projects.ts`
**Audio engine:** `src/modules/audio/tv-sfx.ts`
**Styles:** `src/styles/pages/projects.css`,
`src/styles/pages/projects-detail.css`

## Part 1: Data side — adding a new project

### Project template

Copy this template and fill in all fields:

```json
{
  "id": "project-slug",
  "title": "Project Title",
  "slug": "project-slug",
  "tagline": "Short tagline (shown under title)",
  "description": "Full description paragraph for the overview section.",
  "category": "websites",
  "role": "Full Stack Developer",
  "tools": ["TypeScript", "Node.js", "Express.js"],
  "year": 2026,
  "technologies": ["TypeScript", "Node.js", "Express.js"],
  "date": "2026-01-01",
  "status": "in-progress",
  "featured": true,
  "heroImage": "/projects/project-slug-hero.png",
  "screenshots": [
    "/projects/project-slug-screen1.png",
    "/projects/project-slug-screen2.png"
  ],
  "liveUrl": "https://example.com",
  "repoUrl": "https://github.com/user/repo",
  "isDocumented": true,
  "titleCard": {
    "composed": "/images/tv/title-cards/project-slug.webp",
    "bg": "/images/tv/title-cards/project-slug_bg.webp",
    "color": "#ffffff",
    "primary": "Primary text",
    "primaryPt": 72,
    "secondary": "Secondary text",
    "secondaryPt": 24
  },
  "duration": "3 months",
  "challenge": "Description of the problem being solved, user pain points, or business requirements that led to this project.",
  "approach": "Description of the methodology, key technical decisions, and how you solved the challenge.",
  "results": [
    "Specific outcome or metric #1",
    "Specific outcome or metric #2",
    "Specific outcome or metric #3"
  ],
  "keyFeatures": [
    "Feature highlight #1",
    "Feature highlight #2",
    "Feature highlight #3",
    "Feature highlight #4"
  ]
}
```

### Field reference

#### Required fields

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique identifier (use slug format) |
| `title` | string | Display title |
| `slug` | string | URL-friendly identifier (used in `#/projects/slug`) |
| `tagline` | string | Short descriptor shown below title |
| `description` | string | Full overview paragraph |
| `category` | string | One of: `websites`, `applications`, `extensions`, `ecommerce` |
| `role` | string | Your role (e.g., "Full Stack Developer") |
| `tools` | string[] | Technologies used (displayed as tags) |
| `year` | number | Year of project |
| `status` | string | One of: `in-progress`, `completed`, `planned` |
| `isDocumented` | boolean | Set to `true` to show on the projects page |

#### Optional fields

| Field | Type | Description |
|---|---|---|
| `technologies` | string[] | Duplicate of tools (legacy support) |
| `date` | string | Full date in ISO format |
| `featured` | boolean | Featured project flag |
| `heroImage` | string | Path to hero image (empty string if none) |
| `screenshots` | string[] | Array of screenshot paths |
| `liveUrl` | string | URL to live project |
| `repoUrl` | string | URL to source code |
| `titleCard` | object | TV title-card data — see "Title card structure" below |

#### Title card structure

```json
"titleCard": {
  "composed": "/images/tv/title-cards/<name>.webp",
  "bg":       "/images/tv/title-cards/<name>_bg.webp",
  "color":    "#ffffff",
  "primary":  "Primary text",
  "primaryPt": 72,
  "secondary": "Secondary text",
  "secondaryPt": 24
}
```

- `composed` — the full title card with text baked into the image,
  shown during the tune-in animation's title-card hold stage.
- `bg` — the bg-only version (no text), shown beneath the case-study
  panels after the title fades out.
- `color` — designer-supplied hex used as `--tunein-color` on the
  tune-in panels (CSS reads it from there). A contrast veil is
  computed automatically from the color's luma so paragraphs read
  against the bg image.
- `primary` / `secondary` / `primaryPt` / `secondaryPt` — per-card text
  spec for future HTML-overlay rendering (currently informational —
  the composed image is what renders).

#### Case-study fields

| Field | Type | Description |
|---|---|---|
| `duration` | string | Project duration (e.g., "3 months", "Ongoing") |
| `challenge` | string | Problem statement — what pain point does this solve? |
| `approach` | string | Solution methodology — how did you solve it? |
| `results` | string[] | Outcomes and metrics — what was achieved? |
| `keyFeatures` | string[] | Feature highlights — what are the standout capabilities? |

#### TV channel preview overrides

The TV channel preview intentionally shows shorter copy than the full
case-study page. Each project can supply a `tv` namespace with
condensed versions of any case-study field. When a `tv.X` field is
missing, the TV falls back to the full `X` field — projects without
curated TV copy still render.

```json
"tv": {
  "description": "Shorter intro paragraph for the TV preview.",
  "challenge": "One-or-two-sentence challenge.",
  "approach": "One-or-two-sentence approach.",
  "keyFeatures": ["Top 3 features for the TV"],
  "results": ["Top 2-3 outcomes"]
}
```

| Field | Type | Description |
|---|---|---|
| `tv.description` | string | TV-specific shorter description (falls back to full `description`) |
| `tv.challenge` | string | TV-specific challenge (falls back to full `challenge`) |
| `tv.approach` | string | TV-specific approach (falls back to full `approach`) |
| `tv.keyFeatures` | string[] | TV-specific feature list (falls back to full `keyFeatures`) |
| `tv.results` | string[] | TV-specific results list (falls back to full `results`) |

### Category options

| Category | Description |
|---|---|
| `websites` | Marketing sites, portfolios, landing pages |
| `applications` | Web apps, dashboards, tools |
| `extensions` | Browser extensions, plugins |
| `ecommerce` | Online stores, shopping carts |

### Status options

| Status | Badge color | Description |
|---|---|---|
| `in-progress` | Yellow | Currently being developed |
| `completed` | Green | Finished and deployed |
| `planned` | Purple | Future project |

### Image requirements

#### Hero image

- Size: 1200×630px recommended (16:9 or 12:7 aspect ratio)
- Format: PNG or JPG
- Location: `/public/projects/`
- Naming: `{slug}-hero.png`

#### Title card (CRT preview)

- Size: 1426×1093 (full chassis canvas, transparent surroundings)
- Format: WebP
- Location: `/public/images/tv/title-cards/`
- Naming: `<name>.webp` (composed) and `<name>_bg.webp` (bg-only, underscore). The `<name>` comes from the JSON `composed`/`bg` fields and doesn't always equal the slug (e.g. slug `nobhad-codes` → `no-bhad-codes`)

#### Screenshots

- Size: Varies, maintain consistent aspect ratio
- Format: PNG or JPG
- Location: `/public/projects/`
- Naming: `{slug}-screen1.png`, `{slug}-screen2.png`, etc.

### Visibility rules

Projects appear on the main projects page only when:

1. `isDocumented` is `true`.
2. At least 2 projects have `isDocumented: true` (otherwise the WIP
   sign shows instead of the channel-list).

### Writing tips

#### Challenge section

- Focus on the problem, not the solution.
- Mention user pain points or business requirements.
- Keep it to 2–3 sentences.

#### Approach section

- Describe your methodology and key decisions.
- Mention notable technical choices and why.
- Keep it to 2–3 sentences.

#### Results section

- Use specific metrics when possible ("50% faster", "3x more users").
- Include qualitative outcomes ("positive client feedback").
- 3–5 bullet points recommended.

#### Key features section

- Lead with the most impressive / unique features.
- Be specific (not "responsive design" but "mobile-first with offline
  support").
- 4–6 bullet points recommended.

## Part 2: Interactive CRT TV

The projects page renders the portfolio as an interactive CRT
television inspired by the 1980s Prevue Channel guide. The TV chassis
is a single painted PNG (`tv/chassis.webp`) with invisible button
hitboxes overlaid on the painted POWER / CHANNEL ▼▲ / VOLUME ▼▲
capsules. The screen aperture inside the bezel renders an HTML/CSS
channel list (the "guide") and per-project tune-in panels that animate
in when the user selects a channel. Each project channel has its own
looping background music and a sample-accurate static crackle on
tune-in.

The whole thing is a single component with five state surfaces — power,
channel, volume, mute, and per-channel music — that are explicitly tied
together so the UI never drifts (e.g. music can't keep playing if the
TV is off; the visible channel and the music it plays are always the
same channel).

### Visual architecture

The TV is layered absolute-positioned elements inside `.crt-tv__wrapper`,
stacked from back to front:

```text
.crt-tv (block container)
  .crt-tv__wrapper (position: relative — coordinate space)
    .crt-tv__screen-bg     z:1 — full-canvas base image (lit / off / per-card bg)
    .crt-tv__image         z:1 — composed title-card image (per-channel)
    .crt-tv__screen        z:2 — screen aperture (overflow: hidden)
      .crt-tv__channel-list   — Prevue-style guide (channel 01)
      .crt-tv__tunein         — case-study panels (channels 02+)
      .crt-tv__static         — CRT noise overlay
      .crt-tv__scanlines      — repeating-linear-gradient scanlines
      .crt-tv__glare          — radial-gradient glass glare
      .crt-tv__mute-indicator — Lucide volume-x, top-right (z:5 inside screen)
    .crt-tv__frame         z:3 — TV bezel image (pointer-events: none)
    .crt-tv__channel-display z:4 — LED digit overlay (tv/led/NN.webp)
    .crt-tv__btn--power    z:5 — invisible button hitbox
    .crt-tv__btn--channel-down  z:5
    .crt-tv__btn--channel-up    z:5
    .crt-tv__btn--volume-down   z:5
    .crt-tv__btn--volume-up     z:5
```

The frame image has `pointer-events: none` so clicks pass through to
the button hitboxes underneath. Only the buttons (z:5) are
hit-receivable from the chassis area; the screen aperture's children
handle their own clicks separately.

### Button hitbox positioning

The buttons are sized + positioned in **percentages of `.crt-tv__wrapper`**
so they scale with the TV at every breakpoint. Coords measured by
per-row dark-pixel bounding box on the right-side button column of
`tv/chassis.webp` (2850×2186, 1.304 aspect) — any-dark-pixel-per-row,
NOT a coverage threshold (a coverage threshold drops the rounded tips
of each capsule because at those rows the dark coverage falls below
threshold).

| Button | top | left | width | height |
|---|---|---|---|---|
| POWER | 25.39% | 87.12% | 10.74% | 2.06% |
| CHANNEL ▼ | 29.51% | 87.12% | 5.37% | 2.06% |
| CHANNEL ▲ | 29.51% | 92.49% | 5.37% | 2.06% |
| VOLUME ▼ | 33.76% | 87.12% | 5.37% | 2.01% |
| VOLUME ▲ | 33.76% | 92.49% | 5.37% | 2.01% |

CHANNEL and VOLUME's painted capsules are single pills; the hitbox is
split into LEFT (▼) and RIGHT (▲) halves with no visible divider —
triangular ▼/▲ glyphs are baked into the source image as the only cue.

If the chassis art ever changes, the cleanest path is to also export
an alpha-only buttons layer (`tv/chassis-buttons-ref.webp` is one for
the alternate chassis at `tv/chassis-alt.webp`) and re-run a
per-pixel bounding-box scan against THAT — the dark-pixel scan on
the chassis itself works but is approximate.

### Focus rings (accessibility)

`:focus-visible` traces the painted capsule shape exactly — modern
browsers honor border-radius on outline:

- `outline: 1.5px solid #fff; outline-offset: 0` — flush against the
  hitbox edge.
- `border-radius: 9999px` — pill.
- POWER → full pill.
- CHANNEL/VOLUME ▼ → `border-radius: 9999px 0 0 9999px` (left-half pill,
  flush right edge against the ▲ button).
- CHANNEL/VOLUME ▲ → mirror, right-half pill.

Together the split halves read as one continuous capsule with a focus
ring on whichever half is focused.

### Channel state machine

The currently-tuned channel is held in two places that must stay in
sync:

- `ProjectsModule.activeTuneInSlug: string | null` — the truth source.
  `null` means channel 01 (the guide); a slug means a project channel.
- DOM: `[data-channel-list]` row highlight, `.crt-tv__channel-display`
  `src` (LED), `.crt-tv__tunein[aria-hidden]`, `.crt-tv__image src`,
  `[data-screen-bg] src` — all set during the tune-in animation.

The mapping `slug → channel number` is implicit: documented projects
(`isDocumented: true` in `portfolio.json`) are channels 02, 03, 04, …
in their array order. Channel 01 is the guide and never maps to a
slug.

#### Tune-in flow

`playTuneInSequence(slug)` is the single entry point for tuning into a
project channel. It:

1. `cancelTuneIn()` — clears any in-flight animation, resets state,
   stops the previous music (see "Music tied to channel" below).
2. Sets `activeTuneInSlug = slug` and updates the LED + row highlight.
3. Populates the tune-in panels for this project.
4. Fires `tvSfx.static({...channel-change shape})` for the crackle.
5. Calls `tvSfx.playMusic(CHANNEL_MUSIC[slug])` if the channel has music.
6. Runs a GSAP timeline: static burst → channel list fades out →
   screenBg flashes blank → screenBg swaps to per-card `card.bg` →
   static settles → composed title card fades in → holds → crossfades
   to bg-only → panels container becomes visible and `startPanelCycle`
   rotates through the case-study sections.

#### Channel-cycling input methods

All cycling routes through `cycleTvChannel(±1)` or directly through
`setTvChannel(idx, opts)`:

- **Chassis CHANNEL ▼/▲** (`wireTvButtons`) → `cycleTvChannel`.
- **External mobile CHANNEL ▼/▲** (`wireMobileChannelButtons`) →
  `cycleTvChannel`. Rendered below the TV at `≤479px` only — the
  chassis buttons are too small to hit reliably with a finger at that
  breakpoint.
- **Mouse wheel + arrow keys** — handled in
  `src/modules/animation/page-transition.ts`, dispatches
  `projects:set-tv-channel`.
- **Click on a `.crt-tv__channel-row`** — calls `playTuneInSequence`
  directly.
- **Click on a playing screen** (`wireTuneInScreenClick`) — while a
  project channel is tuned in, clicking the TV screen navigates to that
  project's detail page (`#/projects/[slug]`, same tab); the explicit
  "Live: url" outro link still opens the live site in a new tab. Not a
  channel change — it leaves the projects tile.

#### Going back to the guide

`transitionToGuide()` runs an inverse-tune-in animation that ends with
the channel list visible over `tv/base-on.webp`. It calls
`cancelTuneIn()` (which also stops music) and sets the LED to
`tv/led/01.webp`.

### Power state machine

Power state is a single class on `.crt-tv`:

- No class → on (default).
- `.is-powered-off` → off.

The `.is-powered-off` selector hides the screen aperture, the LED, and
the composed title card via `visibility: hidden`. `.crt-tv__image` is
in that list because it lives **outside** `.crt-tv__screen` — the
composed title-card image is sized to the full TV-frame canvas so it
can't be a child of the screen aperture; without this rule the
title card bleeds through the dark off-state when powering off from a
project channel.

#### Power off — channel state preserved

`toggleTvPower()` off-branch is deliberately surgical so channel state
survives a power cycle:

1. Kill in-flight tune-in animation timelines (`tuneInTimeline`,
   `tuneInScrollTween`).
2. `tvSfx.stopMusic()` — fade out current track.
3. Save `screenBg.src` to `screenBgBeforePowerOff` so the per-card bg
   can be restored on power-on (the off-state base swap would
   otherwise stomp it).
4. Swap `screenBg.src` to `tv/base-off.webp` (dark vignette).
5. `tv.classList.add('is-powered-off')` — CSS hides the screen
   aperture, LED, and composed title card.

It does **not** call `cancelTuneIn()` (which would wipe
`activeTuneInSlug`, clear panels innerHTML, reset the tune-in DOM).

#### Power on — channel state restored

1. Remove `.is-powered-off` — CSS reveals the screen aperture, LED,
   and title card in their preserved state.
2. Restore `screenBg.src` from `screenBgBeforePowerOff` (or fall back
   to `tv/base-on.webp`).
3. `tvSfx.static()` — power-on crackle synced with the visual "screen
   lights up" moment.
4. If `activeTuneInSlug` is set and has a music URL in `CHANNEL_MUSIC`,
   call `tvSfx.playMusic(url)` to resume the channel's track.

#### Behavior with controls when powered off

When the TV is off, only POWER works. CHANNEL/VOLUME (chassis +
external mobile) become inert in two layers:

- **Action gate:** `wireTvButtons` and `wireMobileChannelButtons`
  early-return on any non-POWER button if `.is-powered-off` is present.
- **Sound gate:** the global click listener in `tv-sfx.ts`
  early-returns before `primeContextSync` and `click()` for non-POWER
  buttons when the TV is off, so the buttons feel completely dead — no
  click sound either.

POWER stays audible because its click is the audible feedback that the
set just turned back on.

### Audio system

All TV audio lives in `src/modules/audio/tv-sfx.ts` (singleton
`tvSfx`). The Web Audio graph at runtime:

```text
ctx
├── masterGain (gain = volume, default 0.5)  ← VOLUME ▼/▲ controls this
│   ├── static envelope GainNode → AudioBufferSource (tv-static.mp3)
│   └── music envelope GainNode  → AudioBufferSource (per-channel mp3, loop=true)
└── clickGain  (gain = CLICK_FIXED_GAIN = 0.22, NOT controlled by VOLUME)
    └── AudioBufferSource (channel-click.mp3)
```

The split is intentional: muting (volume = 0) silences the diegetic TV
audio (static + music), but the tactile button click stays audible
because it's the confirmation that VOLUME ▼ actually registered.

#### Sample inventory

`public/audio/`:

- `channel-click.mp3` — 12 KB, mechanical click on every TV-button press.
- `tv-static.mp3` — 64 KB, ~4 second CRT noise sample. Slices replayed
  at random offsets so back-to-back channel changes don't sound identical.
- `the-broken-hearted-sparrow.mp3` — 6.3 MB, channel 02 (No Bhad Codes).
- `anvil-chorus.mp3` — 1.4 MB, channel 03 (The Backend).
- `roses-at-twilight.mp3` — 2.7 MB, channel 04 (Hedgewitch Horticulture).
- `otello-selections.mp3` — 5.7 MB, staged for a future project.
- `the-dream-of-the-rarebit-fiend.mp3` — 1.3 MB, staged for a future
  project.

All music tracks are public-domain Library of Congress National
Jukebox releases. Files are byte-identical to the LoC IIIF endpoint
downloads
(`https://tile.loc.gov/streaming-services/iiif/service:mbrsrs:mbrsjukebox:{id}:{id}/full/full/0/full/default.mp3`).

#### Click + static prefetch

Both `channel-click.mp3` and `tv-static.mp3` are eagerly fetched as
raw ArrayBuffers in the `TvSfx` constructor (`prefetchSamples()`), no
AudioContext required. Decoding into an `AudioBuffer` requires a ctx
(created on first user gesture), so the bytes sit in memory until then.
Without prefetch, the first call to `static()` paid the full
fetch+decode latency (~200–300 ms) and the crackle landed long after
the visual cue. Music tracks are **not** eagerly prefetched — they're
1–7 MB each and most visitors only listen to one channel.

#### AudioContext lifecycle

`bindGlobalClickListener` registers a **capture-phase** document click
listener on `.crt-tv__btn, .projects-tv-channel-btn`. Capture phase
matters: `primeContextSync()` (synchronous AudioContext creation +
`ctx.resume()`) must run before `.crt-tv`'s bubble-phase handler in
`projects.ts` synchronously calls `cycleTvChannel → tvSfx.static()`.
Otherwise `static()`'s `await ensureContext()` ends up creating the
ctx outside the original gesture frame and on stricter browsers the
ramps land before the source actually produces audio.

#### Static envelope shapes

`tvSfx.static(opts)` runs an `attack → peak hold → release` envelope
through a per-call GainNode into masterGain. Two shapes are used:

| Param | Power-on (defaults) | Channel-change |
|---|---|---|
| attackS | 0.18 | 0.02 |
| holdS | 0.27 | 0.07 |
| dropToFraction | — | 0.35 |
| dropDurationS | — | 0.12 |
| sustainS | — | 0.18 |
| releaseS | 0.55 | 0.28 |
| peakGain | 0.18 | 0.12 |

Power-on is gentle (long attack, soft trail). Channel-change snaps to
a brief peak, drops to a quiet residual hiss, sustains, then trails
off — the "loud burst → settled hiss → fade" of a CRT settling on a
new channel.

The peak gains are calibrated **relative to** `CLICK_FIXED_GAIN = 0.22`
so the static sits clearly below the click in the audible mix. Earlier
values (0.05 / 0.028) were inaudible after passing through the default
masterGain of 0.5.

#### Critical: source.start ordering

`static()` schedules the envelope first, then connects the source,
then calls `source.start(now, offset)` with `now = ctx.currentTime`
captured before the source is created. An earlier version called
`source.start(0)` **before** connecting and before capturing `now`,
which silently dropped the attack ramp because the source advanced
unconnected for a few audio frames and by the time the connect
happened the envelope was already past its anchor. Compare with
`click()` which does it in the right order and audibly works as a
result.

#### Channel music

`playMusic(url)`:

- Idempotent on the same URL (no-op if already playing).
- Different URL: stops current track first (`stopMusic` cross-fade),
  then starts new one with a per-track GainNode envelope fading from
  `0 → MUSIC_DEFAULT_GAIN (0.7)` over `MUSIC_FADE_IN_S (0.8)`.
- Looping `AudioBufferSource` connected through the per-track gain
  into masterGain (so VOLUME and mute already control it — no
  separate music-volume slider needed).
- Per-URL `AudioBuffer` cache (`musicBufferCache: Map<url, AudioBuffer>`)
  — first play of a track pays fetch+decode, subsequent retunes are
  instant.
- Bails out gracefully if the user re-tunes (different URL or
  `stopMusic`) during the `await ensureContext()` /
  `await loadMusicBuffer()` chain.

`stopMusic()`:

- Mid-fade-safe: captures current `gain.value` before ramping to 0
  (so mid-fade-in cuts cleanly without a click).
- Fades out over `MUSIC_FADE_OUT_S (0.45)`, schedules
  `source.stop(now + MUSIC_FADE_OUT_S + 0.05)`, disconnects after the
  fade window via `setTimeout` to free graph nodes.

### Music tied to channel state

The single rule: **wherever channel state goes, music goes.**

- `cancelTuneIn()` calls `tvSfx.stopMusic()`. So Esc, transitionToGuide,
  and the start-of-new-tune-in cancel all stop music in lockstep with
  the channel reset — callers don't have to remember to also stop
  music.
- `playTuneInSequence(slug)` calls `tvSfx.playMusic(CHANNEL_MUSIC[slug])`
  if the slug has a music URL — music starts in lockstep with channel
  selection.
- `toggleTvPower` off-branch calls `tvSfx.stopMusic()` directly (since
  it doesn't call `cancelTuneIn` — channel state must persist) and
  the on-branch calls `tvSfx.playMusic(url)` for the preserved
  `activeTuneInSlug`.

#### Cross-page navigation

`wireChannelMusicLifecycle()` listens for the `page-entering` window
event from `page-transition.ts`:

- `to !== 'projects'` (leaving) → `tvSfx.stopMusic()`. Channel state
  itself is preserved (the projects DOM stays mounted across
  spatial-map nav); only the audio source is torn down on leave.
- `to === 'projects'` (returning) → if TV is on AND `activeTuneInSlug`
  has a music URL, `tvSfx.playMusic(url)` to resume.

We listen to `page-entering` (fires the instant the next page starts
animating in) instead of `page-changed` (fires after the transition
completes) so the fade-out kicks off the moment the user navigates
away, not after the visual transition finishes.

### Mute indicator + VOLUME extremes

When `tvSfx.volume === 0`, the screen shows a translucent Lucide
`volume-x` icon at the top-right of the screen aperture — the OSD
badge a 90s CRT flashed when you muted. Visible only when the TV is
powered on (when off, the screen is dark and the icon would compete
with the dead-set look).

Implementation:

- HTML: `<div class="crt-tv__mute-indicator">` with inline Lucide SVG,
  injected as part of `injectTvFrame`.
- CSS: shown when `.crt-tv.is-muted:not(.is-powered-off)` matches.
- State: `wireVolumeState()` listens for the `tv-sfx:volume-change`
  event dispatched from `tvSfx.setVolume()`. Toggles `.is-muted` on
  `.crt-tv` whenever `volume === 0`, plus `.is-at-min` on VOLUME ▼ at
  vol = 0 and `.is-at-max` on VOLUME ▲ at vol ≥ 1. Both extreme
  classes set `pointer-events: none; cursor: default` so the user
  can't keep clicking past the rail.

Initial state on render comes from `tvSfx.getVolume()` (loaded from
`localStorage` `tv-sfx-volume` key).

### Mobile / small-screen considerations

At `≤479px` (small mobile):

- Chassis CHANNEL/VOLUME hitboxes get `pointer-events: none` because
  they're too cramped to hit with a finger.
- `.projects-tv-channel-controls` (rendered as a SIBLING of the TV wrap
  via `createElement`) becomes `display: flex`, showing two large
  up/down channel buttons — `buildSquareChevronIcon('up'|'down')` with a
  stacked "CH" label, aria-labelled "Previous/Next channel" — that route
  to the same `cycleTvChannel`. (Sibling, not child, so the TV wrap's
  centering transform doesn't drag them off-screen.)
- POWER stays on the chassis — it's the only on-frame control that
  still matters at that size.
- `.projects-tv-wrap` is centered; the external controls are pinned to
  the tile bottom.
- The channel-row ticker **still runs on phones** — `startChannelTicker`
  runs on every breakpoint, and a `ResizeObserver` on the guide viewport
  restarts it once the TV lays out from 0 height on the projects tile.

At `≤767px` (tablet/mobile general):

- Channel-list typography shrinks via `clamp()`.
- Year column on channel rows is hidden (least important data).
- Tune-in panel typography bumps up so prose reads at the smaller TV
  size.
- The TV-Guide top half lets info-line text bleed past its column edge
  into the avatar pane (rather than truncating "Portfolio Guide");
  the avatar drops to 0.55 opacity so the overlap reads cleanly.

### Adding music to a future project channel

1. Drop the mp3 in `public/audio/` named after the song
   (kebab-case, e.g. `roses-at-twilight.mp3`).
2. Add the slug → URL row to `CHANNEL_MUSIC` near the top of
   `src/modules/ui/projects.ts`:

   ```typescript
   const CHANNEL_MUSIC: Readonly<Record<string, string>> = {
     'nobhad-codes': '/audio/the-broken-hearted-sparrow.mp3',
     'the-backend': '/audio/anvil-chorus.mp3',
     'hedgewitch-horticulture': '/audio/roses-at-twilight.mp3',
     '<new-slug>': '/audio/<song-name>.mp3'
   };
   ```

3. That's it — `playTuneInSequence` reads the map and calls
   `tvSfx.playMusic(url)` automatically. No buffer registration, no
   wiring elsewhere.

National Jukebox is a good source for public-domain pre-1925 audio.
The IIIF endpoint pattern is
`https://tile.loc.gov/streaming-services/iiif/service:mbrsrs:mbrsjukebox:{id}:{id}/full/full/0/full/default.mp3`
where `{id}` comes from the `resources[0].files[0]` array in
`https://www.loc.gov/item/jukebox-{itemId}/?fo=json`.

## File reference

| File | Role |
|---|---|
| `public/data/portfolio.json` | Project data (slugs, title cards, per-card bg, isDocumented flag) |
| `src/modules/ui/projects.ts` | TV rendering, button wiring, tune-in animation, channel + power state, music lifecycle |
| `src/modules/audio/tv-sfx.ts` | Singleton audio engine — click, static, music, volume, mute event |
| `src/modules/animation/page-transition.ts` | Wheel/key channel cycling, page-entering / page-changed events |
| `src/styles/pages/projects.css` | All TV CSS — wrapper, screen, frame, buttons, hitboxes, focus rings, mute indicator, off-state, mobile breakpoints |
| `src/styles/pages/projects-detail.css` | Project detail page styles |
| `index.html` | Project detail HTML structure |
| `public/images/tv/chassis.webp` | TV chassis bezel art (2850×2186) — the "real-TV" version with rounded screen aperture, integrated speaker grille, detailed bezel |
| `public/images/tv/chassis-alt.webp` | Alternate chassis art (1426×1093, flatter / less detail) — kept around but not currently rendered |
| `public/images/tv/chassis-buttons-ref.webp` | Alpha-only buttons layer of `chassis-alt.webp` for re-measuring hitboxes if we ever swap to it |
| `public/images/tv/base-on.webp` | Lit screen base image |
| `public/images/tv/base-off.webp` | Dark off-state base image |
| `public/images/tv/title-cards/<name>.webp` | Composed title card per channel — exact filename comes from the JSON `titleCard.composed` field, which doesn't always match the slug (e.g. slug `nobhad-codes` → `no-bhad-codes.webp`, `hedgewitch-horticulture` → `hedgewitch.webp`) |
| `public/images/tv/title-cards/<name>_bg.webp` | Bg-only title card per channel (underscore: `no-bhad-codes_bg.webp`, `the-backend_bg.webp`, `hedgewitch_bg.webp`); path from the JSON `titleCard.bg` field |
| `public/images/tv/led/NN.webp` | LED digit overlay for channel NN |
| `public/audio/channel-click.mp3` | Mechanical click sample |
| `public/audio/tv-static.mp3` | CRT noise sample |
| `public/audio/<song-name>.mp3` | Per-channel music tracks |

## Key functions

In `src/modules/ui/projects.ts`:

- `injectTvFrame()` — builds the TV DOM, calls `wireTvButtons`,
  `wireMobileChannelButtons`, `wireVolumeState`,
  `wireChannelMusicLifecycle`, `preloadChannelDisplays`.
- `wireTvButtons()` — delegated click on `.crt-tv` for `[data-tv-btn]`,
  routes to `toggleTvPower` / `cycleTvChannel` / `tvSfx.stepUp/Down`.
  Power-off gate prevents non-POWER actions when the set is off.
- `wireMobileChannelButtons()` — same gate, but for the external
  `.projects-tv-channel-controls`.
- `wireVolumeState()` — toggles `.is-muted`, `.is-at-min`, `.is-at-max`
  in response to `tv-sfx:volume-change` events.
- `wireChannelMusicLifecycle()` — page-entering listener;
  stops/restarts music on cross-page navigation.
- `cycleTvChannel(±1)` — wraps through guide → projects → guide.
- `setTvChannel(idx, opts)` — index-based channel change;
  `cycle: true` triggers tune-in animation, `cycle: false` is a
  passive sync.
- `playTuneInSequence(slug)` — full tune-in animation + music.
- `transitionToGuide()` — animated cycle back to channel 01.
- `cancelTuneIn()` — kill animations, reset state, stop music, reset
  DOM.
- `toggleTvPower()` — preserve-state power off / restore-state power on.
- `setChannelDisplay(channelNumber)` — swap LED img.

In `src/modules/audio/tv-sfx.ts`:

- `bindGlobalClickListener()` — capture-phase document click listener.
- `primeContextSync()` — sync ctx creation + resume inside the
  gesture frame (iOS Safari requirement).
- `click()` — debounced tactile click sample through `clickGain`.
- `static(opts)` — envelope-shaped CRT noise burst through
  `masterGain`.
- `playMusic(url)` / `stopMusic()` — looping channel music with
  cross-fade.
- `setVolume(level)` — snaps to `VOLUME_STEPS [0, 0.25, 0.5, 0.75, 1.0]`,
  ramps `masterGain.gain`, persists to `localStorage`, dispatches
  `tv-sfx:volume-change` window event.
- `getVolume()` — current snapped level.

## Past mistakes worth remembering

- **Hitboxes on the labels, not the capsules.** The original
  chassis-button coords were measured by eye against the painted
  POWER / CHANNEL / VOLUME labels above each capsule; clicks on the
  actual button shape did nothing. Fix: measure from a buttons-only
  alpha export (`chassis-buttons-ref.webp`) by reading the bounding
  box of every non-transparent pixel per capsule.
- **Dark-pixel scan with >55% threshold cut off rounded ends.** A
  midway fix used a per-row dark-pixel scan with a 55% horizontal
  coverage threshold to isolate capsule from labels — but the
  threshold dropped the rounded tips of each capsule because at
  those rows dark coverage drops below 55%. Fix: use the
  alpha-bounding-box method instead.
- **`source.start` before `source.connect`** in `static()`. The
  source advanced unconnected for a few audio frames, the envelope
  ramps scheduled relative to a `now` captured after the start call
  were silently dropped, and no audible static played. Fix: schedule
  envelope first, then connect, then `source.start(now, offset)`.
- **Static peak gain too low.** Original 0.05 (power-on) and 0.028
  (channel-change) values, after passing through default masterGain
  0.5, were inaudible on anything quieter than studio monitors.
  Fix: calibrate against `CLICK_FIXED_GAIN = 0.22` so static sits
  clearly below the click in the audible mix.
- **Bubble-phase click listener** in `tv-sfx.ts` meant
  `primeContextSync` ran AFTER `.crt-tv`'s bubble-phase handler had
  already called `static()`. Fix: capture phase.
- **`handlePageChanged` calling `cancelTuneIn` on every return to
  projects.** Wiped channel state before the music could resume in
  the right channel. Fix: removed — channel state persists across
  navigation.
- **`toggleTvPower` calling `cancelTuneIn` on power off.** Same issue
  for the power cycle — channel state was wiped, so power-on landed
  on the guide. Fix: surgical timeline kill + screenBg save, no full
  state reset.
- **`.crt-tv__image` not in the `.is-powered-off` hide list.** The
  composed title-card lives outside `.crt-tv__screen`, so the
  off-state CSS didn't hide it; the title card bled through the dark
  off-state when powering down from a project channel. Fix: add it
  to the selector list.

## Change log

### 2026-05-06 — Image folder reorg + new chassis art

- Moved all TV assets under `public/images/tv/` with subfolders for
  `title-cards/` and `led/`. Old `vintage_television.webp` deleted in
  favor of the typo-fixed new chassis at `tv/chassis.webp`.
- Re-measured button hitboxes from `tv/chassis-buttons-ref.webp`
  (alpha-only buttons layer) by per-pixel bounding box — captures the
  full capsule footprint including rounded ends. Old measurements
  cut off the rounded tips and clipped the click area.
- Updated the calculated TV width to use the new chassis aspect ratio
  (1.305 vs 1.249).

### 2026-05-06 — TV state coherence + channel music

- Tied music to channel state via `cancelTuneIn → stopMusic`.
- POWER cycle preserves channel + per-card bg + tune-in DOM.
- Cross-page navigation pauses + resumes music for the preserved
  channel.
- Off-state CSS now also hides `.crt-tv__image`.
- Added looping per-channel music for channels 02–04 (LoC National
  Jukebox public-domain tracks).
- Added mute indicator (Lucide volume-x) at top-right of screen
  aperture, driven by `tv-sfx:volume-change` event.
- VOLUME ▼/▲ become `pointer-events: none` at vol = 0 / vol = 1.
- Focus rings now pixel-perfect on capsule shapes (full pill for
  POWER, half-pills for CHANNEL/VOLUME ▼▲).
- Audio plumbing fixes: capture-phase click listener, eager prefetch
  of click + static bytes, `source.start` ordering fix in `static()`,
  peak gain bumps for audibility.

### Earlier work

See git log for `src/modules/ui/projects.ts`,
`src/modules/audio/tv-sfx.ts`, and `src/styles/pages/projects.css` —
the TV channel system was added in `260dfc55 feat(projects): tv
channel system with tune-in animation` and iterated through several
commits before this consolidation.

## Related docs

- [`PROJECTS.md`](./PROJECTS.md) — admin-side project management
  system (different feature; same word, different scope).
- [`INTRO_ANIMATION.md`](./INTRO_ANIMATION.md) — sibling page-level
  animation feature.
