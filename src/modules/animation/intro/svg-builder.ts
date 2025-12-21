/**
 * ===============================================
 * INTRO ANIMATION SVG BUILDER
 * ===============================================
 * @file src/modules/animation/intro/svg-builder.ts
 *
 * SVG construction and assembly utilities for intro animation
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Caches parsed SVG documents to avoid re-parsing
 * - Caches element references to avoid repeated DOM queries
 * - Caches path data to avoid repeated attribute reads
 */

/* global Document, SVGGElement */

import {
  SVG_CARD,
  SVG_ELEMENT_IDS,
  SVG_VIEWBOX
} from '../../../config/intro-animation-config';
import { ANIMATION_CONSTANTS, calculateShadowOffset } from '../../../config/animation-constants';
import type {
  SVGElements,
  SVGAlignment,
  SVGLayers,
  FingerPathReferences,
  FingerPathData,
  ThumbPathData,
  CompleteMorphPathData
} from './intro-types';

// ============================================================================
// CACHING
// ============================================================================

/** Cache for parsed SVG documents keyed by SVG path */
const svgDocumentCache = new Map<string, Document>();

/** Cache for extracted SVG elements keyed by SVG path */
const svgElementsCache = new Map<string, SVGElements>();

/** Cache for path data keyed by SVG path */
const pathDataCache = new Map<string, CompleteMorphPathData>();

/**
 * Fetch and parse SVG file (with caching)
 */
export async function fetchAndParseSvg(svgPath: string): Promise<Document> {
  // Check cache first
  if (svgDocumentCache.has(svgPath)) {
    return svgDocumentCache.get(svgPath)!;
  }

  const response = await fetch(svgPath);
  const svgText = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');

  // Cache the parsed document
  svgDocumentCache.set(svgPath, doc);

  return doc;
}

/**
 * Clear SVG caches (useful for testing or memory management)
 */
export function clearSvgCaches(): void {
  svgDocumentCache.clear();
  svgElementsCache.clear();
  pathDataCache.clear();
}

/**
 * Extract SVG elements from parsed document (with caching)
 */
export function extractSvgElements(svgDoc: Document, svgPath?: string): SVGElements {
  // Use cache if available and svgPath provided
  if (svgPath && svgElementsCache.has(svgPath)) {
    return svgElementsCache.get(svgPath)!;
  }

  const armBase = svgDoc.getElementById(SVG_ELEMENT_IDS.armBase);
  const position1 = svgDoc.getElementById(SVG_ELEMENT_IDS.position1);
  const position2 = svgDoc.getElementById(SVG_ELEMENT_IDS.position2);
  const position3 = svgDoc.getElementById(SVG_ELEMENT_IDS.position3);
  const cardGroup = svgDoc.getElementById(SVG_ELEMENT_IDS.cardGroup);

  const elements: SVGElements = {
    armBase,
    position1,
    position2,
    position3,
    cardGroup,
    svgCardX: SVG_CARD.x,
    svgCardY: SVG_CARD.y,
    svgCardWidth: SVG_CARD.width
  };

  // Cache if svgPath provided
  if (svgPath) {
    svgElementsCache.set(svgPath, elements);
  }

  return elements;
}

/**
 * Calculate SVG alignment to match business card position (pixel-perfect)
 *
 * @param businessCard - The business card element to align with
 * @param overlayElement - Optional overlay element (uses its bounds instead of window)
 *                         This is CRITICAL for exit animation where overlay has different size
 */
export function calculateSvgAlignment(
  businessCard: HTMLElement,
  overlayElement?: HTMLElement | null
): SVGAlignment {
  // Get the actual rendered SVG image element for pixel-perfect alignment
  const cardFront = businessCard.querySelector('.business-card-front') as HTMLElement;
  const svgImage = cardFront?.querySelector('img.card-svg') as HTMLElement;

  // Use SVG image bounds if available, otherwise fall back to container
  let elementRect: { width: number; height: number; left: number; top: number };
  if (svgImage) {
    elementRect = svgImage.getBoundingClientRect();
  } else if (cardFront) {
    elementRect = cardFront.getBoundingClientRect();
  } else {
    elementRect = businessCard.getBoundingClientRect();
  }

  // CRITICAL: Account for object-fit: contain behavior
  // The SVG content is scaled to fit within the element while maintaining aspect ratio
  // We need to calculate where the SVG content is actually rendered, not just the element box
  const svgContentAspect = SVG_CARD.width / SVG_CARD.height;
  const elementAspect = elementRect.width / elementRect.height;

  let actualCardRect: { width: number; height: number; left: number; top: number };

  if (svgContentAspect > elementAspect) {
    // SVG is wider than element - width-constrained, letterboxed top/bottom
    const contentWidth = elementRect.width;
    const contentHeight = elementRect.width / svgContentAspect;
    const paddingY = (elementRect.height - contentHeight) / 2;
    actualCardRect = {
      width: contentWidth,
      height: contentHeight,
      left: elementRect.left,
      top: elementRect.top + paddingY
    };
  } else {
    // SVG is taller than element - height-constrained, pillarboxed left/right
    const contentHeight = elementRect.height;
    const contentWidth = elementRect.height * svgContentAspect;
    const paddingX = (elementRect.width - contentWidth) / 2;
    actualCardRect = {
      width: contentWidth,
      height: contentHeight,
      left: elementRect.left + paddingX,
      top: elementRect.top
    };
  }

  // Get viewport/overlay dimensions
  // CRITICAL: During exit animation, overlay has different size (.paw-exit class)
  // Use overlay bounds if provided, otherwise fall back to window dimensions
  let viewportWidth: number;
  let viewportHeight: number;
  let overlayTop = 0;
  let overlayLeft = 0;

  if (overlayElement) {
    const overlayRect = overlayElement.getBoundingClientRect();
    viewportWidth = overlayRect.width;
    viewportHeight = overlayRect.height;
    overlayTop = overlayRect.top;
    overlayLeft = overlayRect.left;
  } else {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
  }

  // Calculate how the SVG viewBox (with preserveAspectRatio) maps to viewport
  // SVG viewBox: 2331.1 x 1798.6 (aspect ratio ≈ 1.296)
  // Viewport: viewportWidth x viewportHeight (aspect ratio varies)
  const svgAspectRatio = SVG_VIEWBOX.width / SVG_VIEWBOX.height;
  const viewportAspectRatio = viewportWidth / viewportHeight;

  // Calculate the actual display size of the SVG (after preserveAspectRatio scaling)
  let svgDisplayWidth: number;
  let svgDisplayHeight: number;
  let svgDisplayX: number;
  let svgDisplayY: number;

  if (svgAspectRatio > viewportAspectRatio) {
    // SVG is wider - fit to viewport width, letterbox top/bottom
    svgDisplayWidth = viewportWidth;
    svgDisplayHeight = viewportWidth / svgAspectRatio;
    svgDisplayX = 0;
    svgDisplayY = (viewportHeight - svgDisplayHeight) / 2;
  } else {
    // SVG is taller - fit to viewport height, pillarbox left/right
    svgDisplayHeight = viewportHeight;
    svgDisplayWidth = viewportHeight * svgAspectRatio;
    svgDisplayX = (viewportWidth - svgDisplayWidth) / 2;
    svgDisplayY = 0;
  }

  // Calculate scale: SVG viewBox units to viewport pixels (after preserveAspectRatio 'meet')
  const viewBoxToPixelScale = svgDisplayWidth / SVG_VIEWBOX.width;

  // Calculate scale factor: card width in SVG should match actual card width on screen
  // After transform scale(s), SVG card width becomes SVG_CARD.width * s (in SVG coords)
  // On screen: (SVG_CARD.width * s) * viewBoxToPixelScale should equal actualCardRect.width
  // So: s = actualCardRect.width / (SVG_CARD.width * viewBoxToPixelScale)
  const scale = actualCardRect.width / (SVG_CARD.width * viewBoxToPixelScale);

  // Calculate translation for pixel-perfect alignment
  // Transform order: translate(tx, ty) scale(s) applies: scale first, then translate
  // After transform, SVG card at (SVG_CARD.x, SVG_CARD.y) becomes:
  //   (SVG_CARD.x * s + tx, SVG_CARD.y * s + ty) in SVG coords
  // On screen: (overlayLeft + svgDisplayX + (SVG_CARD.x * s + tx) * viewBoxToPixelScale, ...)
  // We want this to equal (actualCardRect.left, actualCardRect.top)
  //
  // CRITICAL: Adjust for overlay offset when overlay is not at viewport origin (exit animation)
  // actualCardRect is relative to viewport, but SVG is inside overlay which may be offset
  const cardLeftRelativeToOverlay = actualCardRect.left - overlayLeft;
  const cardTopRelativeToOverlay = actualCardRect.top - overlayTop;

  // Solving: cardLeftRelativeToOverlay = svgDisplayX + (SVG_CARD.x * s + tx) * viewBoxToPixelScale
  //          tx = (cardLeftRelativeToOverlay - svgDisplayX) / viewBoxToPixelScale - SVG_CARD.x * s
  const translateX = (cardLeftRelativeToOverlay - svgDisplayX) / viewBoxToPixelScale - SVG_CARD.x * scale;
  const translateY = (cardTopRelativeToOverlay - svgDisplayY) / viewBoxToPixelScale - SVG_CARD.y * scale;

  console.log('[SVG Alignment] Pixel-perfect alignment:');
  console.log('  elementUsed:', svgImage ? 'svg-image' : cardFront ? 'card-front' : 'business-card');
  console.log('  overlayOffset:', overlayLeft.toFixed(2), ',', overlayTop.toFixed(2), overlayElement ? '(from overlay)' : '(none)');
  console.log('  elementRect:', elementRect.width.toFixed(2), 'x', elementRect.height.toFixed(2), 'at', elementRect.left.toFixed(2), ',', elementRect.top.toFixed(2));
  console.log('  contentRect:', actualCardRect.width.toFixed(2), 'x', actualCardRect.height.toFixed(2), 'at', actualCardRect.left.toFixed(2), ',', actualCardRect.top.toFixed(2));
  console.log('  cardRelOverlay:', cardLeftRelativeToOverlay.toFixed(2), ',', cardTopRelativeToOverlay.toFixed(2));
  console.log('  svgViewBox:', SVG_VIEWBOX.width, 'x', SVG_VIEWBOX.height, '(aspect:', svgAspectRatio.toFixed(4), ')');
  console.log('  viewport/overlay:', viewportWidth, 'x', viewportHeight, '(aspect:', viewportAspectRatio.toFixed(4), ')');
  console.log('  svgDisplay:', svgDisplayWidth.toFixed(2), 'x', svgDisplayHeight.toFixed(2), 'at', svgDisplayX.toFixed(2), ',', svgDisplayY.toFixed(2));
  console.log('  transforms: scale=', scale.toFixed(6), 'translate=', translateX.toFixed(2), ',', translateY.toFixed(2));
  console.log('  SVG_CARD:', SVG_CARD.x, ',', SVG_CARD.y, 'size:', SVG_CARD.width, 'x', SVG_CARD.height);

  return {
    scale,
    translateX,
    translateY,
    viewportWidth,
    viewportHeight
  };
}

/**
 * Create shadow filter for SVG
 */
export function createShadowFilter(
  morphSvg: SVGSVGElement,
  scale: number
): void {
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  filter.setAttribute('id', 'card-shadow');
  filter.setAttribute('x', '-50%');
  filter.setAttribute('y', '-50%');
  filter.setAttribute('width', '200%');
  filter.setAttribute('height', '200%');

  const shadow = calculateShadowOffset(1 / scale);
  const dropShadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
  dropShadow.setAttribute('dx', '0');
  dropShadow.setAttribute('dy', String(shadow.base));
  dropShadow.setAttribute('stdDeviation', String(shadow.blur));
  dropShadow.setAttribute('flood-color', ANIMATION_CONSTANTS.COLORS.SHADOW_DEFAULT);

  filter.appendChild(dropShadow);
  defs.appendChild(filter);
  morphSvg.appendChild(defs);
}

/**
 * Create layer group structure
 */
export function createLayerGroups(
  alignment: SVGAlignment
): SVGLayers {
  // Main wrapper with transform for scaling and positioning
  const transformWrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  transformWrapper.setAttribute('id', 'intro-layers-wrapper');
  transformWrapper.setAttribute(
    'transform',
    `translate(${alignment.translateX}, ${alignment.translateY}) scale(${alignment.scale})`
  );

  // Group for elements BEHIND the card (arm + thumb)
  const behindCardGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  behindCardGroup.setAttribute('id', 'behind-card-group');
  behindCardGroup.setAttribute('filter', 'url(#card-shadow)');

  // Group for elements ABOVE the card (fingers)
  const aboveCardGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  aboveCardGroup.setAttribute('id', 'above-card-group');
  aboveCardGroup.setAttribute('filter', 'url(#card-shadow)');

  // Card layer group
  const cardLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  cardLayer.setAttribute('id', 'svg-business-card');
  cardLayer.setAttribute('filter', 'url(#card-shadow)');

  return {
    transformWrapper,
    behindCardGroup,
    aboveCardGroup,
    cardLayer
  };
}

/**
 * Assemble behind-card layer (arm + thumb)
 */
export function assembleBehindCardLayer(
  behindCardGroup: SVGGElement,
  elements: SVGElements
): Element | null {
  // Add arm base (behind card, retracts with paw)
  if (elements.armBase) {
    const clonedArm = elements.armBase.cloneNode(true) as Element;
    clonedArm.setAttribute('id', 'arm-group');
    behindCardGroup.appendChild(clonedArm);
  }

  // Add thumb from Position 1 (behind card, always visible)
  const thumbElement = elements.position1?.querySelector(`#${SVG_ELEMENT_IDS.thumb1}`);
  let clonedThumb: Element | null = null;
  if (thumbElement) {
    clonedThumb = thumbElement.cloneNode(true) as Element;
    clonedThumb.setAttribute('id', 'thumb-behind-card');
    behindCardGroup.appendChild(clonedThumb);
  }

  return clonedThumb;
}

/**
 * Assemble card layer
 */
export function assembleCardLayer(
  cardLayer: SVGGElement,
  elements: SVGElements
): void {
  if (elements.cardGroup) {
    const clonedCard = elements.cardGroup.cloneNode(true) as Element;
    clonedCard.setAttribute('id', 'card-group-clone');
    cardLayer.appendChild(clonedCard);
  }
}

/**
 * Assemble above-card layer (fingers from Position 1)
 */
export function assembleAboveCardLayer(
  aboveCardGroup: SVGGElement,
  elements: SVGElements
): Element | null {
  if (!elements.position1) return null;

  const clonedPos1 = elements.position1.cloneNode(true) as Element;
  clonedPos1.setAttribute('id', 'position-1');

  // Remove thumb from this clone - it should only be in behindCardGroup
  const thumbInPos1 = clonedPos1.querySelector(`#${SVG_ELEMENT_IDS.thumb1}`);
  if (thumbInPos1) {
    thumbInPos1.remove();
  }

  aboveCardGroup.appendChild(clonedPos1);
  return clonedPos1;
}

/**
 * Copy SVG styles from source document
 */
export function copySvgStyles(
  morphSvg: SVGSVGElement,
  svgDoc: Document
): void {
  const sourceStyles = svgDoc.querySelector('style');
  if (sourceStyles) {
    const clonedStyles = sourceStyles.cloneNode(true) as Element;
    morphSvg.insertBefore(clonedStyles, morphSvg.firstChild);
  }
}

/**
 * Get finger path references for morphing
 */
export function getFingerPathReferences(
  clonedPos1: Element,
  position2: Element,
  position3: Element | null
): FingerPathReferences {
  return {
    fingerA1: clonedPos1.querySelector(`#${SVG_ELEMENT_IDS.fingerA1}`) as SVGPathElement,
    fingerB1: clonedPos1.querySelector(`[id="${SVG_ELEMENT_IDS.fingerB1Container}"] path`) as SVGPathElement,
    fingerC1: clonedPos1.querySelector(`[id="${SVG_ELEMENT_IDS.fingerC1Container}"] path`) as SVGPathElement,
    fingerA2: position2.querySelector(`#${SVG_ELEMENT_IDS.fingerA2}`) as SVGPathElement,
    fingerB2: position2.querySelector(`#${SVG_ELEMENT_IDS.fingerB2}`) as SVGPathElement,
    fingerC2: position2.querySelector(`#${SVG_ELEMENT_IDS.fingerC2}`) as SVGPathElement,
    fingerA3: position3?.querySelector(`#${SVG_ELEMENT_IDS.fingerA3}`) as SVGPathElement,
    fingerB3: position3?.querySelector(`#${SVG_ELEMENT_IDS.fingerB3}`) as SVGPathElement,
    fingerC3: position3?.querySelector(`#${SVG_ELEMENT_IDS.fingerC3}`) as SVGPathElement
  };
}

/**
 * Extract path data from finger references (with caching)
 * Path data is cached to avoid repeated attribute reads
 */
export function getFingerPathData(
  fingerRefs: FingerPathReferences,
  cacheKey?: string
): FingerPathData {
  // Check cache if cacheKey provided
  if (cacheKey) {
    const cached = pathDataCache.get(cacheKey);
    if (cached) {
      return {
        a2: cached.a2,
        a3: cached.a3,
        b2: cached.b2,
        b3: cached.b3,
        c2: cached.c2,
        c3: cached.c3
      };
    }
  }

  const pathData: FingerPathData = {
    a2: fingerRefs.fingerA2?.getAttribute('d') || null,
    a3: fingerRefs.fingerA3?.getAttribute('d') || null,
    b2: fingerRefs.fingerB2?.getAttribute('d') || null,
    b3: fingerRefs.fingerB3?.getAttribute('d') || null,
    c2: fingerRefs.fingerC2?.getAttribute('d') || null,
    c3: fingerRefs.fingerC3?.getAttribute('d') || null
  };

  return pathData;
}

/**
 * Extract thumb path data (with caching)
 */
export function getThumbPathData(
  position2: Element,
  position3: Element | null,
  cacheKey?: string
): ThumbPathData {
  // Check cache if cacheKey provided
  if (cacheKey) {
    const cached = pathDataCache.get(cacheKey);
    if (cached) {
      return {
        thumb2: cached.thumb2,
        thumb3: cached.thumb3
      };
    }
  }

  const thumb2 = position2.querySelector(`#${SVG_ELEMENT_IDS.thumb2}`) as SVGPathElement;
  const thumb3 = position3?.querySelector(`#${SVG_ELEMENT_IDS.thumb3}`) as SVGPathElement;

  const thumbData: ThumbPathData = {
    thumb2: thumb2?.getAttribute('d') || null,
    thumb3: thumb3?.getAttribute('d') || null
  };

  return thumbData;
}

/**
 * Assemble all SVG layers and return references
 */
export function assembleAllLayers(
  morphSvg: SVGSVGElement,
  elements: SVGElements,
  alignment: SVGAlignment
): {
  layers: SVGLayers;
  clonedPos1: Element | null;
  clonedThumb: Element | null;
} {
  // Use original SVG viewBox to maintain correct proportions
  morphSvg.setAttribute('viewBox', `0 0 ${SVG_VIEWBOX.width} ${SVG_VIEWBOX.height}`);
  morphSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  // Create shadow filter
  createShadowFilter(morphSvg, alignment.scale);

  // Create layer groups
  const layers = createLayerGroups(alignment);

  // Assemble behind-card layer (arm + thumb)
  const clonedThumb = assembleBehindCardLayer(layers.behindCardGroup, elements);
  layers.transformWrapper.appendChild(layers.behindCardGroup);

  // Assemble card layer
  assembleCardLayer(layers.cardLayer, elements);
  layers.transformWrapper.appendChild(layers.cardLayer);

  // Assemble above-card layer (fingers)
  const clonedPos1 = assembleAboveCardLayer(layers.aboveCardGroup, elements);
  layers.transformWrapper.appendChild(layers.aboveCardGroup);

  // Add wrapper to SVG
  morphSvg.appendChild(layers.transformWrapper);

  return {
    layers,
    clonedPos1,
    clonedThumb
  };
}

/**
 * Get complete morph path data (fingers + thumb) with caching
 */
export function getCompleteMorphPathData(
  fingerRefs: FingerPathReferences,
  position2: Element,
  position3: Element | null,
  cacheKey?: string
): CompleteMorphPathData {
  // Check cache if cacheKey provided
  if (cacheKey && pathDataCache.has(cacheKey)) {
    return pathDataCache.get(cacheKey)!;
  }

  const fingerData = getFingerPathData(fingerRefs, cacheKey);
  const thumbData = getThumbPathData(position2, position3, cacheKey);

  const completeData: CompleteMorphPathData = {
    ...fingerData,
    ...thumbData
  };

  // Cache if cacheKey provided
  if (cacheKey) {
    pathDataCache.set(cacheKey, completeData);
  }

  return completeData;
}
