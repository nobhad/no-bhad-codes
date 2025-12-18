# Coyote Paw Intro Animation

## Overview

The intro animation features a stylized coyote paw clutching the business card. The paw enters from the top-left, holds the card briefly, then releases it as the fingers morph open and the paw retracts diagonally off-screen, leaving the business card in place.

## Animation Sequence

```text
┌─────────────────────────────────────────────────────────────────┐
│ Phase 0: ENTRY (0.8s)                                           │
│   - Paw + card enter from top-left (-800, -600)                 │
│   - Animate to center position (0, 0)                           │
│   - All layers move together                                    │
├─────────────────────────────────────────────────────────────────┤
│ Phase 1: CLUTCH HOLD (0.8s)                                     │
│   - Paw grips the card motionless                               │
│   - Fingers visible in Position 1 (clutching)                   │
│   - Thumb is hidden (not visible until release)                 │
├─────────────────────────────────────────────────────────────────┤
│ Phase 2: FINGER RELEASE (0.5s)                                  │
│   - ALL fingers morph simultaneously: Position 1 → Position 2   │
│   - Thumb appears instantly (opacity 0 → 1) behind card         │
│   - Fingers are still over the card during this phase           │
├─────────────────────────────────────────────────────────────────┤
│ Phase 3: RETRACTION + FINAL MORPH (1.6s)                        │
│   - Starts 0.02s after Phase 2 completes                        │
│   - Paw retracts diagonally to top-left (-1500, -1200)          │
│   - All fingers morph: Position 2 → Position 3 (fully open)     │
│   - Finger A: 0.08s, Finger B: 0.08s, Finger C: 0.2s            │
│   - Morphs complete while fingers still visible over card       │
├─────────────────────────────────────────────────────────────────┤
│ Phase 4: COMPLETION                                             │
│   - Paw fully exits off-screen (no fade, just movement)         │
│   - Actual business card remains visible underneath             │
│   - Overlay becomes non-interactive (pointer-events: none)      │
│   - Header fades in                                             │
│   - intro-complete class added to document                      │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 0: ENTRY (0.8s)

The paw and card enter from the top-left corner of the screen, animating smoothly to the center position where the SVG card aligns with the actual business card element.

### Phase 1: CLUTCH HOLD (0.8s)

The paw grips the business card with fingers in Position 1 (closed/clutching). Only the arm and fingers are visible - no thumb yet.

### Phase 2: FINGER RELEASE (0.5s)

All fingers (A, B, C) morph simultaneously from Position 1 to Position 2. The thumb appears instantly (no fade) behind the card when this phase begins.

### Phase 3: RETRACTION + FINAL MORPH (1.6s)

After a brief 0.02s pause, the paw begins retracting diagonally to the top-left. During retraction, all fingers morph from Position 2 to Position 3 (fully open):

- Finger A: 0.08s (fastest)
- Finger B: 0.08s (fast)
- Finger C: 0.2s (slowest, trails behind)

### Phase 4: COMPLETION

The paw fully exits off-screen with no fade - just pure movement. The actual business card remains visible underneath the SVG overlay. The overlay becomes non-interactive and the header fades in.

## Timing Summary

| Phase | Duration | Description |
|-------|----------|-------------|
| Entry | 0.8s | Paw enters from top-left |
| Clutch hold | 0.8s | Paw holds card motionless |
| Finger release (1→2) | 0.5s | All fingers morph together |
| Pause before retract | 0.02s | Brief pause |
| Retraction | 1.6s | Paw exits diagonally |
| Finger A (2→3) | 0.08s | During retraction |
| Finger B (2→3) | 0.08s | During retraction |
| Finger C (2→3) | 0.2s | During retraction |
| **Total** | ~3.7s | Full animation |

## SVG Structure

**File**: `public/images/coyote_paw.svg`

### Element IDs

| ID | Description | Animation Role |
|----|-------------|----------------|
| `Arm_Base` | Arm path | Behind card, retracts |
| `Position_1` | Fingers A, B, C (clutching) | Morph source, above card |
| `Position_2` | Thumb + Fingers A, B, C (releasing) | Morph target |
| `Position_3` | Thumb + Fingers A, B, C (fully open) | Morph target |
| `Card` | Business card rect + text | Static, stays in place |

### Finger Path IDs

**Position 1** (morph source - paths inside groups):

- Finger A: `#_1_Morph_Above_Card_-_Fingers_`
- Finger B: `#_FInger_B_-_Above_Card_` (group) → path inside
- Finger C: `#_FInger_C-_Above_Card_` (group) → path inside

**Position 2** (morph target):

- Finger A: `#_FInger_A_-_Above_Card_-2`
- Finger B: `#_FInger_B-_Above_Card_`
- Finger C: `#_FInger_C_-_Above_Card_`
- Thumb: `#_Thumb_Behind_Card_`

**Position 3** (morph target):

- Finger A: `#_FInger_A_-_Above_Card_-3`
- Finger B: `#_FInger_B-_Above_Card_-2`
- Finger C: `#_FInger_C_-_Above_Card_-2`
- Thumb: `#_Thumb_Behind_Card_-2`

### CSS Classes in SVG

| Class | Usage |
|-------|-------|
| `.cls-1` | Card rectangle (white fill, dark stroke) |
| `.cls-2` | Paw elements (black stroke) |
| `.cls-3` | Text fill (#231f20) |

## Layer Order

The animation assembles layers in this order (bottom to top):

1. **Behind Card Group** (retracts)
   - Arm Base
   - Thumb (from Position 2, appears when releasing)

2. **SVG Card** (stays in place during animation)

3. **Above Card Group** (retracts)
   - Fingers from Position 1 (morph during animation)

**Note**: The actual business card element stays visible underneath the SVG overlay at all times. This prevents any flash when the animation completes.

## Card Alignment

The SVG is scaled and positioned to align with the actual business card element.

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

## Entry and Retraction Coordinates

| Position | X | Y | Description |
|----------|---|---|-------------|
| Start (off-screen) | -800 | -600 | Top-left, off viewport |
| Center (aligned) | 0 | 0 | Aligned with business card |
| Exit (off-screen) | -1500 | -1200 | Far top-left, fully off viewport |

## GSAP Dependencies

- **GSAP Core**: Animation timeline and transforms
- **MorphSVGPlugin**: SVG path morphing (premium plugin)

## Implementation File

`src/modules/intro-animation.ts`

The implementation file contains extensive documentation including:

- Animation sequence diagram
- SVG structure details
- Layer ordering
- Finger path IDs
- Alignment formulas
- Skip conditions

## Behavior by Device

| Device | Animation |
|--------|-----------|
| Desktop | Full paw morph + entry + retraction |
| Mobile | Simple card flip (no paw overlay) |

## Skip Conditions

The animation is skipped when:

1. `sessionStorage.getItem('introShown') === 'true'` (already shown this session)
2. `prefers-reduced-motion: reduce` is set
3. Required SVG elements not found (falls back to card flip)
4. User presses Enter key during animation

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

## Modifying the SVG

When updating `coyote_paw.svg`:

1. Maintain the element IDs listed above
2. Keep the card rectangle at the same position/dimensions
3. Position 1 should have NO thumb (only fingers)
4. Position 2 and 3 should have thumb behind card
5. Update constants in `intro-animation.ts` if card position changes:

```typescript
const SVG_CARD_X = 1256.15;
const SVG_CARD_Y = 1031.85;
const SVG_CARD_WIDTH = 1062.34;
```

## Important Implementation Notes

### No Flash at End

The animation was carefully designed to avoid any visual flash at the end:

1. The actual business card remains visible underneath the SVG overlay at all times
2. The paw retracts fully off-screen (no fade-out needed)
3. The overlay becomes non-interactive (`pointer-events: none`) rather than being hidden
4. No opacity changes to the SVG card or overlay that could cause a flash

### Simultaneous Finger Morphing

Unlike a cascading sequence, all fingers morph together:

- **Position 1 → 2**: All three fingers morph simultaneously (0.5s)
- **Position 2 → 3**: All three fingers morph during retraction with individual timings

### Thumb Appearance

The thumb appears instantly (no fade) at the start of the finger release phase. It's taken from Position 2 and placed in the behind-card layer.
