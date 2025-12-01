/**
 * ===============================================
 * DEPENDENCY INJECTION CONTAINER
 * ===============================================
 * @file scripts/core/container.ts
 *
 * Manages module dependencies and provides dependency injection
 * for better decoupling and testability.
 */

export type ServiceFactory<T = any> = (...args: any[]) => T | Promise<T>;
export type ServiceInstance<T = any> = T;

export interface ServiceDefinition<T = any> {
  factory: ServiceFactory<T>;
  singleton: boolean;
  dependencies?: string[];
  instance?: ServiceInstance<T>;
}

export class Container {
  private services = new Map<string, ServiceDefinition>();
  private resolving = new Set<string>(); // Track circular dependencies
  private pending = new Map<string, Promise<any>>(); // Track pending resolutions

  /**
   * Register a service
   */
  register<T>(
    name: string,
    factory: ServiceFactory<T>,
    options: { singleton?: boolean; dependencies?: string[] } = {}
  ): void {
    this.services.set(name, {
      factory,
      singleton: options.singleton ?? true,
      dependencies: options.dependencies ?? []
    });
  }

  /**
   * Register a singleton service (default behavior)
   */
  singleton<T>(name: string, factory: ServiceFactory<T>, dependencies: string[] = []): void {
    this.register(name, factory, { singleton: true, dependencies });
  }

  /**
   * Register a transient service (new instance each time)
   */
  transient<T>(name: string, factory: ServiceFactory<T>, dependencies: string[] = []): void {
    this.register(name, factory, { singleton: false, dependencies });
  }

  /**
   * Resolve a service by name
   */
  async resolve<T>(name: string): Promise<T> {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not registered`);
    }

    // Return existing singleton instance
    if (service.singleton && service.instance) {
      return service.instance as T;
    }

    // If already pending (concurrent resolution of singleton), wait for it
    // This must be checked BEFORE circular dependency check to handle concurrent resolutions
    if (this.pending.has(name)) {
      return this.pending.get(name) as Promise<T>;
    }

    // Check for circular dependencies
    if (this.resolving.has(name)) {
      throw new Error(`Circular dependency detected for service ${name}`);
    }

    this.resolving.add(name);

    // Create a promise for this resolution and store it
    const resolutionPromise = (async () => {
      try {
        // Resolve dependencies first
        const dependencies = await Promise.all(
          (service.dependencies || []).map((dep) => this.resolve(dep))
        );

        // Create instance
        const instance = await service.factory(...(dependencies as unknown[]));

        // Cache singleton instance
        if (service.singleton) {
          service.instance = instance;
        }

        this.resolving.delete(name);
        this.pending.delete(name);
        return instance as T;
      } catch (error) {
        this.resolving.delete(name);
        this.pending.delete(name);
        throw error;
      }
    })();

    this.pending.set(name, resolutionPromise);
    return resolutionPromise;
  }

  /**
   * Check if service is registered
   */
  isRegistered(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Clear all services
   */
  clear(): void {
    this.services.clear();
    this.resolving.clear();
    this.pending.clear();
  }

  /**
   * Get container status
   */
  getStatus() {
    const registeredServices = Array.from(this.services.keys());
    const singletonInstances = registeredServices.filter((name) => {
      const service = this.services.get(name);
      return service?.singleton && service.instance !== undefined;
    });

    return {
      registeredServices,
      instanceCount: singletonInstances.length,
      registrationCount: registeredServices.length,
      resolving: Array.from(this.resolving)
    };
  }

  /**
   * Check if service is registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Get all registered service names
   */
  getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }
}

// Global container instance
export const container = new Container();
