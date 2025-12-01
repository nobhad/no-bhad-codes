/**
 * ===============================================
 * CONTAINER TESTS
 * ===============================================
 * @file src/core/container.test.ts
 *
 * Unit tests for dependency injection container.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Container } from '@/core/container';

// Mock service classes
class MockService {
  constructor(public name: string = 'MockService') {}
  init() {
    return Promise.resolve();
  }
  getStatus() {
    return { initialized: true };
  }
}

class MockDependentService {
  constructor(public dependency: MockService) {}
  init() {
    return Promise.resolve();
  }
  getStatus() {
    return { initialized: true };
  }
}

describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('register and resolve', () => {
    it('should register and resolve a simple factory', async () => {
      const factory = vi.fn().mockResolvedValue(new MockService('TestService'));

      container.register('TestService', factory);
      const resolved = await container.resolve('TestService');

      expect(factory).toHaveBeenCalledOnce();
      expect(resolved).toBeInstanceOf(MockService);
      expect(resolved.name).toBe('TestService');
    });

    it('should return singleton instance on multiple resolves', async () => {
      const factory = vi.fn().mockResolvedValue(new MockService());

      container.register('SingletonService', factory, { singleton: true });

      const instance1 = await container.resolve('SingletonService');
      const instance2 = await container.resolve('SingletonService');

      expect(factory).toHaveBeenCalledOnce();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance for non-singleton services', async () => {
      let callCount = 0;
      const factory = vi.fn().mockImplementation(async () => {
        return new MockService(`Instance${++callCount}`);
      });

      container.register('TransientService', factory, { singleton: false });

      const instance1 = await container.resolve('TransientService');
      const instance2 = await container.resolve('TransientService');

      expect(factory).toHaveBeenCalledTimes(2);
      expect(instance1).not.toBe(instance2);
      expect(instance1.name).toBe('Instance1');
      expect(instance2.name).toBe('Instance2');
    });

    it('should throw error for unregistered service', async () => {
      await expect(container.resolve('UnregisteredService')).rejects.toThrow(
        'Service UnregisteredService not registered'
      );
    });
  });

  describe('dependency resolution', () => {
    it('should resolve dependencies in correct order', async () => {
      const mockService = new MockService('DependencyService');

      container.register('DependencyService', async () => mockService);
      container.register(
        'DependentService',
        async () => {
          const dependency = await container.resolve('DependencyService');
          return new MockDependentService(dependency);
        },
        {
          dependencies: ['DependencyService']
        }
      );

      const resolved = await container.resolve('DependentService');

      expect(resolved).toBeInstanceOf(MockDependentService);
      expect(resolved.dependency).toBe(mockService);
    });

    it('should detect circular dependencies', async () => {
      container.register('ServiceA', async () => {
        await container.resolve('ServiceB');
        return new MockService('ServiceA');
      });

      container.register('ServiceB', async () => {
        await container.resolve('ServiceA');
        return new MockService('ServiceB');
      });

      await expect(container.resolve('ServiceA')).rejects.toThrow('Circular dependency detected');
    });

    it('should handle complex dependency chains', async () => {
      const serviceC = new MockService('ServiceC');
      const serviceB = new MockService('ServiceB');

      container.register('ServiceC', async () => serviceC);
      container.register(
        'ServiceB',
        async () => {
          await container.resolve('ServiceC');
          return serviceB;
        },
        { dependencies: ['ServiceC'] }
      );

      container.register(
        'ServiceA',
        async () => {
          const depB = await container.resolve('ServiceB');
          const depC = await container.resolve('ServiceC');
          return new MockService('ServiceA');
        },
        { dependencies: ['ServiceB', 'ServiceC'] }
      );

      const resolved = await container.resolve('ServiceA');

      expect(resolved.name).toBe('ServiceA');
    });
  });

  describe('registration options', () => {
    it('should respect singleton option', async () => {
      const factory = vi.fn().mockResolvedValue(new MockService());

      container.register('TestService', factory, { singleton: true });

      await container.resolve('TestService');
      await container.resolve('TestService');

      expect(factory).toHaveBeenCalledOnce();
    });

    it('should handle dependencies option', async () => {
      const depFactory = vi.fn().mockResolvedValue(new MockService('Dependency'));
      const serviceFactory = vi.fn().mockImplementation(async () => {
        const dep = await container.resolve('Dependency');
        return new MockDependentService(dep);
      });

      container.register('Dependency', depFactory);
      container.register('Service', serviceFactory, {
        dependencies: ['Dependency']
      });

      await container.resolve('Service');

      expect(depFactory).toHaveBeenCalled();
      expect(serviceFactory).toHaveBeenCalled();
    });
  });

  describe('isRegistered', () => {
    it('should return true for registered service', () => {
      container.register('TestService', async () => new MockService());

      expect(container.isRegistered('TestService')).toBe(true);
    });

    it('should return false for unregistered service', () => {
      expect(container.isRegistered('UnregisteredService')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all registrations and instances', async () => {
      container.register('TestService', async () => new MockService());
      await container.resolve('TestService');

      expect(container.isRegistered('TestService')).toBe(true);

      container.clear();

      expect(container.isRegistered('TestService')).toBe(false);
      await expect(container.resolve('TestService')).rejects.toThrow(
        'Service TestService not registered'
      );
    });
  });

  describe('error handling', () => {
    it('should handle factory errors gracefully', async () => {
      const failingFactory = vi.fn().mockRejectedValue(new Error('Factory failed'));

      container.register('FailingService', failingFactory);

      await expect(container.resolve('FailingService')).rejects.toThrow('Factory failed');
    });

    it('should handle async factory errors', async () => {
      const asyncFailingFactory = vi.fn().mockImplementation(async () => {
        throw new Error('Async factory failed');
      });

      container.register('AsyncFailingService', asyncFailingFactory);

      await expect(container.resolve('AsyncFailingService')).rejects.toThrow(
        'Async factory failed'
      );
    });

    it('should not cache failed singleton instances', async () => {
      let shouldFail = true;
      const conditionalFactory = vi.fn().mockImplementation(async () => {
        if (shouldFail) {
          throw new Error('Initial failure');
        }
        return new MockService('SuccessService');
      });

      container.register('ConditionalService', conditionalFactory, { singleton: true });

      // First call should fail
      await expect(container.resolve('ConditionalService')).rejects.toThrow('Initial failure');

      // Second call should succeed after fixing the condition
      shouldFail = false;
      const resolved = await container.resolve('ConditionalService');

      expect(resolved.name).toBe('SuccessService');
      expect(conditionalFactory).toHaveBeenCalledTimes(2);
    });
  });

  describe('concurrent resolution', () => {
    it('should handle concurrent singleton resolution', async () => {
      let resolveCount = 0;
      const slowFactory = vi.fn().mockImplementation(async () => {
        resolveCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return new MockService(`Service${resolveCount}`);
      });

      container.register('SlowSingleton', slowFactory, { singleton: true });

      // Resolve concurrently
      const [instance1, instance2, instance3] = await Promise.all([
        container.resolve('SlowSingleton'),
        container.resolve('SlowSingleton'),
        container.resolve('SlowSingleton')
      ]);

      expect(slowFactory).toHaveBeenCalledOnce();
      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
    });
  });

  describe('getStatus', () => {
    it('should return container status', async () => {
      container.register('TestService', async () => new MockService());
      await container.resolve('TestService');

      const status = container.getStatus();

      expect(status.registeredServices).toContain('TestService');
      expect(status.instanceCount).toBe(1);
      expect(status.registrationCount).toBe(1);
    });

    it('should return empty status for empty container', () => {
      const status = container.getStatus();

      expect(status.registeredServices).toHaveLength(0);
      expect(status.instanceCount).toBe(0);
      expect(status.registrationCount).toBe(0);
    });
  });
});
