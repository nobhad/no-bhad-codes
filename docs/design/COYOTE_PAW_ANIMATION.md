# Coyote Paw Intro Animation

## Overview

The intro animation features a stylized coyote paw that appears to be clutching/holding the business card, then releases and retracts diagonally off-screen, revealing the actual business card underneath.

## Animation Sequence

### Phase 1: CLUTCHING (0.6s hold)

The paw is shown gripping the business card with fingers in position 1 (closed/clutching).

### Phase 2: RELEASING (0.5s)

Fingers morph from position 1 to position 2, simulating the paw opening/releasing.

### Phase 3: FULLY OPEN (0.4s)

Fingers continue morphing from position 2 to position 3, showing the paw fully spread/released.

### Phase 4: RETRACTION (0.5s)

The entire paw (arm, fingers, thumb) slides diagonally up and to the left, exiting the screen in the direction it came from.

### Phase 5: REVEAL

The SVG overlay fades out, revealing the actual business card element underneath. Header content fades in.

## SVG Structure

**File**: `public/images/coyote_paw.svg`

**ViewBox**: `0 0 2316.99 1801.19`

### Element IDs

| ID | Description | Animation Role |
|----|-------------|----------------|
| `_1_Morph_Above_Card_-_Fingers_` | Fingers position 1 (clutching) | Morph start state |
| `_2_Morph_Above_Card_-_Fingers_` | Fingers position 2 (releasing) | Morph intermediate |
| `_3_Morph_Above_Card_-_Fingers_` | Fingers position 3 (fully open) | Morph end state |
| `_Arm_-_Align_Perfectly_with_Card_` | Arm connecting to hand | Retracts with paw |
| `_2_Morph_Behind_Card_-_Thumb_Filler_` | Thumb filler behind card | Retracts with paw |
| `_3_Morph_Behind_Card_-_Thumb_Palm_` | Thumb and palm behind card | Retracts with paw |
| `Business_Card` | Card outline and text | Static, fades out |

### CSS Classes in SVG

| Class | Usage |
|-------|-------|
| `.cls-1` | Card rectangle (white fill, stroke) |
| `.cls-2` | Card outline stroke |
| `.cls-3` | Text fill (#231f20) |

## Layer Order (Bottom to Top)

1. Thumb filler (behind card, in pawGroup)
2. Thumb/palm (behind card, in pawGroup)
3. Business card (static, stays in place)
4. Arm (above card, in fingersGroup - stays connected to fingers)
5. Fingers (above card, in fingersGroup - morphs between positions)

**Note**: The arm is grouped with the fingers (not with the thumb/palm) so it stays visually connected to the fingers during the retraction animation.

## Card Alignment

The SVG is scaled and positioned to align precisely with the actual business card element on the page.

**Card Position in SVG**:

```text
x: 1250.15
y: 1029.85
width: 1062.34
height: 591.3
```

**Alignment Formula**:

```javascript
const scale = actualCardRect.width / SVG_CARD_WIDTH;
const translateX = actualCardRect.left - (SVG_CARD_X * scale);
const translateY = actualCardRect.top - (SVG_CARD_Y * scale);
```

## GSAP Dependencies

- **GSAP Core**: Animation timeline and transforms
- **MorphSVGPlugin**: SVG path morphing (premium plugin)

## Implementation File

`src/modules/intro-animation.ts`

## Behavior by Device

| Device | Animation |
|--------|-----------|
| Desktop | Full paw morph + retraction |
| Mobile | Simple card flip (no paw overlay) |

## Skip Conditions

The animation is skipped when:

1. `sessionStorage.getItem('introShown') === 'true'` (already shown this session)
2. `prefers-reduced-motion: reduce` is set
3. Required SVG elements not found (falls back to card flip)

## Testing the Animation

To see the animation again after it has played:

1. Open browser DevTools
2. Go to Application > Session Storage
3. Delete the `introShown` key
4. Refresh the page

Or run in console:

```javascript
sessionStorage.removeItem('introShown');
location.reload();
```

## Timing Summary

| Phase | Duration |
|-------|----------|
| Clutch hold | 0.6s |
| Release (1→2) | 0.5s |
| Fully open (2→3) | 0.4s |
| Hold before retract | 0.2s |
| Retraction | 0.5s |
| Overlay fade | 0.4s |
| **Total** | ~2.6s |

## Modifying the SVG

When updating `coyote_paw.svg`:

1. Maintain the element IDs listed above
2. Keep the card rectangle at the same position/dimensions
3. Update constants in `intro-animation.ts` if card position changes:

```typescript
const SVG_CARD_X = 1250.15;
const SVG_CARD_Y = 1029.85;
const SVG_CARD_WIDTH = 1062.34;
```
