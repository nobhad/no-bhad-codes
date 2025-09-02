/**
 * ===============================================
 * ERROR BOUNDARY TESTS
 * ===============================================
 * @file tests/unit/components/ErrorBoundary.test.ts
 * 
 * Unit tests for the error boundary component.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ErrorBoundary, createErrorBoundary, setupGlobalErrorBoundary } from '../../../src/components/ErrorBoundary.js';

// Mock logger service
vi.mock('../../../src/services/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock error tracking service
vi.mock('../../../src/services/error-tracking.js', () => ({
  ErrorTrackingService: vi.fn().mockImplementation(() => ({
    captureException: vi.fn(),
    init: vi.fn()
  }))
}));

// Setup DOM environment
Object.defineProperty(window, 'location', {
  value: { href: 'http://localhost:3000' },
  writable: true
});

describe('ErrorBoundary', () => {
  let container: HTMLElement;
  let errorBoundary: ErrorBoundary;

  beforeEach(() => {
    // Create a test container
    container = document.createElement('div');
    container.id = 'test-container';
    container.innerHTML = '<p>Original content</p>';
    document.body.appendChild(container);

    // Clear mocks
    vi.clearAllMocks();
    
    // Reset console methods
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up DOM
    document.body.innerHTML = '';
    
    // Restore mocks
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should create error boundary with default options', () => {
      errorBoundary = new ErrorBoundary(container);

      expect(errorBoundary.element).toBe(container);
      expect(errorBoundary.hasErrorState).toBe(false);
    });

    it('should create error boundary with custom options', () => {
      const customOptions = {
        retryable: false,
        logErrors: false,
        fallbackHTML: '<div>Custom fallback</div>',
        onError: vi.fn()
      };

      errorBoundary = new ErrorBoundary(container, customOptions);

      expect(errorBoundary.element).toBe(container);
    });

    it('should preserve original content', () => {
      const originalHTML = '<p>Original content</p>';
      container.innerHTML = originalHTML;

      errorBoundary = new ErrorBoundary(container);

      expect(container.innerHTML).toBe(originalHTML);
    });
  });

  describe('Function Wrapping', () => {
    beforeEach(() => {
      errorBoundary = new ErrorBoundary(container);
    });

    it('should wrap synchronous functions', () => {
      const testFunction = vi.fn(() => 'success');
      const wrappedFunction = errorBoundary.wrapFunction(testFunction);

      const result = wrappedFunction();

      expect(result).toBe('success');
      expect(testFunction).toHaveBeenCalled();
    });

    it('should catch synchronous function errors', () => {
      const error = new Error('Sync error');
      const testFunction = vi.fn(() => {
        throw error;
      });
      const wrappedFunction = errorBoundary.wrapFunction(testFunction);

      expect(() => wrappedFunction()).toThrow('Sync error');
      expect(errorBoundary.hasErrorState).toBe(true);
    });

    it('should wrap asynchronous functions', async () => {
      const testFunction = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async success';
      });
      const wrappedFunction = errorBoundary.wrapFunction(testFunction);

      const result = await wrappedFunction();

      expect(result).toBe('async success');
      expect(testFunction).toHaveBeenCalled();
    });

    it('should catch asynchronous function errors', async () => {
      const error = new Error('Async error');
      const testFunction = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw error;
      });
      const wrappedFunction = errorBoundary.wrapFunction(testFunction);

      await expect(wrappedFunction()).rejects.toThrow('Async error');
      expect(errorBoundary.hasErrorState).toBe(true);
    });
  });

  describe('Execute Method', () => {
    beforeEach(() => {
      errorBoundary = new ErrorBoundary(container);
    });

    it('should execute synchronous functions safely', async () => {
      const testFunction = () => 'executed successfully';

      const result = await errorBoundary.execute(testFunction);

      expect(result).toBe('executed successfully');
    });

    it('should execute asynchronous functions safely', async () => {
      const testFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async executed successfully';
      };

      const result = await errorBoundary.execute(testFunction);

      expect(result).toBe('async executed successfully');
    });

    it('should handle errors in executed functions', async () => {
      const error = new Error('Execution error');
      const testFunction = () => {
        throw error;
      };

      const result = await errorBoundary.execute(testFunction);

      expect(result).toBeNull();
      expect(errorBoundary.hasErrorState).toBe(true);
    });

    it('should handle errors in async executed functions', async () => {
      const error = new Error('Async execution error');
      const testFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw error;
      };

      const result = await errorBoundary.execute(testFunction);

      expect(result).toBeNull();
      expect(errorBoundary.hasErrorState).toBe(true);
    });
  });

  describe('Error Handling', () => {
    let onError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onError = vi.fn();
      errorBoundary = new ErrorBoundary(container, {
        onError,
        logErrors: true
      });
    });

    it('should render fallback UI on error', async () => {
      const error = new Error('Test error');
      const testFunction = () => {
        throw error;
      };

      await errorBoundary.execute(testFunction);

      expect(container.innerHTML).toContain('Something went wrong');
      expect(container.innerHTML).toContain('Try Again');
    });

    it('should call custom error handler', async () => {
      const error = new Error('Custom error test');
      const testFunction = () => {
        throw error;
      };

      await errorBoundary.execute(testFunction);

      expect(onError).toHaveBeenCalledWith(error, expect.any(Object));
    });

    it('should show error details when toggled', async () => {
      const error = new Error('Details test error');
      const testFunction = () => {
        throw error;
      };

      await errorBoundary.execute(testFunction);

      // Find details toggle button
      const detailsButton = container.querySelector('.error-boundary-details-toggle') as HTMLButtonElement;
      const detailsContent = container.querySelector('.error-boundary-details') as HTMLElement;

      expect(detailsButton).toBeTruthy();
      expect(detailsContent).toBeTruthy();
      expect(detailsContent.style.display).toBe('none');

      // Click to show details
      detailsButton.click();

      expect(detailsContent.style.display).toBe('block');
      expect(detailsButton.textContent).toBe('Hide Details');
    });
  });

  describe('Retry Functionality', () => {
    beforeEach(() => {
      errorBoundary = new ErrorBoundary(container, { retryable: true });
    });

    it('should show retry button when retryable', async () => {
      const error = new Error('Retryable error');
      const testFunction = () => {
        throw error;
      };

      await errorBoundary.execute(testFunction);

      const retryButton = container.querySelector('.error-boundary-retry');
      expect(retryButton).toBeTruthy();
    });

    it('should emit retry event when retry button is clicked', async () => {
      const error = new Error('Retry test error');
      const testFunction = () => {
        throw error;
      };

      // Set up event listener
      let retryEventFired = false;
      container.addEventListener('errorBoundaryRetry', () => {
        retryEventFired = true;
      });

      await errorBoundary.execute(testFunction);

      const retryButton = container.querySelector('.error-boundary-retry') as HTMLButtonElement;
      retryButton.click();

      expect(retryEventFired).toBe(true);
    });

    it('should reset content on retry', async () => {
      const originalContent = container.innerHTML;
      const error = new Error('Reset test error');
      const testFunction = () => {
        throw error;
      };

      await errorBoundary.execute(testFunction);
      expect(container.innerHTML).not.toBe(originalContent);

      errorBoundary.retry();

      expect(container.innerHTML).toBe(originalContent);
      expect(errorBoundary.hasErrorState).toBe(false);
    });
  });

  describe('Reset Functionality', () => {
    beforeEach(() => {
      errorBoundary = new ErrorBoundary(container);
    });

    it('should reset error boundary state', async () => {
      const originalContent = container.innerHTML;
      const error = new Error('Reset test');
      const testFunction = () => {
        throw error;
      };

      await errorBoundary.execute(testFunction);

      expect(errorBoundary.hasErrorState).toBe(true);
      expect(container.innerHTML).not.toBe(originalContent);

      errorBoundary.reset();

      expect(errorBoundary.hasErrorState).toBe(false);
      expect(container.innerHTML).toBe(originalContent);
    });
  });

  describe('Fallback HTML', () => {
    it('should use custom fallback HTML', async () => {
      const customFallback = '<div class="custom-error">Custom error message</div>';
      errorBoundary = new ErrorBoundary(container, {
        fallbackHTML: customFallback
      });

      const error = new Error('Custom fallback test');
      const testFunction = () => {
        throw error;
      };

      await errorBoundary.execute(testFunction);

      expect(container.innerHTML).toContain('Custom error message');
      expect(container.querySelector('.custom-error')).toBeTruthy();
    });

    it('should use default fallback HTML when none provided', async () => {
      errorBoundary = new ErrorBoundary(container);

      const error = new Error('Default fallback test');
      const testFunction = () => {
        throw error;
      };

      await errorBoundary.execute(testFunction);

      expect(container.innerHTML).toContain('Something went wrong');
      expect(container.querySelector('.error-boundary-fallback')).toBeTruthy();
    });
  });

  describe('Helper Functions', () => {
    it('should create error boundary with helper function', () => {
      const boundary = createErrorBoundary(container, { retryable: false });

      expect(boundary).toBeInstanceOf(ErrorBoundary);
      expect(boundary.element).toBe(container);
    });
  });

  describe('Global Error Boundary Setup', () => {
    it('should setup global error handlers', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      setupGlobalErrorBoundary();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Global error boundary setup completed')
      );
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      errorBoundary = new ErrorBoundary(container);
    });

    it('should destroy error boundary cleanly', () => {
      const originalContent = container.innerHTML;

      errorBoundary.destroy();

      // Should reset content
      expect(container.innerHTML).toBe(originalContent);
      expect(errorBoundary.hasErrorState).toBe(false);
    });
  });
});