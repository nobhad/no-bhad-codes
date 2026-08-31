export interface ArrowCalloutOptions {
  /** Where to look for `[data-arrow-callout]` elements. Default: document. */
  root?: ParentNode;
  /** Fallback ancestor treated as the callout's section. Default: 'section'. */
  sectionSelector?: string;
  /**
   * How long `.is-leaving` stays on a manual callout before it is actually
   * hidden — the window a host has to animate the exit. Default 0 (no phase).
   */
  exitMs?: number;
  /** Fired after a blurb opens. Use to drive a custom entrance animation. */
  onOpen?(callout: HTMLElement): void;
  /** Fired after a blurb closes. */
  onClose?(callout: HTMLElement): void;
}

/** Element, `data-callout-id` value, or CSS selector. Omit when the page has
 *  exactly one callout. */
export type ArrowCalloutTarget = string | HTMLElement;

/**
 * Root data attributes (all optional):
 *   data-callout-open="auto" | "always" | "manual"
 *   data-callout-id="<name>"            address this callout in open()/close()
 *   data-callout-mascot-action="open"   mascot opens only (default: toggles)
 *   data-callout-portal="false"         don't move the callout to <body>
 *   data-callout-ready="<selector>"     hold closed until that element fades in
 */
export interface ArrowCalloutController {
  /** Re-evaluate which blurb should be open (after a layout change). */
  refresh(): void;
  /** Remove listeners and close every blurb. */
  destroy(): void;
  /**
   * Open a manual callout, optionally replacing its text for this appearance.
   * `autoCloseMs` dismisses it again after N ms (0 / omitted = stays put).
   */
  open(target?: ArrowCalloutTarget, text?: string, opts?: { autoCloseMs?: number }): void;
  /** Close a manual callout. `immediate` skips the `.is-leaving` exit phase. */
  close(target?: ArrowCalloutTarget, opts?: { immediate?: boolean }): void;
  /** Whether that callout's blurb is currently open. */
  isOpen(target?: ArrowCalloutTarget): boolean;
}

export function initArrowCallouts(options?: ArrowCalloutOptions): ArrowCalloutController;

export function anchorToFirstViewport(callout: HTMLElement, gapRatio?: number): () => void;

export default initArrowCallouts;
