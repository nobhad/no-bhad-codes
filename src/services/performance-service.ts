/**
 * ===============================================
 * PERFORMANCE MONITORING SERVICE
 * ===============================================
 * @file src/services/performance-service.ts
 *
 * Core Web Vitals monitoring, performance metrics tracking,
 * and optimization suggestions.
 */

export interface PerformanceMetrics {
  // Core Web Vitals
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift

  // Loading Performance
  ttfb?: number; // Time to First Byte
  fcp?: number; // First Contentful Paint
  domContentLoaded?: number;
  loadComplete?: number;

  // JavaScript Performance
  bundleSize?: number;
  parseTime?: number;
  executeTime?: number;

  // Memory Usage
  memoryUsage?: {
    used: number;
    total: number;
    limit: number;
  };

  // Network
  connectionType?: string;
  downloadSpeed?: number;

  // Custom Metrics
  customMetrics?: Record<string, number>;
}

export interface PerformanceBudget {
  lcp: number; // < 2.5s good, < 4s needs improvement
  fid: number; // < 100ms good, < 300ms needs improvement
  cls: number; // < 0.1 good, < 0.25 needs improvement
  bundleSize: number; // < 170KB recommended
  ttfb: number; // < 200ms good
}

export interface PerformanceAlert {
  type: 'warning' | 'error';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  suggestions: string[];
}

import { APP_CONSTANTS } from '../config/constants';

export class PerformanceService {
  private metrics: PerformanceMetrics = {};
  private budget: PerformanceBudget;
  private observers: PerformanceObserver[] = [];
  private alerts: PerformanceAlert[] = [];
  private isMonitoring = false;

  constructor(budget?: Partial<PerformanceBudget>) {
    this.budget = {
      lcp: APP_CONSTANTS.PERFORMANCE.FCP_GOOD, // 1.8s
      fid: 100,  // 100ms
      cls: 0.1,  // 0.1
      bundleSize: 600 * 1024, // 600KB - Increased to realistic size for TypeScript app
      ttfb: 200, // 200ms
      ...budget
    };
  }

  /**
   * Initialize the performance service
   */
  async init(): Promise<void> {
    // Skip performance monitoring in development to prevent flashing/reloading
    if ((import.meta as any).env?.DEV || process.env.NODE_ENV === 'development') {
      console.log('[PerformanceService] Skipping monitoring in development mode');
      return;
    }

    await this.startMonitoring();
  }

  /**
   * Start monitoring performance metrics
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    // Monitor Core Web Vitals
    await this.measureCoreWebVitals();

    // Monitor loading performance
    await this.measureLoadingPerformance();

    // Monitor JavaScript performance
    await this.measureJavaScriptPerformance();

    // Monitor memory usage
    this.monitorMemoryUsage();

    // Monitor network performance
    this.measureNetworkPerformance();

    // Set up continuous monitoring
    this.setupContinuousMonitoring();

    console.log('[PerformanceService] Monitoring started');
  }

  /**
   * Measure Core Web Vitals
   */
  private async measureCoreWebVitals(): Promise<void> {
    // Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;

          this.metrics.lcp = lastEntry.startTime || 0;
          if (this.metrics.lcp !== undefined) {
            this.checkBudget('lcp', this.metrics.lcp);
          }

          console.log('[Performance] LCP:', this.metrics.lcp);
        });

        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch (e) {
        console.warn('[PerformanceService] LCP monitoring not supported');
      }

      // First Input Delay
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            this.metrics.fid = entry.processingStart - entry.startTime;
            this.checkBudget('fid', this.metrics.fid);

            console.log('[Performance] FID:', this.metrics.fid);
          });
        });

        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);
      } catch (e) {
        console.warn('[PerformanceService] FID monitoring not supported');
      }

      // Cumulative Layout Shift
      try {
        let clsScore = 0;

        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsScore += entry.value;
            }
          });

          this.metrics.cls = clsScore;
          this.checkBudget('cls', this.metrics.cls);
        });

        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      } catch (e) {
        console.warn('[PerformanceService] CLS monitoring not supported');
      }
    }
  }

  /**
   * Measure loading performance
   */
  private async measureLoadingPerformance(): Promise<void> {
    if (performance.timing) {
      const timing = performance.timing;

      this.metrics.ttfb = timing.responseStart - timing.requestStart;
      this.metrics.domContentLoaded = timing.domContentLoadedEventEnd - timing.navigationStart;
      this.metrics.loadComplete = timing.loadEventEnd - timing.navigationStart;

      this.checkBudget('ttfb', this.metrics.ttfb);
    }

    // First Contentful Paint
    if ('PerformanceObserver' in window) {
      try {
        const paintObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              this.metrics.fcp = entry.startTime;
              console.log('[Performance] FCP:', this.metrics.fcp);
            }
          });
        });

        paintObserver.observe({ entryTypes: ['paint'] });
        this.observers.push(paintObserver);
      } catch (e) {
        console.warn('[PerformanceService] Paint timing not supported');
      }
    }
  }

  /**
   * Measure JavaScript performance
   */
  private async measureJavaScriptPerformance(): Promise<void> {
    // Bundle size estimation
    if (performance.getEntriesByType) {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      let totalJSSize = 0;

      resources.forEach(resource => {
        if (resource.name.includes('.js') || resource.name.includes('/src/')) {
          totalJSSize += (resource.transferSize || resource.decodedBodySize || 0);
        }
      });

      this.metrics.bundleSize = totalJSSize;
      this.checkBudget('bundleSize', totalJSSize);

      console.log('[Performance] Estimated bundle size:', totalJSSize);
    }

    // Parse and execution timing
    const parseStart = performance.now();
    await new Promise(resolve => setTimeout(resolve, 0));
    this.metrics.parseTime = performance.now() - parseStart;
  }

  /**
   * Monitor memory usage
   */
  private monitorMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;

      this.metrics.memoryUsage = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      };

      // Check for memory issues
      const usagePercent = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      if (usagePercent > 0.8) {
        this.addAlert({
          type: 'warning',
          metric: 'memoryUsage',
          value: usagePercent * 100,
          threshold: 80,
          message: 'High memory usage detected',
          suggestions: [
            'Review memory leaks in event listeners',
            'Check for retained DOM references',
            'Consider reducing bundle size'
          ]
        });
      }
    }
  }

  /**
   * Measure network performance
   */
  private measureNetworkPerformance(): void {
    const connection = (navigator as any).connection;
    if (connection) {
      this.metrics.connectionType = connection.effectiveType;
      this.metrics.downloadSpeed = connection.downlink;
    }
  }

  /**
   * Set up continuous monitoring
   */
  private setupContinuousMonitoring(): void {
    // Monitor based on configuration
    setInterval(() => {
      this.monitorMemoryUsage();
      this.measureNetworkPerformance();
    }, APP_CONSTANTS.TIMERS.PERFORMANCE_MONITORING);

    // Monitor page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.recordCustomMetric('pageVisibilityResume', performance.now());
      }
    });
  }

  /**
   * Check if metric exceeds budget
   */
  private checkBudget(metric: keyof PerformanceBudget, value: number): void {
    const threshold = this.budget[metric];

    if (value > threshold) {
      const suggestions = this.getSuggestions(metric, value);

      this.addAlert({
        type: value > threshold * 1.5 ? 'error' : 'warning',
        metric,
        value,
        threshold,
        message: `${metric.toUpperCase()} exceeded budget`,
        suggestions
      });
    }
  }

  /**
   * Get optimization suggestions
   */
  private getSuggestions(metric: string, value: number): string[] {
    const suggestions: Record<string, string[]> = {
      lcp: [
        'Optimize images with modern formats (WebP, AVIF)',
        'Implement critical CSS inlining',
        'Use CDN for faster asset delivery',
        'Preload key resources'
      ],
      fid: [
        'Minimize JavaScript execution time',
        'Code split large bundles',
        'Use web workers for heavy computations',
        'Defer non-critical JavaScript'
      ],
      cls: [
        'Set explicit dimensions for images and videos',
        'Avoid inserting content above existing content',
        'Use CSS transforms instead of properties that trigger layout',
        'Reserve space for dynamic content'
      ],
      ttfb: [
        'Optimize server response time',
        'Use CDN for faster delivery',
        'Implement proper caching strategies',
        'Minimize server-side processing'
      ],
      bundleSize: [
        'Enable tree shaking',
        'Split bundles by route',
        'Remove unused dependencies',
        'Use dynamic imports for code splitting'
      ]
    };

    return suggestions[metric] || ['Consider optimizing this metric'];
  }

  /**
   * Add performance alert
   */
  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);

    if (alert.type === 'error') {
      console.error(`[Performance ${alert.type.toUpperCase()}]`, alert.message, {
        value: alert.value,
        threshold: alert.threshold,
        suggestions: alert.suggestions
      });
    } else {
      console.warn(`[Performance ${alert.type.toUpperCase()}]`, alert.message, {
        value: alert.value,
        threshold: alert.threshold,
        suggestions: alert.suggestions
      });
    }
  }

  /**
   * Record custom metric
   */
  recordCustomMetric(name: string, value: number): void {
    if (!this.metrics.customMetrics) {
      this.metrics.customMetrics = {};
    }

    this.metrics.customMetrics[name] = value;
    console.log(`[Performance] Custom metric ${name}:`, value);
  }

  /**
   * Mark performance timing
   */
  mark(name: string): void {
    if (performance.mark) {
      performance.mark(name);
    }
  }

  /**
   * Measure between two marks
   */
  measure(name: string, startMark: string, endMark?: string): number | null {
    if (performance.measure && performance.getEntriesByName) {
      try {
        performance.measure(name, startMark, endMark);
        const measures = performance.getEntriesByName(name, 'measure');
        const duration = measures[measures.length - 1]?.duration || 0;

        this.recordCustomMetric(name, duration);
        return duration;
      } catch (e) {
        console.warn('[PerformanceService] Failed to measure:', e);
        return null;
      }
    }
    return null;
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get performance alerts
   */
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Get performance score
   */
  getScore(): number {
    let score = 100;

    // Deduct points based on Core Web Vitals
    if (this.metrics.lcp) {
      if (this.metrics.lcp > APP_CONSTANTS.PERFORMANCE.LOAD_NEEDS_WORK) score -= 30;
      else if (this.metrics.lcp > APP_CONSTANTS.PERFORMANCE.FCP_NEEDS_WORK) score -= 15;
    }

    if (this.metrics.fid) {
      if (this.metrics.fid > 300) score -= 25;
      else if (this.metrics.fid > 100) score -= 10;
    }

    if (this.metrics.cls) {
      if (this.metrics.cls > 0.25) score -= 20;
      else if (this.metrics.cls > 0.1) score -= 10;
    }

    return Math.max(0, score);
  }

  /**
   * Generate performance report
   */
  generateReport(): {
    score: number;
    metrics: PerformanceMetrics;
    alerts: PerformanceAlert[];
    recommendations: string[];
    } {
    const recommendations: string[] = [];

    this.alerts.forEach(alert => {
      recommendations.push(...alert.suggestions);
    });

    // Remove duplicates
    const uniqueRecommendations = [...new Set(recommendations)];

    return {
      score: this.getScore(),
      metrics: this.getMetrics(),
      alerts: this.getAlerts(),
      recommendations: uniqueRecommendations
    };
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.isMonitoring = false;

    console.log('[PerformanceService] Monitoring stopped');
  }

  /**
   * Clear metrics and alerts
   */
  reset(): void {
    this.metrics = {};
    this.alerts = [];

    if (performance.clearMarks) {
      performance.clearMarks();
    }
    if (performance.clearMeasures) {
      performance.clearMeasures();
    }
  }
}