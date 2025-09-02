/**
 * ===============================================
 * MODULE TYPE DEFINITIONS
 * ===============================================
 * @file scripts/types/modules.ts
 *
 * TypeScript definitions for module system.
 */

export interface ModuleOptions {
  debug?: boolean;
  dependencies?: string[];
  lazy?: boolean;
}

export interface ModuleStatus {
  name: string;
  initialized: boolean;
  destroyed: boolean;
  ready: boolean;
  reducedMotion: boolean;
  elementCount: number;
  listenerCount: number;
  timelineCount: number;
  hasError?: boolean;
  lastError?: string;
}

export interface EventHandler {
  element: Element;
  event: string;
  handler: EventListener;
}

// DOM Module - manages UI elements
export interface DOMModule {
  init(): Promise<void>;
  destroy(): Promise<void>;
  getStatus(): ModuleStatus;
  isReady(): boolean;
}

// Service - handles data/logic without DOM
export interface Service {
  init(): Promise<void>;
  getStatus(): { name: string; initialized: boolean; type: 'service' };
}

// Page-specific module loading
export interface PageConfig {
  modules: string[];
  services: string[];
  lazy?: string[];
}

export type ModuleType = 'dom' | 'service' | 'utility';

export interface ModuleDefinition {
  name: string;
  type: ModuleType;
  factory: () => Promise<any>;
  dependencies?: string[];
  pageSpecific?: boolean;
}