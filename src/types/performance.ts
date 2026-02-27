/**
 * ===============================================
 * PERFORMANCE API TYPE DEFINITIONS
 * ===============================================
 * @file src/types/performance.ts
 *
 * Type definitions for browser Performance API entries
 * that are not included in standard lib.dom.d.ts.
 * These cover Core Web Vitals and related metrics.
 */

/* eslint-disable no-undef */
// Browser globals (PerformanceEntry, DOMRectReadOnly, etc.) are available in browser context

/**
 * Largest Contentful Paint (LCP) entry
 * @see https://web.dev/lcp/
 */
export interface PerformanceLCPEntry extends PerformanceEntry {
  readonly entryType: 'largest-contentful-paint';
  readonly renderTime: number;
  readonly loadTime: number;
  readonly size: number;
  readonly id: string;
  readonly url: string;
  readonly element?: Element;
}

/**
 * Layout Shift entry for Cumulative Layout Shift (CLS)
 * @see https://web.dev/cls/
 */
export interface PerformanceLayoutShiftEntry extends PerformanceEntry {
  readonly entryType: 'layout-shift';
  readonly value: number;
  readonly hadRecentInput: boolean;
  readonly lastInputTime: number;
  readonly sources?: LayoutShiftAttribution[];
}

/**
 * Layout shift attribution for identifying shifted elements
 */
export interface LayoutShiftAttribution {
  readonly node?: Node;
  readonly previousRect: DOMRectReadOnly;
  readonly currentRect: DOMRectReadOnly;
}

/**
 * First Input Delay (FID) entry
 * @see https://web.dev/fid/
 */
export interface PerformanceFIDEntry extends PerformanceEntry {
  readonly entryType: 'first-input';
  readonly processingStart: number;
  readonly processingEnd: number;
  readonly cancelable: boolean;
  readonly target?: EventTarget;
}

/**
 * Extended Navigation Timing entry with additional properties
 */
export interface PerformanceNavigationEntry extends PerformanceEntry {
  readonly entryType: 'navigation';
  readonly unloadEventStart: number;
  readonly unloadEventEnd: number;
  readonly domInteractive: number;
  readonly domContentLoadedEventStart: number;
  readonly domContentLoadedEventEnd: number;
  readonly domComplete: number;
  readonly loadEventStart: number;
  readonly loadEventEnd: number;
  readonly type: 'navigate' | 'reload' | 'back_forward' | 'prerender';
  readonly redirectCount: number;
  // Timing properties
  readonly redirectStart: number;
  readonly redirectEnd: number;
  readonly fetchStart: number;
  readonly domainLookupStart: number;
  readonly domainLookupEnd: number;
  readonly connectStart: number;
  readonly connectEnd: number;
  readonly secureConnectionStart: number;
  readonly requestStart: number;
  readonly responseStart: number;
  readonly responseEnd: number;
  readonly transferSize: number;
  readonly encodedBodySize: number;
  readonly decodedBodySize: number;
}

/**
 * Paint Timing entry (FP, FCP)
 */
export interface PerformancePaintEntry extends PerformanceEntry {
  readonly entryType: 'paint';
  readonly name: 'first-paint' | 'first-contentful-paint';
}

/**
 * Resource Timing entry with transfer size
 */
export interface PerformanceResourceEntry extends PerformanceResourceTiming {
  readonly transferSize: number;
  readonly encodedBodySize: number;
  readonly decodedBodySize: number;
}

/**
 * Type guard to check if entry is LCP
 */
export function isLCPEntry(entry: PerformanceEntry): entry is PerformanceLCPEntry {
  return entry.entryType === 'largest-contentful-paint';
}

/**
 * Type guard to check if entry is Layout Shift
 */
export function isLayoutShiftEntry(entry: PerformanceEntry): entry is PerformanceLayoutShiftEntry {
  return entry.entryType === 'layout-shift';
}

/**
 * Type guard to check if entry is Navigation
 */
export function isNavigationEntry(entry: PerformanceEntry): entry is PerformanceNavigationEntry {
  return entry.entryType === 'navigation';
}

/**
 * Type guard to check if entry is Paint
 */
export function isPaintEntry(entry: PerformanceEntry): entry is PerformancePaintEntry {
  return entry.entryType === 'paint';
}

/**
 * Type guard to check if entry is FID
 */
export function isFIDEntry(entry: PerformanceEntry): entry is PerformanceFIDEntry {
  return entry.entryType === 'first-input';
}
