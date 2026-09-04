# Portfolio capture

How the portfolio's images and video were made, and what to watch for when
remaking them. Written after the Aug 29 2026 session, where most of these notes
were learned by getting them wrong first.

## Running

The scripts drive Playwright directly rather than the test runner. They keep
working files in `$CAPTURE_WORK` (default `/tmp/nbc-capture`) and write finished
assets into `public/portfolio/`.

```sh
mkdir -p /tmp/nbc-capture
npm run dev                       # localhost:4000, must be running

node scripts/capture/nbc-intro.mjs light        # intro GIF source, one theme
bash scripts/capture/nbc-walk-run.sh            # site walkthroughs, both themes
bash scripts/capture/social-square.sh           # 1080x1080 social video
node scripts/capture/portal-shot.mjs            # The Backend hero stills
node scripts/capture/hw-capture.mjs site desktop  # Hedgewitch, needs its own server
```

Hedgewitch runs from its own repo (`~/Projects/Development/Active/hedgewitch_horticulture`).
Check the port before capturing: Astro falls back to 4322 when 4321 is taken,
and **the port it prints may bind IPv6 only**, in which case `localhost` and
`127.0.0.1` both refuse and only `http://[::1]:<port>` connects.

## Browser

Use `chromium.launch({ channel: 'chrome' })`. The Playwright pinned to this repo
wants a Chromium build that is not in the local cache, so the bundled binary
fails; `channel: 'chrome'` uses the installed Google Chrome and downloads
nothing.

**Run headless.** Two reasons, both learned the hard way:

- A headed window sitting in front picks up your real trackpad. Phantom scroll
  events landed in the middle of recordings and, once, drove the page to a
  different project mid-capture.
- Never diagnose animation state through a Chrome-extension-driven tab. Those
  are `document.hidden`, so `requestAnimationFrame` never fires, GSAP's ticker
  never advances, and every tween sits frozen at its start values with its
  promise pending. That looks exactly like a hung transition and cost a whole
  session before the cause was found.

## Rules that produced usable footage

**Cut from timestamps you recorded, not from pixels afterwards.** Every attempt
to find a beat by inspecting frames failed on some edge: a blank white frame can
encode large, so file size does not find it; the unstyled document is full of
text, so a content test does not either; the About page's black-and-white
photograph reads as "paw" to a black-pixel test. Have the browser record the
moment (`Date.now() - t0`) and cut there.

**The recording starts before the first paint.** `recordVideo` begins when the
context is created, so every file opens on a blank frame and, in dev, on the
unstyled document — Vite injects CSS through JS. Wait for `--font-size-base` to
exist, write that timestamp out, and trim to it.

**`introComplete` is not the end of the intro.** Measured from load:
`introComplete` turns true at ~2.2s, the `intro-finished` class lands at ~4.1s,
and `#intro-morph-overlay` is not clear until ~4.5s. Waiting on the first one
flips the business card while the paw is still retracting.

**The card ignores clicks it is not ready for.** `business-card-interactions.ts`
drops any click while `isEnabled` is false or `isAnimating` is true, silently.
Wait for both. Flip direction comes from *where* you click: left of centre turns
left, right of centre turns right. Left it alone too long and its idle timer
starts wiggling and flipping by itself, which reads as a flash in a loop.

**The paw exit only plays on the blur path.** `transitionTo`'s slide mode never
plays it — the docstring says so — and arrow keys are slide mode. Leave the
intro with a hash navigation or the exit animation simply does not happen.

**Scroll-driven animations advance only while scrolling.** Hedgewitch's hero and
footer seam are scrubbed ScrollTriggers: pausing does not advance them by a
frame, and `scrub: 1` keeps easing for about a second after the scroll stops.
Ride through the trigger's range, then hold for the lerp. Time-based animations
are the opposite and need the page to stop.

**Pacing, for a scroll-driven site.** Scroll continuously off
`requestAnimationFrame` at a few px per frame — hops with pauses stutter, and a
fast even scroll clips every reveal mid-play. Hold only on sections that
actually animate (the site's own lazy-init table in `src/main.ts` is the list),
hold them when they are *centred* rather than at the first frame that qualifies,
and take the outermost section only, or a section and its own content wrapper
both match and it stops twice on one screenful.

**Set the theme before the first paint** with an init script writing
`localStorage.theme` and `data-theme`, or the intro plays in the wrong theme and
flips afterwards.

**Set the consent cookie** (`tracking_consent`) on the context or the banner
rides along the bottom of the frame.

## Authenticated captures

The Hedgewitch admin uses Netlify Identity. `hw-login2.mjs` opens a headed
window against a persistent profile directory; **sign in yourself** — the
scripts never handle credentials — and it saves the profile for later runs.

Three things bite here:

- Sessions are per origin. `localhost:3000` and `[::1]:3000` are different
  origins, so signing in on one leaves the other at the login gate.
- Netlify Identity issues 1-hour JWTs. A profile saved earlier in the day will
  render the admin shell with "You're signed out" in the content area — the URL
  does not redirect, so a URL check will not catch it. Assert on rendered
  content.
- The admin builds itself client-side after the identity check and takes about
  six seconds. Anything shorter photographs an empty shell.

Data comes from Netlify Functions, which a plain preview server does not serve,
so each screen paints an error card. `admin-shots.mjs` fulfils
`**/.netlify/functions/**` with a well-formed payload — note `hasData: true` and
a populated `submissions` array, without which the dashboard short-circuits to a
setup notice instead of rendering its tables. The point of those frames is the
structure of the CMS, not the studio's live content.

## Encoding

| output | format | settings |
| --- | --- | --- |
| walkthroughs | WebM VP9 | `-crf 36 -b:v 0 -row-mt 1 -cpu-used 3` |
| social video | MP4 H.264 | `-crf 20 -preset slow -movflags +faststart`, 30fps |
| hero loops | GIF | `fps=10`, `palettegen=max_colors=128`, `dither=none` |
| stills | PNG / WebP | 1440x900 desktop, 390x844 mobile, matching the existing heroes |

Social clips are written outside the repo, to
`~/Projects/Design/no-bhad-codes/social-media` (override with `$SOCIAL_OUT`).
They are things to post rather than code or site assets, so they sit with the
project's other design work instead of being versioned and deployed with the
site.

**Trimming needs a re-encode.** `-ss` with `-c copy` snaps to the nearest
keyframe, and these recordings have sparse ones — it reported the same duration
and changed nothing. `-ss` on a re-encode cuts exactly.

**Cut the dead air.** A 17s intro recording carried 3.8s of a motionless card
before the first flip and 1.6s more before the paw returned — over half the loop
was a still image. Build from several `trim` segments joined with `concat`; every
join lands on the card at rest in the same position, so none of them show.

GIF is the wrong format for photographic content. The Hedgewitch hero came to
2MB as a GIF against 1MB as animated WebP at a larger size. Both go in an
`<img>`; the GIF was kept only because it was asked for by name.

## Comparing two states (visual regression)

Used when a CSS change has to be shown not to have moved anything it did not
mean to move. ImageMagick is already on this machine: `compare -metric AE a.png
b.png null:` prints a count of differing pixels.

**Capture each state twice and diff it against itself first.** The noise floor
belongs to the state, not to the project, and it is large: on identical code,
About came back 8019px different at 1280 and 9526px at 393 (the photograph
rotates), Projects 12666px and 3621px (the CRT flickers), Home 37px and 14px,
Contact 0px. A change smaller than that floor is not a finding.

**A capture taken straight after a rebuild races the intro.** This produced two
false alarms in one sitting — `1280-home` reported 8374px against a 37px floor
and `1280-about` 19006px, both looking like real regressions. Both were the
business card caught at a different point of its entrance, because the capture
began while Vite was still recompiling after a `git stash`. Captured again with
a longer settle, before-vs-before was 66px and every before/after cross-pair
27-77px: no change at all. If one state was captured under different timing than
the other, the comparison is measuring the timing.

**A two-sample floor understates anything with discrete states.** The About
photograph is not noisy in a Gaussian way — it rotates through a set of images,
so two samples may land on the same one and report a floor near zero that a
third sample blows straight through. Take more samples, or do not trust the
magnitude.

**Localise the difference instead of trusting its size.** Far more decisive, and
it survives all of the above:

```sh
magick before.png after.png -compose difference -composite -colorspace Gray d.png
for y in 0 100 200 300 400 500 600 700 800; do
  printf "y=%s %s\n" "$y" \
    "$(magick d.png -crop 393x100+0+$y +repage -threshold 1% \
        -format '%[fx:int(mean*w*h)]' info:)"
done
```

A real CSS fix has a signature: swapping a dropped `text-shadow` token in the
mobile nav produced **exactly 2043px, confined to y=0-100, on all four 393px
routes**, and no differing band whatsoever at 1280 — which is what a
deterministic change looks like, and is not something an animation can fake.
Animation residue stays in the region that animates.

**Direct-load each route.** Walking several hash routes in one page catches the
intro mid-flight, and the business card's opacity is set inline by GSAP, so it
races. One page per route, `#/no-such-page` included.

## Diagnostics

`spectrum.mjs` decodes audio files and reports RMS and a high-frequency ratio —
it is what showed the channel music's crackle is in the recordings themselves
rather than in the sound effects. `audio-measure.mjs` taps the output by
wrapping `AudioNode.prototype.connect` and reports actual amplitude reaching the
speakers, which is the only way to compare a noise burst against music honestly:
broadband noise reads far louder than a tonal track at the same gain.
