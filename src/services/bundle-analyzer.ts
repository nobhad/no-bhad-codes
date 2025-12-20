/**
 * ===============================================
 * BUNDLE ANALYZER SERVICE
 * ===============================================
 * @file src/services/bundle-analyzer.ts
 *
 * Analyzes bundle sizes, dependencies, and provides optimization suggestions.
 */

export interface BundleInfo {
  name: string;
  size: number;
  gzipSize?: number;
  type: 'main' | 'vendor' | 'chunk' | 'asset';
  modules?: string[];
  dependencies?: string[];
}

export interface DependencyInfo {
  name: string;
  size: number;
  version?: string;
  treeshakeable: boolean;
  alternatives?: string[];
  unusedExports?: string[];
}

export interface OptimizationSuggestion {
  type: 'bundle-split' | 'lazy-load' | 'dependency-replace' | 'tree-shake' | 'preload';
  priority: 'high' | 'medium' | 'low';
  description: string;
  estimatedSavings: number;
  implementation: string[];
}

export interface BundleAnalysis {
  totalSize: number;
  totalGzipSize: number;
  bundles: BundleInfo[];
  dependencies: DependencyInfo[];
  suggestions: OptimizationSuggestion[];
  metrics: {
    mainBundleSize: number;
    vendorBundleSize: number;
    asyncChunksSize: number;
    duplicateModules: string[];
    unusedModules: string[];
  };
}

export class BundleAnalyzerService {
  private resourceCache = new Map<string, PerformanceResourceTiming>();
  private moduleGraph = new Map<string, string[]>();

  constructor() {
    this.collectResourceTimings();
  }

  /**
   * Initialize the bundle analyzer service
   */
  async init(): Promise<void> {
    this.collectResourceTimings();
  }

  /**
   * Collect resource timing information
   */
  private collectResourceTimings(): void {
    if ('performance' in window && performance.getEntriesByType) {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

      resources.forEach((resource) => {
        if (resource.name.includes('.js') || resource.name.includes('.css')) {
          this.resourceCache.set(resource.name, resource);
        }
      });
    }
  }

  /**
   * Analyze current bundle structure
   */
  async analyzeBundles(): Promise<BundleAnalysis> {
    const bundles = await this.getBundleInfo();
    const dependencies = await this.getDependencyInfo();
    const suggestions = this.generateOptimizationSuggestions(bundles, dependencies);

    const metrics = this.calculateMetrics(bundles);
    const totalSize = bundles.reduce((sum, bundle) => sum + bundle.size, 0);
    const totalGzipSize = bundles.reduce(
      (sum, bundle) => sum + (bundle.gzipSize || bundle.size * 0.3),
      0
    );

    return {
      totalSize,
      totalGzipSize,
      bundles,
      dependencies,
      suggestions,
      metrics
    };
  }

  /**
   * Get bundle information from loaded resources
   */
  private async getBundleInfo(): Promise<BundleInfo[]> {
    const bundles: BundleInfo[] = [];

    // Analyze JavaScript bundles
    this.resourceCache.forEach((resource, url) => {
      if (url.includes('.js')) {
        const size = resource.transferSize || resource.decodedBodySize || 0;
        const gzipSize = resource.encodedBodySize || size * 0.3;

        let type: BundleInfo['type'] = 'chunk';
        const name = this.extractBundleName(url);

        if (url.includes('vendor') || url.includes('gsap')) {
          type = 'vendor';
        } else if (url.includes('main') || url.includes('index')) {
          type = 'main';
        }

        bundles.push({
          name,
          size,
          gzipSize,
          type,
          modules: this.getModulesInBundle(url),
          dependencies: this.getDependenciesInBundle(url)
        });
      }
    });

    // Add estimated bundle info for development
    if (bundles.length === 0) {
      bundles.push(
        {
          name: 'main',
          size: this.estimateMainBundleSize(),
          type: 'main',
          modules: ['src/main.ts', 'src/core/app.ts']
        },
        {
          name: 'vendor-gsap',
          size: this.estimateGSAPBundleSize(),
          type: 'vendor',
          dependencies: ['gsap']
        },
        {
          name: 'components',
          size: this.estimateComponentsBundleSize(),
          type: 'chunk',
          modules: ['src/components/*']
        }
      );
    }

    return bundles;
  }

  /**
   * Get dependency information
   */
  private async getDependencyInfo(): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [
      {
        name: 'gsap',
        size: 88000, // Approximately 88KB
        version: '3.12.5',
        treeshakeable: true,
        alternatives: ['popmotion', 'anime.js', 'framer-motion'],
        unusedExports: this.detectUnusedGSAPFeatures()
      },
      {
        name: 'typescript',
        size: 0, // Dev dependency, doesn't affect bundle
        treeshakeable: true,
        alternatives: []
      }
    ];

    return dependencies;
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizationSuggestions(
    bundles: BundleInfo[],
    dependencies: DependencyInfo[]
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Check main bundle size
    const mainBundle = bundles.find((b) => b.type === 'main');
    if (mainBundle && mainBundle.size > 150000) {
      // 150KB threshold
      suggestions.push({
        type: 'bundle-split',
        priority: 'high',
        description: 'Main bundle is larger than 150KB. Consider splitting into smaller chunks.',
        estimatedSavings: mainBundle.size * 0.3,
        implementation: [
          'Split modules by route or feature',
          'Use dynamic imports for non-critical modules',
          'Move vendor dependencies to separate chunk'
        ]
      });
    }

    // Check for large vendor dependencies
    const vendorBundles = bundles.filter((b) => b.type === 'vendor');
    vendorBundles.forEach((bundle) => {
      if (bundle.size > 100000) {
        // 100KB threshold
        suggestions.push({
          type: 'lazy-load',
          priority: 'medium',
          description: `Vendor bundle '${bundle.name}' is large. Consider lazy loading.`,
          estimatedSavings: bundle.size * 0.5,
          implementation: [
            'Load vendor dependencies only when needed',
            'Use code splitting for heavy libraries',
            'Consider lighter alternatives'
          ]
        });
      }
    });

    // Check GSAP usage
    const gsapDep = dependencies.find((d) => d.name === 'gsap');
    if (gsapDep && gsapDep.unusedExports && gsapDep.unusedExports.length > 0) {
      suggestions.push({
        type: 'tree-shake',
        priority: 'medium',
        description: 'GSAP has unused exports that can be tree-shaken.',
        estimatedSavings: gsapDep.size * 0.2,
        implementation: [
          'Import only used GSAP modules',
          'Remove unused GSAP plugins',
          'Use modular GSAP imports'
        ]
      });
    }

    // Check for preloading opportunities
    const criticalBundles = bundles.filter((b) => b.type === 'main' || b.name.includes('core'));
    if (criticalBundles.length > 0) {
      suggestions.push({
        type: 'preload',
        priority: 'low',
        description: 'Critical bundles can be preloaded for better performance.',
        estimatedSavings: 500, // Time savings in ms
        implementation: [
          'Add <link rel="preload"> for critical bundles',
          'Use modulepreload for ES modules',
          'Implement resource hints'
        ]
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Calculate bundle metrics
   */
  private calculateMetrics(bundles: BundleInfo[]): BundleAnalysis['metrics'] {
    const mainBundleSize = bundles
      .filter((b) => b.type === 'main')
      .reduce((sum, b) => sum + b.size, 0);

    const vendorBundleSize = bundles
      .filter((b) => b.type === 'vendor')
      .reduce((sum, b) => sum + b.size, 0);

    const asyncChunksSize = bundles
      .filter((b) => b.type === 'chunk')
      .reduce((sum, b) => sum + b.size, 0);

    return {
      mainBundleSize,
      vendorBundleSize,
      asyncChunksSize,
      duplicateModules: this.detectDuplicateModules(bundles),
      unusedModules: this.detectUnusedModules()
    };
  }

  /**
   * Extract bundle name from URL
   */
  private extractBundleName(url: string): string {
    const parts = url.split('/');
    const filename = parts[parts.length - 1] || '';
    return filename?.split('-')[0] || filename?.split('.')[0] || 'unknown';
  }

  /**
   * Get modules in bundle (estimation for dev mode)
   */
  private getModulesInBundle(url: string): string[] {
    // In production, this could parse source maps
    // For development, we'll estimate based on bundle name
    if (url.includes('main')) {
      return ['src/main.ts', 'src/core/app.ts', 'src/core/state/index.ts'];
    }
    if (url.includes('vendor')) {
      return ['node_modules/gsap'];
    }
    return [];
  }

  /**
   * Get dependencies in bundle
   */
  private getDependenciesInBundle(url: string): string[] {
    if (url.includes('vendor') || url.includes('gsap')) {
      return ['gsap'];
    }
    return [];
  }

  /**
   * Estimate main bundle size for development
   */
  private estimateMainBundleSize(): number {
    // Rough estimation based on typical TypeScript module sizes
    return 45000; // ~45KB estimated
  }

  /**
   * Estimate GSAP bundle size
   */
  private estimateGSAPBundleSize(): number {
    return 88000; // ~88KB for GSAP core + commonly used plugins
  }

  /**
   * Estimate components bundle size
   */
  private estimateComponentsBundleSize(): number {
    return 25000; // ~25KB estimated for component system
  }

  /**
   * Detect unused GSAP features
   */
  private detectUnusedGSAPFeatures(): string[] {
    // Analyze code to find unused GSAP imports
    // For now, return common unused features
    return ['ScrollTrigger', 'Draggable', 'MorphSVGPlugin'];
  }

  /**
   * Detect duplicate modules across bundles
   */
  private detectDuplicateModules(bundles: BundleInfo[]): string[] {
    const moduleCount = new Map<string, number>();

    bundles.forEach((bundle) => {
      bundle.modules?.forEach((module) => {
        moduleCount.set(module, (moduleCount.get(module) || 0) + 1);
      });
    });

    return Array.from(moduleCount.entries())
      .filter(([, count]) => count > 1)
      .map(([module]) => module);
  }

  /**
   * Detect unused modules
   */
  private detectUnusedModules(): string[] {
    // This would require static analysis in a real implementation
    // For now, return commonly unused modules
    return [];
  }

  /**
   * Generate bundle size report
   */
  generateReport(analysis: BundleAnalysis): string {
    let report = '# Bundle Analysis Report\n\n';

    report += '## Overview\n';
    report += `- Total Size: ${this.formatBytes(analysis.totalSize)}\n`;
    report += `- Gzipped Size: ${this.formatBytes(analysis.totalGzipSize)}\n`;
    report += `- Number of Bundles: ${analysis.bundles.length}\n\n`;

    report += '## Bundle Breakdown\n';
    analysis.bundles.forEach((bundle) => {
      report += `### ${bundle.name} (${bundle.type})\n`;
      report += `- Size: ${this.formatBytes(bundle.size)}\n`;
      if (bundle.gzipSize) {
        report += `- Gzipped: ${this.formatBytes(bundle.gzipSize)}\n`;
      }
      if (bundle.modules?.length) {
        report += `- Modules: ${bundle.modules.length}\n`;
      }
      report += '\n';
    });

    if (analysis.suggestions.length > 0) {
      report += '## Optimization Suggestions\n';
      analysis.suggestions.forEach((suggestion, index) => {
        report += `${index + 1}. **${suggestion.description}** (${suggestion.priority} priority)\n`;
        report += `   Estimated Savings: ${this.formatBytes(suggestion.estimatedSavings)}\n`;
        report += '   Implementation:\n';
        suggestion.implementation.forEach((step) => {
          report += `   - ${step}\n`;
        });
        report += '\n';
      });
    }

    return report;
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Export analysis as JSON
   */
  exportAnalysis(analysis: BundleAnalysis): string {
    return JSON.stringify(analysis, null, 2);
  }

  /**
   * Clear cached data and re-analyze
   */
  refresh(): void {
    this.resourceCache.clear();
    this.moduleGraph.clear();
    this.collectResourceTimings();
  }
}
