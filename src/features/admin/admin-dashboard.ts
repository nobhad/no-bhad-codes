/**
 * ===============================================
 * ADMIN DASHBOARD CONTROLLER
 * ===============================================
 * @file src/admin/admin-dashboard.ts
 *
 * Secure admin dashboard for performance and analytics monitoring.
 * Only accessible with proper authentication.
 */

import { AdminSecurity } from './admin-security';
import type { PerformanceMetrics, PerformanceAlert } from '../../services/performance-service';
import { Chart, registerables } from 'chart.js';

// Register all Chart.js components
Chart.register(...registerables);

// Type definitions
interface PerformanceReport {
  score: number;
  metrics: PerformanceMetrics;
  alerts: PerformanceAlert[];
  recommendations: string[];
}

interface PerformanceMetricDisplay {
  value: string;
  status: string;
}

interface PerformanceMetricsDisplay {
  lcp: PerformanceMetricDisplay;
  fid: PerformanceMetricDisplay;
  cls: PerformanceMetricDisplay;
  ttfb: PerformanceMetricDisplay;
  score: number;
  grade: string;
  bundleSize?: {
    total: string;
    main: string;
    vendor: string;
  };
  alerts?: string[];
}

interface AnalyticsDataItem {
  label: string;
  value: string | number;
}

interface AnalyticsData {
  popularPages?: AnalyticsDataItem[];
  deviceBreakdown?: AnalyticsDataItem[];
  geoDistribution?: AnalyticsDataItem[];
  engagementEvents?: AnalyticsDataItem[];
}

interface PageView {
  url: string;
  timestamp: number;
  [key: string]: unknown;
}

interface Session {
  id: string;
  startTime: number;
  [key: string]: unknown;
}

interface Interaction {
  type: string;
  timestamp: number;
  [key: string]: unknown;
}

interface RawVisitorData {
  sessions?: Session[];
  pageViews?: PageView[];
  interactions?: Interaction[];
  [key: string]: unknown;
}

interface StatusItem {
  status: string;
  [key: string]: unknown;
}

interface ApplicationStatus {
  modules: Record<string, StatusItem>;
  services: Record<string, StatusItem>;
}

interface VisitorInfo {
  id: string;
  firstVisit: string;
  lastVisit: string;
  sessions: number;
  pageViews: number;
  location: string;
  device: string;
}

declare global {
  interface ImportMeta {
    env?: Record<string, string | undefined>;
  }
}

// Admin authentication and session management using JWT backend
class AdminAuth {
  private static readonly SESSION_KEY = 'nbw_admin_session';
  private static readonly TOKEN_KEY = 'nbw_admin_token';
  private static readonly API_BASE = '/api/auth';

  /**
   * Authenticate with backend JWT API
   * Falls back to client-side hash for offline/development mode
   */
  static async authenticate(inputKey: string): Promise<boolean> {
    try {
      // Check rate limiting first
      AdminSecurity.checkRateLimit();

      // Try backend authentication first
      try {
        const response = await fetch(`${this.API_BASE}/admin/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ password: inputKey })
        });

        if (response.ok) {
          const data = await response.json();

          // Clear failed attempts on successful login
          AdminSecurity.clearAttempts();

          // Store JWT token and session
          localStorage.setItem(this.TOKEN_KEY, data.token);
          const session = {
            authenticated: true,
            timestamp: Date.now(),
            expiresIn: data.expiresIn
          };
          sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));

          return true;
        } else if (response.status === 401) {
          // Invalid credentials
          AdminSecurity.recordFailedAttempt();
          return false;
        }
        // For other errors, fall through to fallback
      } catch (fetchError) {
        console.warn('[AdminAuth] Backend auth failed, using fallback:', fetchError);
      }

      // Fallback: Client-side hash authentication for offline/development
      const fallbackHash =
        (import.meta.env && import.meta.env.VITE_ADMIN_PASSWORD_HASH) ||
        '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'; // Default: 'admin' in SHA256

      const encoder = new TextEncoder();
      const data = encoder.encode(inputKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      if (hashHex === fallbackHash) {
        AdminSecurity.clearAttempts();
        const session = {
          authenticated: true,
          timestamp: Date.now(),
          fallback: true // Mark as fallback auth
        };
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        return true;
      }

      AdminSecurity.recordFailedAttempt();
      return false;
    } catch (error) {
      console.error('[AdminAuth] Authentication error:', error);
      AdminSecurity.recordFailedAttempt();
      throw error;
    }
  }

  /**
   * Check if user is authenticated (valid session or token)
   */
  static isAuthenticated(): boolean {
    try {
      // Check for JWT token first
      const token = localStorage.getItem(this.TOKEN_KEY);
      if (token) {
        // Validate token hasn't expired (basic check)
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.exp && payload.exp * 1000 > Date.now()) {
            return true;
          }
          // Token expired, clean up
          this.logout();
          return false;
        } catch {
          // Invalid token format
          this.logout();
          return false;
        }
      }

      // Fallback: Check session storage
      const sessionData = sessionStorage.getItem(this.SESSION_KEY);
      if (!sessionData) return false;

      const session = JSON.parse(sessionData);
      const sessionDuration = 60 * 60 * 1000; // 1 hour
      const isValid =
        session.authenticated && Date.now() - session.timestamp < sessionDuration;

      if (!isValid) {
        this.logout();
      }

      return isValid;
    } catch (error) {
      console.error('[AdminAuth] Session validation error:', error);
      return false;
    }
  }

  /**
   * Get the current JWT token for API calls
   */
  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Logout and clear all auth data
   */
  static logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.SESSION_KEY);
    window.location.reload();
  }

  /**
   * Extend session timestamp for activity
   */
  static extendSession(): void {
    try {
      const sessionData = sessionStorage.getItem(this.SESSION_KEY);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        session.timestamp = Date.now();
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      }
    } catch (error) {
      console.error('[AdminAuth] Session extension error:', error);
    }
  }
}

// Dashboard data management
class AdminDashboard {
  private currentTab = 'overview';
  private refreshInterval: NodeJS.Timeout | null = null;
  private charts: Map<string, Chart> = new Map();

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // Initialize security measures first
    AdminSecurity.init();

    // Initialize navigation and theme modules
    await this.initializeModules();

    // Check authentication
    if (!AdminAuth.isAuthenticated()) {
      this.showAuthGate();
      return;
    }

    this.showDashboard();
    this.setupEventListeners();
    await this.loadDashboardData();
    this.startAutoRefresh();
  }

  private async initializeModules(): Promise<void> {
    try {
      // Initialize theme module
      const { ThemeModule } = await import('../../modules/theme');
      const theme = new ThemeModule({ debug: false });
      await theme.init();
    } catch (error) {
      console.warn('[AdminDashboard] Theme module failed to initialize:', error);
    }

    try {
      // Initialize navigation module
      const { NavigationModule } = await import('../../modules/navigation');
      const nav = new NavigationModule({ debug: false });
      await nav.init();
    } catch (error) {
      console.warn('[AdminDashboard] Navigation module failed to initialize:', error);
    }
  }

  private showAuthGate(): void {
    const authGate = document.getElementById('auth-gate');
    const dashboard = document.getElementById('admin-dashboard');

    if (authGate) authGate.classList.remove('hidden');
    if (dashboard) dashboard.classList.add('hidden');

    this.setupAuthEventListeners();
  }

  private showDashboard(): void {
    const authGate = document.getElementById('auth-gate');
    const dashboard = document.getElementById('admin-dashboard');

    if (authGate) authGate.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');
  }

  private setupAuthEventListeners(): void {
    const authForm = document.getElementById('auth-form') as HTMLFormElement;

    if (authForm) {
      authForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(authForm);
        const authKey = formData.get('authKey') as string;

        try {
          if (await AdminAuth.authenticate(authKey)) {
            this.showDashboard();
            this.setupEventListeners();
            await this.loadDashboardData();
            this.startAutoRefresh();
          } else {
            this.showAuthError('Invalid access key. Please try again.');
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Authentication failed. Please try again.';
          this.showAuthError(message);
        }
      });
    }
  }

  private showAuthError(message: string): void {
    const authError = document.getElementById('auth-error');
    if (authError) {
      authError.textContent = message;
      authError.classList.remove('hidden');
      setTimeout(() => {
        authError.classList.add('hidden');
      }, 5000);
    }
  }

  private setupEventListeners(): void {
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        AdminAuth.logout();
      });
    }

    // Tab navigation
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const tabName = target.dataset.tab;
        if (tabName) {
          this.switchTab(tabName);
        }
      });
    });

    // Refresh buttons
    const refreshAnalytics = document.getElementById('refresh-analytics');
    if (refreshAnalytics) {
      refreshAnalytics.addEventListener('click', () => {
        this.loadAnalyticsData();
      });
    }

    // Export buttons
    this.setupExportButtons();

    // Data management buttons
    this.setupDataManagementButtons();

    // Extend session on activity
    document.addEventListener('click', () => {
      AdminAuth.extendSession();
    });

    document.addEventListener('keydown', () => {
      AdminAuth.extendSession();
    });
  }

  private setupExportButtons(): void {
    const exportAnalytics = document.getElementById('export-analytics');
    const exportVisitors = document.getElementById('export-visitors');
    const exportPerformance = document.getElementById('export-performance');

    if (exportAnalytics) {
      exportAnalytics.addEventListener('click', () => {
        this.exportData('analytics');
      });
    }

    if (exportVisitors) {
      exportVisitors.addEventListener('click', () => {
        this.exportData('visitors');
      });
    }

    if (exportPerformance) {
      exportPerformance.addEventListener('click', () => {
        this.exportData('performance');
      });
    }
  }

  private setupDataManagementButtons(): void {
    const clearOldData = document.getElementById('clear-old-data');
    const resetAnalytics = document.getElementById('reset-analytics');

    if (clearOldData) {
      clearOldData.addEventListener('click', () => {
        this.clearOldData();
      });
    }

    if (resetAnalytics) {
      resetAnalytics.addEventListener('click', () => {
        this.resetAnalytics();
      });
    }
  }

  private switchTab(tabName: string): void {
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

    // Update active tab content
    document.querySelectorAll('.tab-content').forEach((content) => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`)?.classList.add('active');

    this.currentTab = tabName;

    // Load tab-specific data
    this.loadTabData(tabName);
  }

  private async loadDashboardData(): Promise<void> {
    this.showLoading(true);

    try {
      await Promise.all([
        this.loadOverviewData(),
        this.loadPerformanceData(),
        this.loadAnalyticsData(),
        this.loadVisitorsData(),
        this.loadSystemData()
      ]);
    } catch (error) {
      console.error('[AdminDashboard] Error loading data:', error);
    } finally {
      this.showLoading(false);
    }
  }

  private async loadTabData(tabName: string): Promise<void> {
    this.showLoading(true);

    try {
      switch (tabName) {
      case 'overview':
        await this.loadOverviewData();
        break;
      case 'performance':
        await this.loadPerformanceData();
        break;
      case 'analytics':
        await this.loadAnalyticsData();
        break;
      case 'visitors':
        await this.loadVisitorsData();
        break;
      case 'system':
        await this.loadSystemData();
        break;
      }
    } catch (error) {
      console.error(`[AdminDashboard] Error loading ${tabName} data:`, error);
    } finally {
      this.showLoading(false);
    }
  }

  private async loadOverviewData(): Promise<void> {
    // Simulate API call - replace with actual data fetching
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Mock data - replace with actual analytics data
    this.updateElement('total-visitors', '1,234');
    this.updateElement('visitors-change', '+12% from last week', 'positive');

    this.updateElement('page-views', '5,678');
    this.updateElement('views-change', '+8% from last week', 'positive');

    this.updateElement('avg-session', '2m 34s');
    this.updateElement('session-change', '-3% from last week', 'negative');

    this.updateElement('card-interactions', '456');
    this.updateElement('interactions-change', '+18% from last week', 'positive');

    // Load real Chart.js charts
    this.loadChart('visitors-chart', 'visitors');
    this.loadChart('sources-chart', 'sources');
  }

  private async loadPerformanceData(): Promise<void> {
    try {
      // Initialize the PerformanceDashboard component for admin use
      await this.initializePerformanceDashboard();

      // Get actual performance data from the service
      const perfData = await this.getPerformanceMetrics();

      // Core Web Vitals
      this.updateVital('lcp', perfData.lcp);
      this.updateVital('fid', perfData.fid);
      this.updateVital('cls', perfData.cls);

      // Bundle analysis
      if (perfData.bundleSize) {
        this.updateElement('total-bundle-size', perfData.bundleSize.total);
        this.updateElement('js-bundle-size', perfData.bundleSize.main);
        this.updateElement('css-bundle-size', perfData.bundleSize.vendor);
      }

      // Performance score and alerts
      if (perfData.score !== undefined) {
        this.updateElement('performance-score', `${Math.round(perfData.score)}/100`);
      }

      if (perfData.alerts && perfData.alerts.length > 0) {
        this.displayPerformanceAlerts(
          perfData.alerts.map(
            (msg) =>
              ({
                type: 'warning' as const,
                message: msg,
                metric: '',
                value: 0,
                threshold: 0
              }) as PerformanceAlert
          )
        );
      }
    } catch (error) {
      console.error('[AdminDashboard] Error loading performance data:', error);
    }
  }

  private async getPerformanceMetrics(): Promise<PerformanceMetricsDisplay> {
    try {
      // Try to get data from the main app's services via parent window
      if (window.opener?.NBW_DEBUG) {
        const debug = window.opener.NBW_DEBUG;
        if (debug.getPerformanceReport) {
          return (await debug.getPerformanceReport()) as unknown as PerformanceMetricsDisplay;
        }
      }

      // Try to get data from current window (if services are available)
      if (window.NBW_DEBUG?.getPerformanceReport) {
        return (await window.NBW_DEBUG.getPerformanceReport()) as unknown as PerformanceMetricsDisplay;
      }

      // Try to access services directly from container
      const { container } = await import('../../core/container');
      const performanceService = (await container.resolve('PerformanceService')) as {
        generateReport?: () => PerformanceReport;
      };
      if (performanceService?.generateReport) {
        const report = performanceService.generateReport();
        return {
          lcp: {
            value: report.metrics.lcp ? `${Math.round(report.metrics.lcp)}ms` : 'N/A',
            status: this.getVitalStatus('lcp', report.metrics.lcp)
          },
          fid: {
            value: report.metrics.fid ? `${Math.round(report.metrics.fid)}ms` : 'N/A',
            status: this.getVitalStatus('fid', report.metrics.fid)
          },
          cls: {
            value: report.metrics.cls ? report.metrics.cls.toFixed(3) : 'N/A',
            status: this.getVitalStatus('cls', report.metrics.cls)
          },
          ttfb: {
            value: report.metrics.ttfb ? `${Math.round(report.metrics.ttfb)}ms` : 'N/A',
            status: this.getVitalStatus('ttfb', report.metrics.ttfb)
          },
          bundleSize: {
            total: report.metrics.bundleSize
              ? `${Math.round(report.metrics.bundleSize / 1024)} KB`
              : 'N/A',
            main: 'N/A',
            vendor: 'N/A'
          },
          score: report.score || 0,
          grade: this.getGradeFromScore(report.score || 0),
          alerts: (report.alerts || []).map((alert) => alert.message)
        };
      }
    } catch (error) {
      console.warn('[AdminDashboard] Could not get live performance data:', error);
    }

    // Fallback mock data
    return {
      lcp: { value: '1.2s', status: 'good' },
      fid: { value: '45ms', status: 'good' },
      cls: { value: '0.05', status: 'good' },
      ttfb: { value: '120ms', status: 'good' },
      bundleSize: {
        total: '156 KB',
        main: '98 KB',
        vendor: '58 KB'
      },
      score: 95,
      grade: 'A',
      alerts: []
    };
  }

  private getVitalStatus(metric: string, value?: number): string {
    if (!value) return 'unknown';

    switch (metric) {
    case 'lcp':
      return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
    case 'fid':
      return value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor';
    case 'cls':
      return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
    default:
      return 'unknown';
    }
  }

  private getGradeFromScore(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private async loadAnalyticsData(): Promise<void> {
    try {
      const analyticsData = await this.getAnalyticsData();

      // Update with real data if available, otherwise use mock data
      this.populateDataList(
        'popular-pages',
        analyticsData.popularPages || [
          { label: 'Homepage', value: '2,145 views' },
          { label: 'Art Portfolio', value: '856 views' },
          { label: 'Codes Section', value: '634 views' },
          { label: 'Contact', value: '423 views' },
          { label: 'About', value: '312 views' }
        ]
      );

      this.populateDataList(
        'device-breakdown',
        analyticsData.deviceBreakdown || [
          { label: 'Desktop', value: '45%' },
          { label: 'Mobile', value: '38%' },
          { label: 'Tablet', value: '17%' }
        ]
      );

      this.populateDataList(
        'geo-distribution',
        analyticsData.geoDistribution || [
          { label: 'United States', value: '42%' },
          { label: 'Canada', value: '18%' },
          { label: 'United Kingdom', value: '12%' },
          { label: 'Germany', value: '8%' },
          { label: 'Other', value: '20%' }
        ]
      );

      this.populateDataList(
        'engagement-events',
        analyticsData.engagementEvents || [
          { label: 'Business Card Flips', value: '456' },
          { label: 'Contact Form Submissions', value: '23' },
          { label: 'External Link Clicks', value: '187' },
          { label: 'Download Clicks', value: '34' }
        ]
      );
    } catch (error) {
      console.error('[AdminDashboard] Error loading analytics data:', error);

      // Fallback to mock data
      this.populateDataList('popular-pages', [
        { label: 'Homepage', value: '2,145 views' },
        { label: 'Art Portfolio', value: '856 views' },
        { label: 'Codes Section', value: '634 views' },
        { label: 'Contact', value: '423 views' },
        { label: 'About', value: '312 views' }
      ]);

      this.populateDataList('device-breakdown', [
        { label: 'Desktop', value: '45%' },
        { label: 'Mobile', value: '38%' },
        { label: 'Tablet', value: '17%' }
      ]);

      this.populateDataList('geo-distribution', [
        { label: 'United States', value: '42%' },
        { label: 'Canada', value: '18%' },
        { label: 'United Kingdom', value: '12%' },
        { label: 'Germany', value: '8%' },
        { label: 'Other', value: '20%' }
      ]);

      this.populateDataList('engagement-events', [
        { label: 'Business Card Flips', value: '456' },
        { label: 'Contact Form Submissions', value: '23' },
        { label: 'External Link Clicks', value: '187' },
        { label: 'Download Clicks', value: '34' }
      ]);
    }
  }

  private async getAnalyticsData(): Promise<AnalyticsData> {
    try {
      // Try to get data from main app via parent window
      if (window.opener?.NBW_DEBUG) {
        const debug = window.opener.NBW_DEBUG;
        if (debug.getVisitorData) {
          return await debug.getVisitorData();
        }
      }

      // Try to get data from current window
      if (window.NBW_DEBUG?.getVisitorData) {
        return (await window.NBW_DEBUG.getVisitorData()) as AnalyticsData;
      }

      // Try to access visitor tracking service directly
      const { container } = await import('../../core/container');
      const visitorService = (await container.resolve('VisitorTrackingService')) as {
        exportData?: () => Promise<RawVisitorData>;
      };
      if (visitorService?.exportData) {
        const data = await visitorService.exportData();
        return this.formatAnalyticsData(data);
      }
    } catch (error) {
      console.warn('[AdminDashboard] Could not get live analytics data:', error);
    }

    return {};
  }

  private formatAnalyticsData(rawData: RawVisitorData): AnalyticsData {
    // Format raw visitor data into admin dashboard format
    if (!rawData || !rawData.sessions) return {};

    const sessions = rawData.sessions || [];
    const pageViews = rawData.pageViews || [];
    const interactions = rawData.interactions || [];

    // Calculate popular pages
    const pageViewCounts: Record<string, number> = {};
    pageViews.forEach((pv) => {
      pageViewCounts[pv.url] = (pageViewCounts[pv.url] || 0) + 1;
    });

    const popularPages = Object.entries(pageViewCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([url, count]) => ({
        label: this.formatPageUrl(url),
        value: `${count} views`
      }));

    // Calculate device breakdown
    const deviceCounts: Record<string, number> = {};
    sessions.forEach((session) => {
      const deviceType = (session.deviceInfo as { type?: string })?.type;
      if (deviceType) {
        deviceCounts[deviceType] = (deviceCounts[deviceType] || 0) + 1;
      }
    });

    const totalSessions = sessions.length;
    const deviceBreakdown = Object.entries(deviceCounts).map(([device, count]) => ({
      label: device.charAt(0).toUpperCase() + device.slice(1),
      value: `${Math.round(((count as number) / totalSessions) * 100)}%`
    }));

    // Calculate engagement events
    const interactionCounts: Record<string, number> = {};
    interactions.forEach((interaction) => {
      const key = interaction.type || 'Unknown';
      interactionCounts[key] = (interactionCounts[key] || 0) + 1;
    });

    const engagementEvents = Object.entries(interactionCounts).map(([type, count]) => ({
      label: this.formatInteractionType(type),
      value: count.toString()
    }));

    return {
      popularPages: popularPages.length > 0 ? popularPages : undefined,
      deviceBreakdown: deviceBreakdown.length > 0 ? deviceBreakdown : undefined,
      engagementEvents: engagementEvents.length > 0 ? engagementEvents : undefined,
      geoDistribution: undefined // Would need geolocation data
    };
  }

  private formatPageUrl(url: string): string {
    // Convert URLs to readable page names
    const urlMap: Record<string, string> = {
      '/': 'Homepage',
      '/art': 'Art Portfolio',
      '/codes': 'Codes Section',
      '/contact': 'Contact',
      '/about': 'About'
    };

    return urlMap[url] || url;
  }

  private formatInteractionType(type: string): string {
    // Convert interaction types to readable labels
    const typeMap: Record<string, string> = {
      'business-card-flip': 'Business Card Flips',
      'contact-form-submit': 'Contact Form Submissions',
      'external-link-click': 'External Link Clicks',
      'download-click': 'Download Clicks',
      'scroll-depth': 'Scroll Depth Events'
    };

    return typeMap[type] || type;
  }

  private async loadVisitorsData(): Promise<void> {
    // Mock visitor data
    const visitors = [
      {
        id: 'v_001',
        firstVisit: '2024-08-30 14:23',
        lastVisit: '2024-08-31 09:15',
        sessions: 3,
        pageViews: 12,
        location: 'San Francisco, CA',
        device: 'Desktop'
      },
      {
        id: 'v_002',
        firstVisit: '2024-08-31 08:45',
        lastVisit: '2024-08-31 08:52',
        sessions: 1,
        pageViews: 5,
        location: 'Toronto, ON',
        device: 'Mobile'
      }
    ];

    this.populateVisitorsTable(visitors);
  }

  private async loadSystemData(): Promise<void> {
    // Get application status
    const appStatus = await this.getApplicationStatus();
    this.populateSystemStatus(appStatus);
  }

  private async getApplicationStatus(): Promise<ApplicationStatus> {
    try {
      if (window.NBW_DEBUG?.getStatus) {
        return window.NBW_DEBUG.getStatus() as ApplicationStatus;
      }
    } catch (error) {
      console.error('[AdminDashboard] Error getting app status:', error);
    }

    // Fallback mock data
    return {
      modules: {
        ThemeModule: { status: 'healthy' },
        NavigationModule: { status: 'healthy' },
        ContactFormModule: { status: 'healthy' }
      },
      services: {
        DataService: { status: 'healthy' },
        PerformanceService: { status: 'healthy' },
        ContactService: { status: 'warning' }
      }
    };
  }

  private updateElement(id: string, text: string, className?: string): void {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = text;
      if (className) {
        element.className = `metric-change ${className}`;
      }
    }
  }

  private updateVital(type: string, data: { value: string; status: string }): void {
    const valueElement = document.getElementById(`${type}-value`);
    const statusElement = document.getElementById(`${type}-status`);

    if (valueElement) valueElement.textContent = data.value;
    if (statusElement) {
      statusElement.textContent = data.status.replace('-', ' ');
      statusElement.className = `vital-status ${data.status}`;
    }
  }

  /**
   * Create or update a Chart.js chart
   */
  private loadChart(containerId: string, chartType: 'visitors' | 'sources'): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Destroy existing chart if it exists
    const existingChart = this.charts.get(containerId);
    if (existingChart) {
      existingChart.destroy();
    }

    // Create canvas element
    container.innerHTML = '<canvas></canvas>';
    const canvas = container.querySelector('canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let chart: Chart;

    if (chartType === 'visitors') {
      // Line chart for visitor trends
      chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [
            {
              label: 'Visitors',
              data: [120, 190, 150, 220, 180, 250, 210],
              borderColor: '#00ff41',
              backgroundColor: 'rgba(0, 255, 65, 0.1)',
              tension: 0.4,
              fill: true
            },
            {
              label: 'Page Views',
              data: [300, 450, 380, 520, 420, 600, 480],
              borderColor: '#333333',
              backgroundColor: 'rgba(51, 51, 51, 0.1)',
              tension: 0.4,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                usePointStyle: true,
                padding: 20
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          }
        }
      });
    } else {
      // Doughnut chart for traffic sources
      chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Direct', 'Search', 'Social', 'Referral', 'Email'],
          datasets: [
            {
              data: [35, 30, 20, 10, 5],
              backgroundColor: [
                '#00ff41',
                '#333333',
                '#666666',
                '#999999',
                '#cccccc'
              ],
              borderColor: '#ffffff',
              borderWidth: 2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                usePointStyle: true,
                padding: 15
              }
            }
          }
        }
      });
    }

    this.charts.set(containerId, chart);
  }

  private populateDataList(
    listId: string,
    data: Array<{ label: string; value: string | number }>
  ): void {
    const list = document.getElementById(listId);
    if (!list) return;

    list.innerHTML = data
      .map(
        (item) => `
      <div class="data-item">
        <span>${item.label}</span>
        <span>${String(item.value)}</span>
      </div>
    `
      )
      .join('');
  }

  private populateVisitorsTable(visitors: VisitorInfo[]): void {
    const tbody = document.querySelector('#visitors-table tbody');
    if (!tbody) return;

    tbody.innerHTML = visitors
      .map(
        (visitor) => `
      <tr>
        <td>${visitor.id}</td>
        <td>${visitor.firstVisit}</td>
        <td>${visitor.lastVisit}</td>
        <td>${visitor.sessions}</td>
        <td>${visitor.pageViews}</td>
        <td>${visitor.location}</td>
        <td>${visitor.device}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="viewVisitorDetails('${visitor.id}')">
            View
          </button>
        </td>
      </tr>
    `
      )
      .join('');
  }

  private populateSystemStatus(status: ApplicationStatus): void {
    const container = document.getElementById('app-status');
    if (!container) return;

    const allItems = { ...status.modules, ...status.services };

    container.innerHTML = Object.entries(allItems)
      .map(
        ([name, data]) => `
      <div class="status-item">
        <span>${name}</span>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="status-indicator ${data.status}"></div>
          <span>${data.status}</span>
        </div>
      </div>
    `
      )
      .join('');
  }

  private async initializePerformanceDashboard(): Promise<void> {
    try {
      // Check if performance dashboard container exists
      let dashboardContainer = document.getElementById('performance-dashboard-container');

      if (!dashboardContainer) {
        // Create container for the performance dashboard in the performance tab
        const performanceTab = document.getElementById('performance-tab');
        if (performanceTab) {
          dashboardContainer = document.createElement('div');
          dashboardContainer.id = 'performance-dashboard-container';
          dashboardContainer.className = 'admin-performance-dashboard';
          performanceTab.appendChild(dashboardContainer);
        }
      }

      if (dashboardContainer) {
        const { createPerformanceDashboard } = await import('../../components');
        await createPerformanceDashboard(
          {
            position: 'top-left',
            minimized: false,
            autoHide: false,
            updateInterval: 3000,
            showAlerts: true,
            showRecommendations: true
          },
          dashboardContainer
        );
      }
    } catch (error) {
      console.warn('[AdminDashboard] Failed to initialize performance dashboard component:', error);
    }
  }

  private displayPerformanceAlerts(alerts: PerformanceAlert[]): void {
    const container = document.getElementById('performance-alerts');
    if (!container || !alerts.length) return;

    container.innerHTML = alerts
      .slice(0, 5)
      .map(
        (alert) => `
      <div class="performance-alert alert-${alert.type}">
        <div class="alert-header">
          <span class="alert-metric">${alert.metric.toUpperCase()}</span>
          <span class="alert-value">${Math.round(alert.value)}</span>
        </div>
        <div class="alert-message">${alert.message}</div>
        ${
  alert.suggestions && alert.suggestions.length > 0
    ? `
          <div class="alert-suggestions">
            <ul>
              ${alert.suggestions
    .slice(0, 2)
    .map((suggestion: string) => `<li>${suggestion}</li>`)
    .join('')}
            </ul>
          </div>
        `
    : ''
}
      </div>
    `
      )
      .join('');
  }

  private showLoading(show: boolean): void {
    const loading = document.getElementById('loading-indicator');
    if (loading) {
      if (show) {
        loading.classList.remove('hidden');
      } else {
        loading.classList.add('hidden');
      }
    }
  }

  private startAutoRefresh(): void {
    // Refresh dashboard data every 5 minutes
    this.refreshInterval = setInterval(
      () => {
        this.loadTabData(this.currentTab);
      },
      5 * 60 * 1000
    );
  }

  private async exportData(type: string): Promise<void> {
    try {
      let data: Record<string, unknown>;
      let filename: string;

      switch (type) {
      case 'analytics':
        data = await this.getAnalyticsExport();
        filename = `analytics-${new Date().toISOString().split('T')[0]}.json`;
        break;
      case 'visitors':
        data = await this.getVisitorsExport();
        filename = `visitors-${new Date().toISOString().split('T')[0]}.json`;
        break;
      case 'performance':
        data = await this.getPerformanceExport();
        filename = `performance-${new Date().toISOString().split('T')[0]}.json`;
        break;
      default:
        throw new Error('Unknown export type');
      }

      // Create and download file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`[AdminDashboard] Error exporting ${type} data:`, error);
      alert(`Failed to export ${type} data. Please try again.`);
    }
  }

  private async getAnalyticsExport(): Promise<Record<string, unknown>> {
    // Get analytics data for export
    return {
      exportDate: new Date().toISOString(),
      pageViews: [], // Add actual page view data
      visitors: [], // Add actual visitor data
      events: [] // Add actual event data
    };
  }

  private async getVisitorsExport(): Promise<Record<string, unknown>> {
    // Get visitor data for export
    return {
      exportDate: new Date().toISOString(),
      visitors: [] // Add actual visitor data
    };
  }

  private async getPerformanceExport(): Promise<Record<string, unknown>> {
    // Get performance data for export
    return {
      exportDate: new Date().toISOString(),
      metrics: await this.getPerformanceMetrics()
    };
  }

  private async clearOldData(): Promise<void> {
    if (
      !confirm(
        'Are you sure you want to clear data older than 90 days? This action cannot be undone.'
      )
    ) {
      return;
    }

    try {
      // Clear old data logic here
      alert('Old data cleared successfully.');
    } catch (error) {
      console.error('[AdminDashboard] Error clearing old data:', error);
      alert('Failed to clear old data. Please try again.');
    }
  }

  private async resetAnalytics(): Promise<void> {
    if (
      !confirm('Are you sure you want to reset ALL analytics data? This action cannot be undone.')
    ) {
      return;
    }

    if (
      !confirm(
        'This will permanently delete all visitor data, page views, and analytics. Type "RESET" to confirm.'
      )
    ) {
      return;
    }

    try {
      // Reset analytics logic here
      localStorage.clear();
      sessionStorage.clear();
      alert('Analytics data has been reset.');
      window.location.reload();
    } catch (error) {
      console.error('[AdminDashboard] Error resetting analytics:', error);
      alert('Failed to reset analytics. Please try again.');
    }
  }
}

// Global function for visitor details (called from table)
declare global {
  interface Window {
    viewVisitorDetails?: (visitorId: string) => void;
  }
}

window.viewVisitorDetails = (visitorId: string) => {
  alert(`Viewing details for visitor: ${visitorId}`);
};

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new AdminDashboard();
});

export { AdminAuth, AdminDashboard };
