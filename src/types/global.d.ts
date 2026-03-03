/**
 * ===============================================
 * GLOBAL TYPE DEFINITIONS
 * ===============================================
 * @file src/types/global.d.ts
 *
 * Type definitions for browser APIs and global extensions
 * that are not included in standard lib.dom.d.ts.
 */

/* eslint-disable no-undef */

import type { Application } from '../core/app';
import type { StateManager } from '../core/state/state-manager';
import type { AppState } from '../core/state/types';

/**
 * Network Information API types
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API
 */
interface NetworkInformation {
  readonly effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
  readonly downlink: number;
  readonly rtt: number;
  readonly saveData: boolean;
  onchange: ((this: NetworkInformation, ev: Event) => void) | null;
}

/**
 * Chrome-specific memory API
 * @see https://developer.chrome.com/docs/devtools/memory/
 */
interface PerformanceMemory {
  readonly jsHeapSizeLimit: number;
  readonly totalJSHeapSize: number;
  readonly usedJSHeapSize: number;
}

/**
 * API Configuration type
 */
interface APIConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * Extended Navigator interface with Network Information API
 */
interface NavigatorWithConnection extends Navigator {
  readonly connection?: NetworkInformation;
  readonly mozConnection?: NetworkInformation;
  readonly webkitConnection?: NetworkInformation;
}

/**
 * Extended Performance interface with Chrome memory API
 */
interface PerformanceWithMemory extends Performance {
  readonly memory?: PerformanceMemory;
}

/**
 * EmailJS SDK types
 */
interface EmailJSResponseStatus {
  status: number;
  text: string;
}

interface EmailJS {
  send: (
    serviceId: string,
    templateId: string,
    templateParams: Record<string, string>,
    publicKey?: string
  ) => Promise<EmailJSResponseStatus>;
  init: (publicKey: string) => void;
}

/**
 * Window extensions for NBW application
 */
declare global {
  interface Window {
    /** Main application instance (for debugging) */
    NBW_APP?: Application;
    /** Global state manager (for debugging) */
    NBW_STATE?: StateManager<AppState>;
    /** API configuration */
    API_CONFIG?: APIConfig;
    /** EmailJS SDK */
    emailjs?: EmailJS;
  }

  /** Navigator with Network Information API support */
  interface Navigator {
    readonly connection?: NetworkInformation;
    readonly mozConnection?: NetworkInformation;
    readonly webkitConnection?: NetworkInformation;
  }

  /** Performance with Chrome memory API support */
  interface Performance {
    readonly memory?: PerformanceMemory;
  }
}

export type { NetworkInformation, PerformanceMemory, APIConfig, NavigatorWithConnection, PerformanceWithMemory };
