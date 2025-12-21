# Golden Ratio Typography System

**Mathematical Constant:** φ (phi) = 1.618033988749...

The golden ratio creates naturally harmonious proportions that have been used in design, architecture, and art for millennia.

---

## Type Scale

### Base Calculation

**Starting Point:** 16px (1rem) - standard browser base font size

**Formula:** `next_size = current_size × 1.618`

### Complete Scale

| Level | Calculation | Exact (px) | Rounded (px) | Rounded (rem) | Use Case |
|-------|-------------|------------|--------------|---------------|----------|
| **xs** | 16 ÷ 1.618² | 6.11px | 10px | 0.625rem | Captions, labels |
| **sm** | 16 ÷ 1.618 | 9.89px | 12px | 0.75rem | Small text |
| **base** | 16 × 1.618⁰ | 16px | 16px | 1rem | Body text |
| **md** | 16 × 1.618¹ | 25.89px | 26px | 1.625rem | Large body, h4 |
| **lg** | 16 × 1.618² | 41.89px | 42px | 2.625rem | h3 |
| **xl** | 16 × 1.618³ | 67.78px | 68px | 4.25rem | h2 |
| **2xl** | 16 × 1.618⁴ | 109.67px | 110px | 6.875rem | h1 |
| **3xl** | 16 × 1.618⁵ | 177.45px | 178px | 11.125rem | Display |

### Fluid Typography with Golden Ratio

Using `clamp()` for responsive scaling while maintaining golden ratio relationships:

```css
/* Small sizes - minimal scaling */
--font-size-xs: clamp(0.625rem, 0.5rem + 0.5vw, 0.75rem);   /* 10px → 12px */
--font-size-sm: clamp(0.75rem, 0.7rem + 0.3vw, 0.875rem);    /* 12px → 14px */

/* Base - standard scaling */
--font-size-base: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);  /* 16px → 18px */

/* Medium - moderate scaling */
--font-size-md: clamp(1.625rem, 1.4rem + 1.1vw, 2rem);      /* 26px → 32px */

/* Large - more dramatic scaling */
--font-size-lg: clamp(2.625rem, 2rem + 3.1vw, 3.5rem);      /* 42px → 56px */
--font-size-xl: clamp(4.25rem, 3rem + 6.25vw, 5.5rem);      /* 68px → 88px */
--font-size-2xl: clamp(6.875rem, 4.5rem + 12vw, 9rem);      /* 110px → 144px */
--font-size-3xl: clamp(11.125rem, 7rem + 20vw, 14rem);      /* 178px → 224px */
```

---

## Line Heights

### Golden Ratio Line Heights

**Base:** 1.618 (the golden ratio itself)

| Token | Calculation | Value | Use Case |
|-------|-------------|-------|----------|
| `--line-height-tight` | 1.618 × 0.75 | 1.214 | Headings, tight spacing |
| `--line-height-snug` | 1.618 × 0.85 | 1.375 | Subheadings |
| `--line-height-normal` | 1.618 × 1.0 | **1.618** | Body text (optimal reading) |
| `--line-height-relaxed` | 1.618 × 1.25 | 2.023 | Large body text |
| `--line-height-loose` | 1.618 × 1.5 | 2.427 | Poetry, display text |

### Why 1.618 for Body Text?

Research shows line-heights between 1.5-1.7 provide optimal readability. The golden ratio (1.618) sits perfectly in this range and creates harmonious vertical rhythm.

---

## Spacing Scale

### Base Unit

**Starting Point:** 8px (0.5rem) - standard spacing base

**Formula:** `next_space = current_space × 1.618`

### Spacing Scale

| Token | Calculation | Exact (px) | Rounded (px) | Rounded (rem) |
|-------|-------------|------------|--------------|---------------|
| `--space-0-5` | 8 ÷ 1.618 | 4.94px | 5px | 0.3125rem |
| `--space-1` | 8 × 1.618⁰ | 8px | 8px | 0.5rem |
| `--space-2` | 8 × 1.618¹ | 12.94px | 13px | 0.8125rem |
| `--space-3` | 8 × 1.618² | 20.94px | 21px | 1.3125rem |
| `--space-4` | 8 × 1.618³ | 33.94px | 34px | 2.125rem |
| `--space-5` | 8 × 1.618⁴ | 54.94px | 55px | 3.4375rem |
| `--space-6` | 8 × 1.618⁵ | 88.94px | 89px | 5.5625rem |
| `--space-8` | 8 × 1.618⁶ | 143.94px | 144px | 9rem |

### Practical Spacing Values

For easier use, we can round to nearest 4px or 8px:

| Token | Golden Ratio | Rounded (4px grid) | Rounded (8px grid) |
|-------|--------------|-------------------|-------------------|
| `--space-0-5` | 4.94px | 4px | 4px |
| `--space-1` | 8px | 8px | 8px |
| `--space-2` | 12.94px | 12px | 16px |
| `--space-3` | 20.94px | 20px | 24px |
| `--space-4` | 33.94px | 32px | 32px |
| `--space-5` | 54.94px | 52px | 56px |
| `--space-6` | 88.94px | 88px | 88px |
| `--space-8` | 143.94px | 144px | 144px |

---

## Layout Proportions

### Column Widths

Using golden ratio for layout proportions:

```css
/* Two-column layout */
--column-narrow: 38.2%;  /* 1 ÷ 1.618 = 0.618, 0.618 × 100 = 61.8% for wide */
--column-wide: 61.8%;    /* 100% - 38.2% = 61.8% */

/* Three-column layout */
--column-1: 23.6%;       /* 38.2% × 0.618 */
--column-2: 38.2%;       /* Golden ratio proportion */
--column-3: 38.2%;       /* Remaining space */
```

### Aspect Ratios

```css
/* Golden rectangle */
--aspect-ratio-golden: 1.618 / 1;  /* width:height */

/* Common golden ratio sizes */
--size-golden-sm: 100px × 161.8px;
--size-golden-md: 200px × 323.6px;
--size-golden-lg: 400px × 647.2px;
```

---

## Implementation Example

### CSS Variables

```css
:root {
  /* Golden ratio constant */
  --golden-ratio: 1.618033988749;
  
  /* Type scale */
  --font-size-base: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  --font-size-md: clamp(1.625rem, 1.4rem + 1.1vw, 2rem);
  --font-size-lg: clamp(2.625rem, 2rem + 3.1vw, 3.5rem);
  --font-size-xl: clamp(4.25rem, 3rem + 6.25vw, 5.5rem);
  --font-size-2xl: clamp(6.875rem, 4.5rem + 12vw, 9rem);
  
  /* Line heights */
  --line-height-normal: 1.618;
  --line-height-relaxed: 2.023;
  
  /* Spacing */
  --space-2: 1.3125rem;  /* 21px */
  --space-3: 2.125rem;   /* 34px */
  --space-4: 3.4375rem;  /* 55px */
}
```

### Usage

```css
/* Heading with golden ratio */
h1 {
  font-size: var(--font-size-2xl);
  line-height: var(--line-height-tight); /* 1.214 */
  margin-bottom: var(--space-4); /* 55px - golden ratio spacing */
}

/* Body text with golden ratio */
p {
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal); /* 1.618 - optimal reading */
  margin-bottom: var(--space-2); /* 21px */
}
```

---

## Benefits

1. **Natural Harmony** - Proportions feel balanced and pleasing
2. **Mathematical Precision** - Consistent, predictable relationships
3. **Timeless Design** - Used for thousands of years
4. **Optimal Readability** - 1.618 line-height is in the ideal range
5. **Visual Rhythm** - Creates consistent vertical and horizontal flow

---

## References

- **Golden Ratio:** φ = (1 + √5) / 2 ≈ 1.618
- **Inverse:** 1/φ = φ - 1 ≈ 0.618
- **Fibonacci Sequence:** Approximates golden ratio as it grows
- **Design Applications:** Architecture (Parthenon), art (Mona Lisa), nature (shells, flowers)

---

**Next Steps:** See `TYPOGRAPHY_PLAN.md` for implementation roadmap.

