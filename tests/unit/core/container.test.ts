/**
 * ===============================================
 * DEPENDENCY INJECTION CONTAINER TESTS
 * ===============================================
 * @file tests/unit/core/container.test.ts
 * 
 * Unit tests for the dependency injection container.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Container } from '../../../src/core/container.js';

describe('Container (Dependency Injection)', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('Service Registration', () => {
    it('should register a service', () => {
      const factory = () => ({ name: 'test-service' });
      container.register('testService', factory);

      expect(container.isRegistered('testService')).toBe(true);
    });

    it('should register singleton service by default', () => {
      const factory = () => ({ name: 'singleton-service', id: Math.random() });
      container.register('singletonService', factory);

      const status = container.getStatus();
      expect(status.registeredServices).toContain('singletonService');
    });

    it('should register transient service', () => {
      const factory = () => ({ name: 'transient-service', id: Math.random() });
      container.transient('transientService', factory);

      expect(container.isRegistered('transientService')).toBe(true);
    });

    it('should register service with dependencies', () => {
      // Register dependencies first
      container.register('dependency1', () => ({ value: 'dep1' }));
      container.register('dependency2', () => ({ value: 'dep2' }));

      // Register service with dependencies
      container.register('serviceWithDeps', (dep1, dep2) => ({
        name: 'service-with-deps',
        dep1,
        dep2
      }), { dependencies: ['dependency1', 'dependency2'] });

      expect(container.isRegistered('serviceWithDeps')).toBe(true);
    });
  });

  describe('Service Resolution', () => {
    it('should resolve simple service', async () => {
      const expectedService = { name: 'simple-service' };
      container.register('simpleService', () => expectedService);

      const service = await container.resolve('simpleService');
      expect(service).toEqual(expectedService);
    });

    it('should resolve service with dependencies', async () => {
      // Register dependencies
      const dep1 = { value: 'dependency-1' };
      const dep2 = { value: 'dependency-2' };
      
      container.register('dep1', () => dep1);
      container.register('dep2', () => dep2);

      // Register service with dependencies
      container.register('mainService', (d1, d2) => ({
        name: 'main-service',
        dependencies: [d1, d2]
      }), { dependencies: ['dep1', 'dep2'] });

      const service = await container.resolve('mainService') as { name: string; dependencies: any[] };
      expect(service.name).toBe('main-service');
      expect(service.dependencies).toEqual([dep1, dep2]);
    });

    it('should resolve async factory functions', async () => {
      const asyncFactory = async () => {
        // Simulate async initialization
        await new Promise(resolve => setTimeout(resolve, 10));
        return { name: 'async-service', initialized: true };
      };

      container.register('asyncService', asyncFactory);
      const service = await container.resolve('asyncService') as { name: string; initialized: boolean };

      expect(service.name).toBe('async-service');
      expect(service.initialized).toBe(true);
    });

    it('should return same instance for singleton services', async () => {
      let instanceCount = 0;
      const factory = () => ({ id: ++instanceCount });
      
      container.register('singletonService', factory, { singleton: true });

      const instance1 = await container.resolve('singletonService');
      const instance2 = await container.resolve('singletonService');

      expect(instance1).toBe(instance2); // Same reference
      expect(instanceCount).toBe(1); // Factory called only once
    });

    it('should return different instances for transient services', async () => {
      let instanceCount = 0;
      const factory = () => ({ id: ++instanceCount });
      
      container.transient('transientService', factory);

      const instance1 = await container.resolve('transientService') as { id: number };
      const instance2 = await container.resolve('transientService') as { id: number };

      expect(instance1).not.toBe(instance2); // Different references
      expect(instance1.id).toBe(1);
      expect(instance2.id).toBe(2);
    });

    it('should throw error for unregistered service', async () => {
      await expect(container.resolve('nonExistentService'))
        .rejects.toThrow("Service 'nonExistentService' not registered");
    });
  });

  describe('Circular Dependencies', () => {
    it('should detect circular dependencies', async () => {
      // Create circular dependency: A depends on B, B depends on A
      container.register('serviceA', (serviceB) => ({
        name: 'A',
        dependency: serviceB
      }), { dependencies: ['serviceB'] });

      container.register('serviceB', (serviceA) => ({
        name: 'B',
        dependency: serviceA
      }), { dependencies: ['serviceA'] });

      await expect(container.resolve('serviceA'))
        .rejects.toThrow("Circular dependency detected for service 'serviceA'");
    });

    it('should handle complex circular dependencies', async () => {
      // Create circular dependency chain: A -> B -> C -> A
      container.register('serviceA', (serviceB) => ({ name: 'A', dep: serviceB }), 
        { dependencies: ['serviceB'] });
      container.register('serviceB', (serviceC) => ({ name: 'B', dep: serviceC }), 
        { dependencies: ['serviceC'] });
      container.register('serviceC', (serviceA) => ({ name: 'C', dep: serviceA }), 
        { dependencies: ['serviceA'] });

      await expect(container.resolve('serviceA'))
        .rejects.toThrow(/Circular dependency detected/);
    });
  });

  describe('Error Handling', () => {
    it('should handle factory function errors', async () => {
      const errorMessage = 'Factory initialization failed';
      const faultyFactory = () => {
        throw new Error(errorMessage);
      };

      container.register('faultyService', faultyFactory);

      await expect(container.resolve('faultyService'))
        .rejects.toThrow(errorMessage);
    });

    it('should handle async factory function errors', async () => {
      const errorMessage = 'Async factory failed';
      const faultyAsyncFactory = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error(errorMessage);
      };

      container.register('faultyAsyncService', faultyAsyncFactory);

      await expect(container.resolve('faultyAsyncService'))
        .rejects.toThrow(errorMessage);
    });

    it('should clean up resolving state on error', async () => {
      const faultyFactory = () => {
        throw new Error('Factory failed');
      };

      container.register('faultyService', faultyFactory);

      // First attempt should fail
      await expect(container.resolve('faultyService')).rejects.toThrow();

      // Container should be in clean state for retry
      const status = container.getStatus();
      expect(status.resolving).toEqual([]);
    });
  });

  describe('Container Status', () => {
    it('should report container status', () => {
      container.register('service1', () => ({}));
      container.register('service2', () => ({}));
      container.transient('service3', () => ({}));

      const status = container.getStatus();

      expect(status.registeredServices).toHaveLength(3);
      expect(status.registeredServices).toContain('service1');
      expect(status.registeredServices).toContain('service2');
      expect(status.registeredServices).toContain('service3');
      expect(status.totalServices).toBe(3);
      expect(status.resolving).toEqual([]);
    });

    it('should report singleton instances after resolution', async () => {
      container.register('singletonService', () => ({ name: 'singleton' }));
      
      let status = container.getStatus();
      expect(status.singletonCount).toBe(0);

      await container.resolve('singletonService');
      
      status = container.getStatus();
      expect(status.singletonCount).toBe(1);
    });
  });

  describe('Service Listing', () => {
    it('should list registered services', () => {
      container.register('service1', () => ({}));
      container.register('service2', () => ({}));
      container.register('service3', () => ({}));

      const services = container.getRegisteredServices();

      expect(services).toHaveLength(3);
      expect(services).toContain('service1');
      expect(services).toContain('service2');
      expect(services).toContain('service3');
    });

    it('should check if service exists', () => {
      container.register('existingService', () => ({}));

      expect(container.has('existingService')).toBe(true);
      expect(container.has('nonExistentService')).toBe(false);
    });
  });

  describe('Container Cleanup', () => {
    it('should clear all services', () => {
      container.register('service1', () => ({}));
      container.register('service2', () => ({}));
      container.register('service3', () => ({}));

      expect(container.getRegisteredServices()).toHaveLength(3);

      container.clear();

      expect(container.getRegisteredServices()).toHaveLength(0);
      const status = container.getStatus();
      expect(status.totalServices).toBe(0);
      expect(status.singletonCount).toBe(0);
    });

    it('should clear resolving state', async () => {
      // Create a service that will be in resolving state when we clear
      container.register('slowService', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { name: 'slow' };
      });

      // Start resolution but don't wait
      const resolutionPromise = container.resolve('slowService');
      
      // Clear container
      container.clear();

      // Status should show no services and no resolving state
      const status = container.getStatus();
      expect(status.registeredServices).toHaveLength(0);
      expect(status.resolving).toEqual([]);

      // Original promise should still work (but service won't be registered)
      await expect(resolutionPromise).rejects.toThrow();
    });
  });

  describe('Complex Dependency Trees', () => {
    it('should resolve deep dependency trees', async () => {
      // Create a dependency tree: A -> B -> C -> D
      container.register('serviceD', () => ({ name: 'D', level: 4 }));
      container.register('serviceC', (serviceD) => ({ 
        name: 'C', level: 3, dependency: serviceD 
      }), { dependencies: ['serviceD'] });
      container.register('serviceB', (serviceC) => ({ 
        name: 'B', level: 2, dependency: serviceC 
      }), { dependencies: ['serviceC'] });
      container.register('serviceA', (serviceB) => ({ 
        name: 'A', level: 1, dependency: serviceB 
      }), { dependencies: ['serviceB'] });

      const serviceA = await container.resolve('serviceA') as {
        name: string;
        level: number;
        dependency: {
          name: string;
          level: number;
          dependency: {
            name: string;
            level: number;
            dependency: {
              name: string;
              level: number;
            }
          }
        }
      };

      expect(serviceA.name).toBe('A');
      expect(serviceA.dependency.name).toBe('B');
      expect(serviceA.dependency.dependency.name).toBe('C');
      expect(serviceA.dependency.dependency.dependency.name).toBe('D');
    });

    it('should handle multiple dependencies', async () => {
      // Create services with multiple dependencies
      container.register('logger', () => ({ log: vi.fn() }));
      container.register('database', () => ({ query: vi.fn() }));
      container.register('cache', () => ({ get: vi.fn(), set: vi.fn() }));

      container.register('userService', (logger, database, cache) => ({
        name: 'userService',
        logger,
        database,
        cache,
        getUser: (id: number) => `User ${id}`
      }), { dependencies: ['logger', 'database', 'cache'] });

      const userService = await container.resolve('userService') as {
        name: string;
        logger: any;
        database: any;
        cache: any;
        getUser: (id: number) => string;
      };

      expect(userService.name).toBe('userService');
      expect(userService.logger).toBeDefined();
      expect(userService.database).toBeDefined();
      expect(userService.cache).toBeDefined();
      expect(userService.getUser(123)).toBe('User 123');
    });
  });
});