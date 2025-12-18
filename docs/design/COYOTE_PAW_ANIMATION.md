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

**ViewBox**: `0 0 2331.11 1798.56`

### Element IDs (Group Structure)

| ID | Description | Animation Role |
|----|-------------|----------------|
| `Arm_Base` | Group containing arm path | Retracts with paw |
| `Position_1` | Fingers in clutching position | Initial state, contains morph source |
| `Position_2` | Fingers releasing + thumb | Morph target (releasing) |
| `Position_3` | Fingers fully open + thumb | Morph target (fully open) |
| `Card` | Business card group | Static, fades out |
| `_1_Morph_Above_Card_-_Fingers_` | Finger A path (inside Position_1) | Morphs to positions 2 → 3 |
| `_FInger_A_-_Above_Card_-2` | Finger A path (inside Position_2) | Morph target |
| `_FInger_A_-_Above_Card_-3` | Finger A path (inside Position_3) | Morph target |

### CSS Classes in SVG

| Class | Usage |
|-------|-------|
| `.cls-1` | Text fill (#231f20) |
| `.cls-2` | Card rectangle (stroke) |
| `.cls-3` | Paw outline stroke |

## Layer Order (Bottom to Top)

1. Arm base (behind everything)
2. Position groups (contain fingers + thumb)
3. Business card (static, stays in place on top)

**Note**: The position groups are crossfaded during animation while Finger A morphs between shapes using GSAP MorphSVGPlugin.

## Card Alignment

The SVG is scaled and positioned to align precisely with the actual business card element on the page.

**Card Position in SVG**:

```text
x: 1256.15
y: 1031.85
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
const SVG_CARD_X = 1256.15;
const SVG_CARD_Y = 1031.85;
const SVG_CARD_WIDTH = 1062.34;
```
