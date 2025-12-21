/**
 * ===============================================
 * INTRO ANIMATION TYPES
 * ===============================================
 * @file src/modules/animation/intro/intro-types.ts
 *
 * Type definitions for intro animation module
 */

/* global SVGGElement */

/**
 * SVG element references grouped by phase
 */
export interface FingerPathReferences {
  fingerA1: SVGPathElement | null;
  fingerB1: SVGPathElement | null;
  fingerC1: SVGPathElement | null;
  fingerA2: SVGPathElement | null;
  fingerB2: SVGPathElement | null;
  fingerC2: SVGPathElement | null;
  fingerA3: SVGPathElement | null;
  fingerB3: SVGPathElement | null;
  fingerC3: SVGPathElement | null;
}

/**
 * Path data for finger morphing
 */
export interface FingerPathData {
  a2: string | null;
  a3: string | null;
  b2: string | null;
  b3: string | null;
  c2: string | null;
  c3: string | null;
}

/**
 * Thumb path data for morphing
 */
export interface ThumbPathData {
  thumb2: string | null;
  thumb3: string | null;
}

/**
 * SVG layer group references
 */
export interface SVGLayers {
  behindCardGroup: SVGGElement;
  aboveCardGroup: SVGGElement;
  cardLayer: SVGGElement;
  transformWrapper: SVGGElement;
}

/**
 * Alignment calculation result
 */
export interface SVGAlignment {
  scale: number;
  translateX: number;
  translateY: number;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Extracted SVG elements from source document
 */
export interface SVGElements {
  armBase: Element | null;
  position1: Element | null;
  position2: Element | null;
  position3: Element | null;
  cardGroup: Element | null;
  svgCardX: number;
  svgCardY: number;
  svgCardWidth: number;
}

/**
 * Complete path data combining finger and thumb paths
 */
export interface CompleteMorphPathData extends FingerPathData, ThumbPathData {}
