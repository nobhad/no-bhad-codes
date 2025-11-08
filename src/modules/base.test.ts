import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseModule } from './base';

// Create a concrete test class since BaseModule is meant to be extended
class TestModule extends BaseModule {
  constructor(name: string, options = {}) {
    super(name, options);
  }

  async onInit(): Promise<void> {
    // Simple test initialization
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

describe('BaseModule', () => {
  let module: TestModule;

  beforeEach(() => {
    if (document.body) {
      document.body.innerHTML = '<div id="test-element">Test</div>';
    }
    module = new TestModule('TestModule', { debug: true });
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(module['name']).toBe('TestModule');
      expect(module['debug']).toBe(true);
      expect(module['isInitialized']).toBe(false);
      expect(module['isDestroyed']).toBe(false);
      expect(module['eventListeners']).toBeInstanceOf(Map);
      expect(module['timelines']).toBeInstanceOf(Set);
      expect(module['elements']).toBeInstanceOf(Map);
    });

    it('should default debug to false when not specified', () => {
      const moduleWithoutDebug = new TestModule('TestModule2');
      expect(moduleWithoutDebug['debug']).toBe(false);
    });
  });

  describe('checkReducedMotion', () => {
    it('should return false when prefers-reduced-motion is not set', () => {
      expect(module['checkReducedMotion']()).toBe(false);
    });
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await module.init();
      expect(module['isInitialized']).toBe(true);
      expect(module['isDestroyed']).toBe(false);
    });

    it('should not initialize twice', async () => {
      const warnSpy = vi.spyOn(module as any, 'warn');
      await module.init();
      await module.init();
      expect(warnSpy).toHaveBeenCalledWith('Module already initialized.');
    });
  });

  describe('element management', () => {
    it('should find and cache elements', () => {
      const element = module['getElement']('test', '#test-element');
      expect(element).toBeDefined();
      expect(element?.id).toBe('test-element');
    });

    it('should return null for non-existent elements when not required', () => {
      const element = module['getElement']('missing', '#missing-element', false);
      expect(element).toBeNull();
    });

    it('should cache elements for repeated access', () => {
      const querySelectorSpy = vi.spyOn(document, 'querySelector');

      module['getElement']('test', '#test-element');
      module['getElement']('test', '#test-element');

      // Should only query once, second call uses cache
      expect(querySelectorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('status and lifecycle', () => {
    it('should return correct status', () => {
      const status = module.getStatus();
      expect(status.name).toBe('TestModule');
      expect(status.initialized).toBe(false);
      expect(status.destroyed).toBe(false);
    });

    it('should be ready after initialization', async () => {
      expect(module.isReady()).toBe(false);
      await module.init();
      expect(module.isReady()).toBe(true);
    });
  });

  describe('destruction', () => {
    it('should destroy properly', async () => {
      await module.init();
      await module.destroy();
      expect(module['isDestroyed']).toBe(true);
      expect(module['isInitialized']).toBe(false);
    });

    it('should not destroy twice', async () => {
      const warnSpy = vi.spyOn(module as any, 'warn');
      await module.init();
      await module.destroy();
      await module.destroy();
      expect(warnSpy).toHaveBeenCalledWith('Module already destroyed.');
    });
  });
});