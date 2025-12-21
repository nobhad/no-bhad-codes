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
 * Calculate SVG alignment to match business card position
 */
export function calculateSvgAlignment(
  businessCard: HTMLElement
): SVGAlignment {
  const cardRect = businessCard.getBoundingClientRect();
  const cardFront = businessCard.querySelector('.business-card-front') as HTMLElement;
  const actualCardRect = cardFront ? cardFront.getBoundingClientRect() : cardRect;

  // Uniform scale based on card width (preserves aspect ratio)
  const scale = actualCardRect.width / SVG_CARD.width;

  // Viewport dimensions (still needed for return value)
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Calculate translation to align SVG card with screen position
  // This uses SVG coordinates scaled by the card scale factor
  const translateX = actualCardRect.left - (SVG_CARD.x * scale);
  const translateY = actualCardRect.top - (SVG_CARD.y * scale);

  console.log('[SVG Alignment] Business card position:', {
    cardWidth: actualCardRect.width,
    cardLeft: actualCardRect.left,
    cardTop: actualCardRect.top,
    svgCardX: SVG_CARD.x,
    svgCardY: SVG_CARD.y,
    svgCardWidth: SVG_CARD.width,
    scale,
    translateX,
    translateY
  });

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
