# Design and Animations Documentation

**Version 2.8+**

This document contains comprehensive documentation of all design decisions, animations, and implementations for the Pike Powder Coating website. It explains WHY every change was made to prevent repeating mistakes.

> **IMPORTANT**: See [USER_REQUESTS.md](./USER_REQUESTS.md) for a complete chronological log of all user inputs and requirements.

---

## Table of Contents
1. [GSAP Animations](#gsap-animations)
2. [Layout and Design](#layout-and-design)
3. [Image Organization](#image-organization)
4. [SVG Graphics](#svg-graphics)
5. [Typography](#typography)
6. [Component Specifications](#component-specifications)
7. [Content Guidelines](#content-guidelines)

---

## GSAP Animations

### ScrollSmoother
**WHY**: User requested smooth scrolling behavior from CodePen examples (Requests 27, 32)
**IMPLEMENTATION**: `src/App.tsx`
```typescript
useEffect(() => {
  ScrollSmoother.create({
    smooth: 1.5,
    effects: true,
  });
}, []);
```
**MARKUP**: App wrapped in `#smooth-wrapper` and `#smooth-content` divs
**CSS**: `src/styles/main.css` contains required smooth-wrapper styling

### SplitText Animation - Hero Heading
**WHY**: User requested SplitText animation for "Boston's Local Metal Coater" (Request 36)
**IMPLEMENTATION**: `src/components/Hero.tsx:27-44`
```typescript
useEffect(() => {
  if (!containerRef.current || !headingRef.current) return;

  // Wait for fonts to load before running SplitText
  // Prevents "SplitText called before fonts loaded" warning
  document.fonts.ready.then(() => {
    splitTextRef.current = new SplitText(headingRef.current, {
      type: 'chars',
      charsClass: 'split-char',
    });

    // Animate characters from below - starts on page load
    gsap.from(splitTextRef.current.chars, {
      duration: 0.6,
      ease: 'circ.out',
      y: 80,
      opacity: 0,
      stagger: 0.02,
    });
  });
}, []);
```
**CRITICAL**: Wrapped in `document.fonts.ready` promise to prevent console warnings and ensure accurate text measurement before splitting

### Service Boxes Scroll Animation
**WHY**: User requested service boxes animate in on scroll (Request 39)
**IMPLEMENTATION**: `src/components/Services.tsx:15-27`
```typescript
useEffect(() => {
  const boxes = gsap.utils.toArray('.service-box');

  gsap.from(boxes, {
    scrollTrigger: {
      trigger: '.services-grid',
      start: 'top 80%',
    },
    y: 60,
    opacity: 0,
    duration: 0.8,
    stagger: 0.15,
  });
}, []);
```
**EFFECT**: Boxes fade in from below with stagger when scrolled into view

### DrawSVG - Handlebar Logo (PENDING)
**WHY**: User provided CodePen example for handlebar SVG animation with scroll (Requests 14, 15)
**STATUS**: Not yet implemented
**REQUIREMENTS**:
- Animate SVG paths using GSAP DrawSVG plugin
- Trigger on scroll, not on click
- Use pike_handle_bars_logo.svg as source
- Create vector paths for animation

### GSAP Flip Plugin - Gallery (PENDING)
**WHY**: User provided CodePen example for CSS Grid animation (Requests 19, 20)
**STATUS**: Partial implementation - click-to-expand works but not using Flip
**REQUIREMENTS**:
- Use GSAP Flip plugin for smooth grid transitions
- Trigger on scroll, not on click
- Apply to checker gallery pattern

---

## Layout and Design

### Hero Section
**WHY**: Multiple user requests for positioning and spacing (Requests 6, 16, 22, 23, 25, 33, 35)

**Heading**:
- Text: "Boston's Local <br> Metal Coater" (line break required - Request 35)
- Position: Right side of page (Request 33)
- Animation: SplitText character animation on page load (Request 36)
- Animates out on scroll (Request 33)

**Contact Us Button**:
- Original position: Below "Boston's Local Metal Coater" heading (Request 16)
- Position: Right side of page, below heading (Request 33)
- Vertical centering: Between end of black bg and top of "Your Neighborhood Powder Coating Shop" (Request 6)
- User expressed uncertainty about centering (Request 25)

**Spacing**:
- No gap between hero and services sections (Request 23)
- Checkered pattern should continue to edge of viewport (Request 23)
- Equal space above "Our Services" section added later (Request 39)

### Our Services Section
**WHY**: User requested equal spacing and breathing room (Request 39)

**Spacing**: `src/components/Services.tsx`
```typescript
<section className="services-section py-24 md:py-32">
```
**EXPLANATION**: Equal padding top and bottom (py-24 = 96px mobile, py-32 = 128px desktop)
**ANIMATION**: Service boxes animate in on scroll with stagger

### Footer and Contact Section
**WHY**: User requested consistency across all pages (Requests 2, 17)

**REQUIREMENT**: Footer and contact section must look identical on:
- Home page
- About page
- All other pages

**IMPLEMENTATION**: Shared Footer component used across all pages

### Page Background Transitions
**WHY**: User requested smart detection of black-to-white transitions aligning with squares (Requests 3, 8)

**REQUIREMENT**: Where black background transitions to white must align with checkered gallery squares
**STATUS**: Implemented with tailwind background utilities and careful spacing

---

## Image Organization

### White Square Images (_wht_sq)
**WHY**: User added images ending in `_wht_sq` with white backgrounds, all same shape (Request 8)

**LOCATION**: CheckerGallery component (`src/components/checker-gallery/CheckerGallery.tsx`)

**IMAGES** (23 total):
1. powder_coated_blue_metallic_flake_bicycle_frame_wht_sq.jpg
2. powder_coated_blue_metallic_flake_bicycle_frame_close_up_wht_sq.jpg
3. automotive_wheels_powder_coating_wht_sq.jpg
4. powder_coated_gloss_black_automotive_wheels_wht_sq.jpg
5. art_installation_powder_coating_wht_sq.jpeg
6. cylinder_head_before_wht_sq.jpeg
7. cylinder_head_after_wht_sq.jpeg
8. custom_powder_coated_blue_bike_frame_wht_sq.jpeg
9. cylinder_head_comparison_wht_sq.jpeg
10. custom_powder_coated_railings_wht_sq.jpeg
11. custom_powder_coated_automotive_springs_wht_sq.jpeg
12. custom_powder_coated_white_bike_frame_wht_sq.jpeg
13. custom_powder_coated_gloss_black_motorcycle_parts_wht_sq.jpeg
14. powder_coated_gloss_black_motorcycle_fender_wht_sq.jpeg
15. powder_coated_satin_black_motorcycle_fender_wht_sq.jpeg
16. powder_coated_satin_black_motorcycle_engine_cover_wht_sq.jpeg
17. custom_powder_coated_satin_black_motorcycle_fender_wht_sq.jpeg
18. custom_powder_coated_wheels_wht_sq.jpeg
19. powder_coated_pink_bike_frame_wht_sq.jpeg
20. powder_coated_satin_black_automotive_wht_sq.jpeg
21. custom_powder_coated_blue_automotive_wheel_wht_sq.jpeg
22. powder_coated_black_wheel_closeup_wht_sq.jpeg
23. cylinder_head_after_wht_sq.jpeg (Note: Duplicate, but user wanted ALL images used - Request 40)

**CRITICAL**: All 23 images MUST be used - "some whiite square pix are missing from gallery" (Request 38)

**GRID LAYOUT**: `src/pages/Home.tsx` - GRID_LAYOUT defines 8 rows with specific image/black square positions

### Non-White Square Images
**WHY**: User clarified "everything not in white sq should be in featured" (Request 42)

**LOCATION**: FeaturedWork carousel (`src/components/FeaturedWork.tsx`)

**IMAGES** (17 total):
1. powder_coated_blue_metallic_flake_bicycle_frame.jpg
2. automotive_wheels_powder_coating.jpg
3. powder_coated_gloss_black_automotive_wheels.jpg
4. art_installation_powder_coating.jpeg
5. custom_powder_coated_blue_bike_frame.jpeg
6. cylinder_head_before.jpeg
7. cylinder_head_after.jpeg
8. custom_powder_coated_railings.jpeg
9. custom_powder_coated_automotive_springs.jpeg
10. custom_powder_coated_white_bike_frame.jpeg
11. custom_powder_coated_gloss_black_motorcycle_parts.jpeg
12. powder_coated_gloss_black_motorcycle_fender.jpeg
13. custom_powder_coated_wheels.jpeg
14. powder_coated_pink_bike_frame.jpeg
15. powder_coated_satin_black_automotive.jpeg
16. custom_powder_coated_blue_automotive_wheel.jpeg
17. powder_coated_black_wheel_closeup.jpeg

**CRITICAL**: ALL non-wht_sq images must be used - user emphasized art installation is "really cool" (Request 40)

**IMPLEMENTATION**: Removed "The Shop" title from FeaturedWork section (Request 24)

### Gallery Click-to-Expand
**WHY**: User requested click one square to make bigger with title, other squares orient around it (Request 33)

**IMPLEMENTATION**: `src/components/checker-gallery/CheckerGallery.tsx`
```typescript
const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

const handleImageClick = (imageIndex: number) => {
  setExpandedIndex(expandedIndex === imageIndex ? null : imageIndex);
};
```

**STYLING**: `src/styles/checker-gallery.css`
```css
.expanded {
  grid-column: span 2;
  grid-row: span 2;
  z-index: 10;
}

.gallery-image-title {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 0.75rem;
  font-size: 0.875rem;
  text-align: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.expanded .gallery-image-title {
  opacity: 1;
}
```

**BEHAVIOR**: Click to expand to 2x2 cells, click again to return to original size

---

## SVG Graphics

### Pike Handlebar Logo
**WHY**: User created custom handlebar SVG logo (Requests 4, 5, 25, 28)

**FILE**: `/images/pike_handle_bars_logo.svg`

**USAGE**:
1. **Header Logo**: Static version in Header component (`src/components/Header.tsx`)
   ```typescript
   <img
     src="/images/pike_handle_bars_logo.svg"
     alt="Pike Powder Coating Logo"
     style={{ width: '40px', height: '40px' }}
   />
   ```
   Position: Left of "Pike Powder Coating" text (Request 25)

2. **Animated Version** (PENDING): DrawSVG animation with scroll
   - Requires vector paths to be created (Request 25)
   - Should animate on scroll, not click (Request 15)

### Favicon
**WHY**: User exported new PNG without white behind circle (Request 25)

**FILE**: `/favicon.png` (in root)

**REQUIREMENT**: Circle should not have white background

---

## Typography

### Fonts
**WHY**: Adobe Typekit fonts used for brand consistency

**FONTS**:
- **halyard-micro**: Primary heading font
- **Space Mono**: Monospace accent font

**LOADING**: Adobe Typekit loaded in `index.html`

**CRITICAL**: SplitText MUST wait for `document.fonts.ready` before initializing to prevent:
- Console warning: "SplitText called before fonts loaded"
- Incorrect text measurement and layout shifts

### Heading: "Boston's Local Metal Coater"
**WHY**: User specified exact formatting (Request 35)

**FORMAT**: "Boston's Local <br> Metal Coater"
- Must include `<br>` line break between "Local" and "Metal"
- Uses SplitText character animation (Request 36)
- Animates on page load, animates out on scroll (Request 33)

---

## Component Specifications

### Header Component
**FILE**: `src/components/Header.tsx`

**ELEMENTS**:
1. Pike handlebar logo SVG (left side)
2. "Pike Powder Coating" text
3. Navigation menu

**REQUIREMENT**: Logo must be static version, not animated (Request 25)

### Hero Component
**FILE**: `src/components/Hero.tsx`

**ELEMENTS**:
1. Heading: "Boston's Local <br> Metal Coater" (right side)
2. Contact Us button (below heading, right side)

**ANIMATIONS**:
- SplitText character animation on page load
- Heading animates out on scroll

**SPACING**: Positioned with vertical centering between black bg and shop tagline

### Services Component
**FILE**: `src/components/Services.tsx`

**LAYOUT**: 4 service boxes in grid

**SPACING**: Equal padding top/bottom (py-24 md:py-32)

**ANIMATION**: Boxes animate in from below on scroll with 0.15s stagger

### CheckerGallery Component
**FILE**: `src/components/checker-gallery/CheckerGallery.tsx`

**IMAGES**: All 23 `_wht_sq` images

**LAYOUT**: Custom grid defined by GRID_LAYOUT in Home.tsx
- 8 rows
- Mix of images and black squares
- Responsive columns

**INTERACTION**: Click to expand to 2x2, click to collapse

**TITLES**: Show title overlay when expanded

**SIZES**: "make squares for cckered gellery bigger" (Request 24)

### FeaturedWork Component
**FILE**: `src/components/FeaturedWork.tsx`

**IMAGES**: All 17 non-`_wht_sq` images

**LAYOUT**: Carousel/slider

**TITLE**: No title (removed "The Shop" - Request 24)

### Footer Component
**FILE**: `src/components/Footer.tsx`

**REQUIREMENT**: Must be consistent across all pages (Requests 2, 17)

**CONTENT**: Grammar and syntax must be correct (Request 33)

### AboutPage
**FILE**: `src/pages/AboutPage.tsx`

**ELEMENTS**:
1. Picture of Zach (Request 45)
2. About content from constants

**SEO**:
- Title: "About Pike Powder Coating - Your Neighborhood Metal Coating Shop"
- Description: Uses "shop" not "workshop" (Request 43)

**IMAGE**: `/images/zach_at_the_shop.jpeg`

---

## Content Guidelines

### Terminology
**WHY**: User corrections for consistency (Requests 43, 44)

**RULES**:
1. Use "shop" NOT "workshop" everywhere
2. Capitalize "AM" and "PM" in hours
3. Capitalize street addresses (e.g., "318 Lincoln St")

### Grammar and Syntax
**WHY**: User requested fixes in contact/footer content (Request 33)

**FILE**: `src/config/constants.ts`

**CORRECTIONS MADE**:
- "isn't a option" → "isn't an option"
- "workshop" → "shop"
- Address capitalization
- Hours capitalization

### Contact Us Button Targets
**WHY**: User requested set locations for each content section (Request 18)

**REQUIREMENT**: Contact Us button should have specific scroll targets for each section

**STATUS**: Needs implementation with scroll-to-section functionality

---

## Change Log

### v2.8
- Implemented SplitText animation for hero heading
- Added service boxes scroll animation
- Fixed all `_wht_sq` image references (23 total)
- Expanded FeaturedWork to 17 items (all non-wht_sq images)
- Added click-to-expand gallery functionality
- Fixed terminology: "shop" not "workshop"
- Capitalized AM/PM in hours
- Fixed grammar: "isn't an option"
- Added equal spacing to Services section
- Removed "The Shop" title from FeaturedWork

### v2.9
- Fixed SplitText font loading warning
- Wrapped SplitText in `document.fonts.ready` promise
- Prevented layout shifts during text splitting

---

## Pending Features

### High Priority
1. **DrawSVG Handlebar Animation**: Animate logo SVG paths on scroll
2. **GSAP Flip Gallery**: Use Flip plugin for grid transitions
3. **Contact Us Scroll Targets**: Implement scroll-to-section for button

### Medium Priority
1. **Clamp Effects**: Add to ScrollSmoother (Request 34)
2. **Hero Scroll Animation**: Animate heading out on scroll

### Notes
- All documentation must be updated BEFORE commits
- Every change must include WHY explanation
- Reference USER_REQUESTS.md for original user inputs
