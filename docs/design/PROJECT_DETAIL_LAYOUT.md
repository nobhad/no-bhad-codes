# Project Detail Page - Layout Research & Direction

**Status:** Research Complete - Awaiting Direction Decision
**Last Updated:** 2026-03-25

## Current State

The project detail page currently displays:

1. Title card as hero image (branded graphics per project)
2. Title + status badge
3. Tagline (italic)
4. Metadata (Role, Year, Duration) + Description (two-column on desktop)
5. Tools list (tag pills)
6. Divider
7. Case study sections: Challenge, Approach, Key Features, Results
8. Action links (View Live, Source Code)
9. Prev/Next navigation

### Known Issues

- Screenshots removed (were dumped as raw image wall - no framing, no context)
- Massive dead space between Results and action links
- Massive dead space between action links and prev/next nav
- Page is entirely text below the title card - no visual showcase of actual work
- Prev/next shows same project when only 2 documented projects exist (fixed: added Hedgewitch as 3rd)
- Hero image field empty for all projects (title card used as fallback)

---

## Award-Winning Portfolio Research

### Sources Analyzed

- [Dennis Snellenberg](https://dennissnellenberg.com/work) - Awwwards SOTD, GSAP + Barba.js + Locomotive Scroll
- [Cappen](https://cappen.com) - Muzli Top 100 2025, GSAP scroll-triggered animations
- [Brand Appart](https://brandappart.com) - Paris studio, carousel-based case studies
- [Joffrey Spitzer](https://tympanus.net/codrops/2026/02/18/joffrey-spitzer-portfolio-a-minimalist-astro-gsap-build-with-reveals-flip-transitions-and-subtle-motion/) - Awwwards SOTD, Astro + GSAP (same stack as Hedgewitch)
- [Ducklin](https://ducklin.de/case-studies/scrub-gsap.html) - Scroll-scrub with GSAP ScrollTrigger
- [Daiki Fujita](https://tympanus.net/codrops/2025/09/30/abstract-feelings-concrete-forms-daiki-fujita-portfolio-2025/) - Awwwards, particle-based project reveals
- [Elliott Mangham](https://elliott.mangham.dev) - 17x Awwwards SOTD, GSAP + Vite
- [Corentin Bernadou](https://www.awwwards.com/sites/corentin-bernadou-portfolio) - Awwwards SOTD March 2026, GSAP + WebGL
- [Lisovskiy Studio](https://lisovskiy.work) - 40+ projects, dedicated case study pages
- [Abhishek Jha](https://abhishekjha.me) - Card-based with year + service tags
- [Muzli Top 100 Portfolios 2025](https://muz.li/blog/top-100-most-creative-and-unique-portfolio-websites-of-2025/)
- [Awwwards Portfolio Winners](https://www.awwwards.com/websites/winner_category_portfolio/)
- [Case Study Club](https://www.casestudy.club/journal/ux-designer-portfolio)

---

## Two Schools of Case Study Presentation

### School A: "Let the Work Speak"

**Examples:** Dennis Snellenberg, Joffrey Spitzer, Elliott Mangham

**Structure:**

1. Title (large)
2. Metadata row (Role, Credits, Location, Year)
3. Live site link
4. Images only - 6-8 curated images in vertical scroll (zero body text)
5. "Next case" footer

**Image treatment:**

- Desktop mockups at ~62% aspect ratio
- MacBook Pro device frames at ~50% aspect ratio
- Mobile screenshots at ~187% aspect ratio (tall)
- Alternating full-bleed and contained widths
- No captions, no annotations

**Pros:**

- Clean, confident, modern
- Fast to scan
- Forces you to curate only your best visuals
- Dominant pattern on Awwwards winners

**Cons:**

- Requires polished, high-quality screenshots
- No context for non-designers (hiring managers, clients)
- Process and thinking are invisible

### School B: "Tell the Story"

**Examples:** Cappen, Brand Appart, traditional UX case studies

**Structure:**

1. Hero / title card
2. Metadata strip
3. Challenge / problem statement
4. Approach / process
5. Visual showcase (images interspersed with text)
6. Key features / solution
7. Results / impact
8. Action links + next project

**Image treatment:**

- Full-bleed images alternating with contained crops
- Device mockups for app/web screenshots
- Annotated close-ups for specific features
- Scroll-snap galleries for multiple screens in flow
- Before/after sliders for comparisons

**Pros:**

- Shows thinking, not just output
- Accessible to non-designers
- Better for complex projects (The Backend, Hedgewitch)
- SEO-friendly (actual content to index)

**Cons:**

- Risk of being text-heavy and boring if not balanced with visuals
- Requires tighter editorial discipline

---

## Specific Layout Patterns (2025-2026 Trends)

### Pattern 1: The Scroll Story

Single-column long-scroll page. Full-bleed hero images alternate with text sections. Each section fades/slides in on scroll via GSAP ScrollTrigger. Inherently mobile-first since it is already single-column. Dominant pattern on award-winning portfolios.

### Pattern 2: Sticky Media + Scrolling Text

On desktop, one column shows a sticky device mockup while the adjacent column scrolls through text. As each text block enters the viewport, the sticky image crossfades to match. On mobile, linearizes to image-then-text stacked blocks.

### Pattern 3: Metrics Strip

Horizontal band with contrasting background displaying 3-4 key metrics in large type. On mobile becomes a 2x2 grid. Placed after hero or in results section.

### Pattern 4: Full-Bleed to Detail Zoom

Full-width screenshot followed immediately by a cropped close-up of a specific UI detail with annotation. Contrast between scales creates visual interest and communicates attention to detail.

### Pattern 5: Dramatic Typography Hero

Project title in oversized bold type filling the viewport width. Subtle GSAP scroll animation (letter-spacing narrowing, weight shifting). Tagline and hero image below. Works well on mobile where large type fills the small screen.

### Pattern 6: Horizontal Parallax

Work section scrubs horizontally while the page pins vertically (GSAP ScrollTrigger). Dynamic typography as visual anchor with letter-spacing and font-weight animated by scroll progress. Cinematic narrative pacing.

---

## Visual Presentation Techniques

### CSS Device Mockups

Pure CSS phone/laptop/tablet frames. No image assets for the frame itself - built with `border-radius`, `box-shadow`, pseudo-elements. Screenshots drop in as standard `<img>`. Responsive by default. Libraries: [Devices.css](https://devicescss.xyz), or build custom.

### Scroll-Snap Gallery

Native CSS horizontal carousel. No JS required. Touch-friendly swipe on mobile.

```css
.gallery {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  gap: var(--space-4);
}

.gallery > figure {
  scroll-snap-align: center;
  flex-shrink: 0;
  width: 85%; /* peek at next slide */
}
```

### Before/After Slider

Drag-to-compare for light/dark mode or redesign projects. `img-comparison-slider` web component is under 4KB gzipped, touch-friendly, framework-agnostic. Use sparingly - one per project max.

### GSAP ScrollTrigger Reveals

Fade sections in as they enter the viewport. Subtle `translateY(30px)` + `opacity: 0` to `1`, duration 0.4-0.6s, ease `power2.out`. Already partially implemented for hero/intro.

### Progressive Image Loading

- `loading="lazy"` on all images
- `<picture>` with WebP/AVIF sources
- `aspect-ratio` on containers to prevent CLS
- Poster frames for video content

---

## Mobile-First Considerations

### Content Scannability (NNGroup Research)

- 79% of users scan, only 16% read word-by-word
- No paragraph longer than 3-4 lines on mobile
- Bold key phrases within paragraphs
- 48-64px vertical space between sections
- Section headers as large visual signposts
- Metrics in large type, not buried in paragraphs

### Image Handling on Mobile

- Single-column stacking always (never side-by-side on small screens)
- Scroll-snap carousels for multiple screenshots
- Phone mockups capped at 250-300px width
- Full-bleed images use viewport naturally

### Navigation on Mobile

- Prev/Next: show only "Next Project" as full-width card
- Sticky minimal header (40-50px) with back link, hide on scroll-down
- Or floating "Back" button (current implementation)

---

## Implementation Approach Options

### Option A: Quick Fix (School B, Tighten Existing)

Keep current structure. Fix spacing. Add GSAP ScrollTrigger reveals. Weave 4-6 curated images between text sections in device mockups. Tighten footer.

**Effort:** Low
**Impact:** Medium

### Option B: Hybrid (School B + Visual Showcase Section)

Keep case study text but add a dedicated visual showcase section between Approach and Key Features. Use scroll-snap gallery or stacked device mockups. Add metrics strip for Results. GSAP reveals throughout.

**Effort:** Medium
**Impact:** High

### Option C: Full Redesign (School A Inspired)

Strip to title + metadata + images + next project. CSS device mockups for all screenshots. GSAP entrance animations. Minimal or zero body text. Requires high-quality curated screenshots for every project.

**Effort:** High (mostly asset creation, not code)
**Impact:** High (if screenshots are strong)

---

## Data Model Changes Needed

Current `screenshots` field is a flat array of image paths. For proper presentation, each screenshot needs metadata:

```json
{
  "screenshots": [
    {
      "src": "/portfolio/nobhad-codes/home-light-desktop.png",
      "type": "desktop",
      "label": "Home - Light Mode",
      "annotation": "Interactive business card with GSAP flip animation"
    },
    {
      "src": "/portfolio/nobhad-codes/home-light-mobile.png",
      "type": "mobile",
      "label": "Home - Mobile",
      "annotation": null
    }
  ]
}
```

Supported `type` values: `desktop`, `mobile`, `tablet`, `full-bleed`, `detail-crop`

This allows the renderer to automatically apply CSS device frames based on type.

---

## Inspiration Notes

### Studio Linear - Eyeball Tracking + Cursor

**Source:** [studiolinear.com/about](https://studiolinear.com/about)

**Eye-tracking pupils:** Two `.eye` elements with `.pupil` children that follow the cursor via JS. Calculates distance from cursor to eye center, applies `translate()` transform clamped within the eye boundary (`Math.max(-maxX, Math.min(dx, maxX))`). Real-time, lightweight, no libraries needed.

**Eyeball cursor on hover:** Custom cursor PNG replaces the default pointer on links, buttons, and `[role="button"]` elements:

```css
a:hover, button:hover, [role="button"]:hover {
  cursor: url("Eyes-Cursor.png") 16 16, pointer;
}
```

The `16 16` sets the hotspot coordinates for click precision.

**Planned use:** Implement on the projects page. Cursor-following eyes fit the coyote theme - coyote eyes watching you browse. Eyeball cursor on project card hover.

---

## Open Questions

- [ ] Which school / option to pursue (A, B, or C)?
- [ ] Content reorder: move Challenge before Tools?
- [ ] Results: keep as bulleted list or convert to metrics strip?
- [ ] Visuals: device mockups, scroll-snap gallery, annotated close-ups, or mix?
- [ ] Spacing: tighten as part of this work or separate pass?
- [ ] Data model: restructure screenshots array with metadata?

---

## Reference Links

- [Awwwards Portfolio Winners](https://www.awwwards.com/websites/winner_category_portfolio/)
- [Awwwards Project Page Collection](https://www.awwwards.com/awwwards/collections/project-page/)
- [Dennis Snellenberg Work](https://dennissnellenberg.com/work)
- [Joffrey Spitzer Codrops Case Study](https://tympanus.net/codrops/2026/02/18/joffrey-spitzer-portfolio-a-minimalist-astro-gsap-build-with-reveals-flip-transitions-and-subtle-motion/)
- [Eduard Bodak Codrops Case Study](https://tympanus.net/codrops/2025/07/29/built-to-move-a-closer-look-at-the-animations-behind-eduard-bodaks-portfolio/)
- [Stefan Vitasovic Codrops Case Study](https://tympanus.net/codrops/2025/03/05/case-study-stefan-vitasovic-portfolio-2025/)
- [Ducklin Scroll-Scrub GSAP](https://ducklin.de/case-studies/scrub-gsap.html)
- [Devices.css - Pure CSS Device Mockups](https://devicescss.xyz)
- [img-comparison-slider](https://github.com/sneas/img-comparison-slider)
- [Muzli Top 100 Portfolios 2025](https://muz.li/blog/top-100-most-creative-and-unique-portfolio-websites-of-2025/)
- [Case Study Club](https://www.casestudy.club/journal/ux-designer-portfolio)
- [UXfol.io Case Study Template 2026](https://blog.uxfol.io/ux-case-study-template/)
- [NNGroup - Scannability Research](https://www.nngroup.com/articles/table-of-contents/)
- [Smashing Magazine - Sticky Menus UX](https://www.smashingmagazine.com/2023/05/sticky-menus-ux-guidelines/)
