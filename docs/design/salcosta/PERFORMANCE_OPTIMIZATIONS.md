# Performance Optimizations - Implementation Guide

**Analysis Date:** December 20, 2025  
**Reference:** Sal Costa's site performance analysis

---

## Key Performance Differences

### Sal Costa's Optimizations

1. **Single Font Family** - One request (Plus Jakarta Sans)
2. **`will-change` on Animated Elements** - `transform, opacity`
3. **Efficient Animations** - CSS transforms only (no layout properties)
4. **Bundle Sizes:**
   - CSS: 35KB (minified)
   - JS: 275KB (React bundle)
5. **Font Preconnect/Preload** - Early connection setup
6. **DNS Prefetch** - For analytics domains

### Current Site Issues

1. **Multiple Font Families** - Acme + system fonts (more requests)
2. **Incomplete `will-change` Usage** - Only on some animated elements
3. **GSAP Overhead** - Large library, may have unused plugins
4. **Font Loading** - Could be optimized with preload
5. **Bundle Size** - Unknown, needs analysis

---

## Implementation Plan

### 1. Add `will-change` to All Animated Elements

**Current State:** Only 5 files use `will-change`

**Target:** All animated elements should have `will-change: transform, opacity, filter`

**Files to Update:**
- All animation modules
- All component styles with animations
- Page transition elements

### 2. Optimize Font Loading

**Current:** 
- Acme font loaded via `@import` (blocks rendering)
- Google Fonts fallback

**Optimize:**
- Add `<link rel="preload">` for Acme font
- Use `font-display: swap` (already done)
- Consider self-hosting fonts

### 3. Review GSAP Usage

**Check:**
- Are all GSAP plugins being used?
- Can some animations be CSS-only?
- Is GSAP loaded from CDN or bundled?

**Optimize:**
- Remove unused GSAP plugins
- Use CSS animations where possible
- Consider lazy-loading GSAP

### 4. Bundle Size Analysis

**Action Items:**
- Run bundle analyzer
- Check chunk sizes
- Identify large dependencies
- Optimize code splitting

### 5. Animation Performance

**Ensure:**
- All animations use `transform` and `opacity` only
- No `width`, `height`, `top`, `left` animations
- Use `filter` sparingly (blur is OK, but expensive)

---

## Priority Implementation

### High Priority (Immediate Impact)

1. ✅ Add `will-change` to all animated elements
2. ✅ Optimize font loading with preload
3. ✅ Review and optimize GSAP usage

### Medium Priority (Good Impact)

4. ✅ Bundle size analysis and optimization
5. ✅ Ensure all animations use transforms

### Low Priority (Nice to Have)

6. ✅ DNS prefetch for external domains
7. ✅ Self-host fonts for better control

---

## Success Metrics

- **LCP (Largest Contentful Paint):** < 2.5s
- **FID (First Input Delay):** < 100ms
- **CLS (Cumulative Layout Shift):** < 0.1
- **Bundle Size:** Main bundle < 150KB (gzipped)
- **Font Load Time:** < 100ms

