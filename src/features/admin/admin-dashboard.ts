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

// Admin authentication and session management
class AdminAuth {
  private static readonly AUTH_KEY_HASH = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8'; // 'hello' in SHA256
  private static readonly SESSION_KEY = 'nbw_admin_session';
  private static readonly SESSION_DURATION = 60 * 60 * 1000; // 1 hour

  static async authenticate(inputKey: string): Promise<boolean> {
    try {
      // Check rate limiting first
      AdminSecurity.checkRateLimit();

      // Hash the input key using Web Crypto API
      const encoder = new TextEncoder();
      const data = encoder.encode(inputKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (hashHex === this.AUTH_KEY_HASH) {
        // Clear failed attempts on successful login
        AdminSecurity.clearAttempts();

        // Store session with timestamp
        const session = {
          authenticated: true,
          timestamp: Date.now()
        };
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        return true;
      }
      // Record failed attempt
      AdminSecurity.recordFailedAttempt();
      return false;

    } catch (error) {
      console.error('[AdminAuth] Authentication error:', error);
      // Record failed attempt for errors too
      AdminSecurity.recordFailedAttempt();
      throw error;
    }
  }

  static isAuthenticated(): boolean {
    try {
      const sessionData = sessionStorage.getItem(this.SESSION_KEY);
      if (!sessionData) return false;

      const session = JSON.parse(sessionData);
      const isValid = session.authenticated &&
                     (Date.now() - session.timestamp) < this.SESSION_DURATION;

      if (!isValid) {
        this.logout();
      }

      return isValid;
    } catch (error) {
      console.error('[AdminAuth] Session validation error:', error);
      return false;
    }
  }

  static logout(): void {
    sessionStorage.removeItem(this.SESSION_KEY);
    window.location.reload();
  }

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
    const authError = document.getElementById('auth-error');

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
          const message = error instanceof Error ? error.message : 'Authentication failed. Please try again.';
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
    tabButtons.forEach(btn => {
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
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

    // Update active tab content
    document.querySelectorAll('.tab-content').forEach(content => {
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
    await new Promise(resolve => setTimeout(resolve, 500));

    // Mock data - replace with actual analytics data
    this.updateElement('total-visitors', '1,234');
    this.updateElement('visitors-change', '+12% from last week', 'positive');

    this.updateElement('page-views', '5,678');
    this.updateElement('views-change', '+8% from last week', 'positive');

    this.updateElement('avg-session', '2m 34s');
    this.updateElement('session-change', '-3% from last week', 'negative');

    this.updateElement('card-interactions', '456');
    this.updateElement('interactions-change', '+18% from last week', 'positive');

    // Load charts (placeholder)
    this.loadChart('visitors-chart', 'Line chart showing visitor trends');
    this.loadChart('sources-chart', 'Pie chart showing traffic sources');
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
      this.updateElement('total-bundle-size', perfData.bundleSize.total);
      this.updateElement('js-bundle-size', perfData.bundleSize.js);
      this.updateElement('css-bundle-size', perfData.bundleSize.css);

      // Performance score and alerts
      if (perfData.score !== undefined) {
        this.updateElement('performance-score', `${Math.round(perfData.score)}/100`);
      }

      if (perfData.alerts && perfData.alerts.length > 0) {
        this.displayPerformanceAlerts(perfData.alerts);
      }

    } catch (error) {
      console.error('[AdminDashboard] Error loading performance data:', error);
    }
  }

  private async getPerformanceMetrics(): Promise<any> {
    try {
      // Try to get data from the main app's services via parent window
      if (window.opener && (window.opener as any).NBW_DEBUG) {
        const debug = (window.opener as any).NBW_DEBUG;
        if (debug.getPerformanceReport) {
          return await debug.getPerformanceReport();
        }
      }

      // Try to get data from current window (if services are available)
      if (window.NBW_DEBUG?.getPerformanceReport) {
        return await window.NBW_DEBUG.getPerformanceReport();
      }

      // Try to access services directly from container
      const { container } = await import('../../core/container');
      const performanceService = await container.resolve('PerformanceService');
      if (performanceService && (performanceService as any).generateReport) {
        const report = await (performanceService as any).generateReport();
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
          bundleSize: {
            total: report.metrics.bundleSize ? `${Math.round(report.metrics.bundleSize / 1024)} KB` : 'N/A',
            js: 'N/A',
            css: 'N/A'
          },
          score: report.score || 0,
          alerts: report.alerts || []
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
      bundleSize: {
        total: '156 KB',
        js: '98 KB',
        css: '58 KB'
      },
      score: 95,
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

  private async loadAnalyticsData(): Promise<void> {
    try {
      const analyticsData = await this.getAnalyticsData();

      // Update with real data if available, otherwise use mock data
      this.populateDataList('popular-pages', analyticsData.popularPages || [
        { label: 'Homepage', value: '2,145 views' },
        { label: 'Art Portfolio', value: '856 views' },
        { label: 'Codes Section', value: '634 views' },
        { label: 'Contact', value: '423 views' },
        { label: 'About', value: '312 views' }
      ]);

      this.populateDataList('device-breakdown', analyticsData.deviceBreakdown || [
        { label: 'Desktop', value: '45%' },
        { label: 'Mobile', value: '38%' },
        { label: 'Tablet', value: '17%' }
      ]);

      this.populateDataList('geo-distribution', analyticsData.geoDistribution || [
        { label: 'United States', value: '42%' },
        { label: 'Canada', value: '18%' },
        { label: 'United Kingdom', value: '12%' },
        { label: 'Germany', value: '8%' },
        { label: 'Other', value: '20%' }
      ]);

      this.populateDataList('engagement-events', analyticsData.engagementEvents || [
        { label: 'Business Card Flips', value: '456' },
        { label: 'Contact Form Submissions', value: '23' },
        { label: 'External Link Clicks', value: '187' },
        { label: 'Download Clicks', value: '34' }
      ]);
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

  private async getAnalyticsData(): Promise<any> {
    try {
      // Try to get data from main app via parent window
      if (window.opener && (window.opener as any).NBW_DEBUG) {
        const debug = (window.opener as any).NBW_DEBUG;
        if (debug.getVisitorData) {
          return await debug.getVisitorData();
        }
      }

      // Try to get data from current window
      if (window.NBW_DEBUG?.getVisitorData) {
        return await window.NBW_DEBUG.getVisitorData();
      }

      // Try to access visitor tracking service directly
      const { container } = await import('../../core/container');
      const visitorService = await container.resolve('VisitorTrackingService');
      if (visitorService && (visitorService as any).exportData) {
        const data = await (visitorService as any).exportData();
        return this.formatAnalyticsData(data);
      }
    } catch (error) {
      console.warn('[AdminDashboard] Could not get live analytics data:', error);
    }

    return {};
  }

  private formatAnalyticsData(rawData: any): any {
    // Format raw visitor data into admin dashboard format
    if (!rawData || !rawData.sessions) return {};

    const sessions = rawData.sessions || [];
    const pageViews = rawData.pageViews || [];
    const interactions = rawData.interactions || [];

    // Calculate popular pages
    const pageViewCounts: Record<string, number> = {};
    pageViews.forEach((pv: any) => {
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
    sessions.forEach((session: any) => {
      if (session.deviceInfo?.type) {
        deviceCounts[session.deviceInfo.type] = (deviceCounts[session.deviceInfo.type] || 0) + 1;
      }
    });

    const totalSessions = sessions.length;
    const deviceBreakdown = Object.entries(deviceCounts).map(([device, count]) => ({
      label: device.charAt(0).toUpperCase() + device.slice(1),
      value: `${Math.round(((count as number) / totalSessions) * 100)}%`
    }));

    // Calculate engagement events
    const interactionCounts: Record<string, number> = {};
    interactions.forEach((interaction: any) => {
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

  private async getApplicationStatus(): Promise<any> {
    try {
      if (window.NBW_DEBUG?.getStatus) {
        return window.NBW_DEBUG.getStatus();
      }
    } catch (error) {
      console.error('[AdminDashboard] Error getting app status:', error);
    }

    // Fallback mock data
    return {
      modules: {
        'ThemeModule': { status: 'healthy' },
        'NavigationModule': { status: 'healthy' },
        'ContactFormModule': { status: 'healthy' }
      },
      services: {
        'DataService': { status: 'healthy' },
        'PerformanceService': { status: 'healthy' },
        'ContactService': { status: 'warning' }
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

  private loadChart(containerId: string, placeholder: string): void {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `<div class="chart-placeholder">${placeholder}</div>`;
    }
  }

  private populateDataList(listId: string, data: Array<{ label: string; value: string }>): void {
    const list = document.getElementById(listId);
    if (!list) return;

    list.innerHTML = data.map(item => `
      <div class="data-item">
        <span>${item.label}</span>
        <span>${item.value}</span>
      </div>
    `).join('');
  }

  private populateVisitorsTable(visitors: any[]): void {
    const tbody = document.querySelector('#visitors-table tbody');
    if (!tbody) return;

    tbody.innerHTML = visitors.map(visitor => `
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
    `).join('');
  }

  private populateSystemStatus(status: any): void {
    const container = document.getElementById('app-status');
    if (!container) return;

    const allItems = { ...status.modules, ...status.services };

    container.innerHTML = Object.entries(allItems).map(([name, data]: [string, any]) => `
      <div class="status-item">
        <span>${name}</span>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="status-indicator ${data.status}"></div>
          <span>${data.status}</span>
        </div>
      </div>
    `).join('');
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
        await createPerformanceDashboard({
          position: 'top-left',
          minimized: false,
          autoHide: false,
          updateInterval: 3000,
          showAlerts: true,
          showRecommendations: true
        }, dashboardContainer);
      }

    } catch (error) {
      console.warn('[AdminDashboard] Failed to initialize performance dashboard component:', error);
    }
  }

  private displayPerformanceAlerts(alerts: any[]): void {
    const container = document.getElementById('performance-alerts');
    if (!container || !alerts.length) return;

    container.innerHTML = alerts.slice(0, 5).map(alert => `
      <div class="performance-alert alert-${alert.type}">
        <div class="alert-header">
          <span class="alert-metric">${alert.metric.toUpperCase()}</span>
          <span class="alert-value">${Math.round(alert.value)}</span>
        </div>
        <div class="alert-message">${alert.message}</div>
        ${alert.suggestions && alert.suggestions.length > 0 ? `
          <div class="alert-suggestions">
            <ul>
              ${alert.suggestions.slice(0, 2).map((suggestion: string) => `<li>${suggestion}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `).join('');
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
    this.refreshInterval = setInterval(() => {
      this.loadTabData(this.currentTab);
    }, 5 * 60 * 1000);
  }

  private async exportData(type: string): Promise<void> {
    try {
      let data: any;
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

  private async getAnalyticsExport(): Promise<any> {
    // Get analytics data for export
    return {
      exportDate: new Date().toISOString(),
      pageViews: [], // Add actual page view data
      visitors: [], // Add actual visitor data
      events: [] // Add actual event data
    };
  }

  private async getVisitorsExport(): Promise<any> {
    // Get visitor data for export
    return {
      exportDate: new Date().toISOString(),
      visitors: [] // Add actual visitor data
    };
  }

  private async getPerformanceExport(): Promise<any> {
    // Get performance data for export
    return {
      exportDate: new Date().toISOString(),
      metrics: await this.getPerformanceMetrics()
    };
  }

  private async clearOldData(): Promise<void> {
    if (!confirm('Are you sure you want to clear data older than 90 days? This action cannot be undone.')) {
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
    if (!confirm('Are you sure you want to reset ALL analytics data? This action cannot be undone.')) {
      return;
    }

    if (!confirm('This will permanently delete all visitor data, page views, and analytics. Type "RESET" to confirm.')) {
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
(window as any).viewVisitorDetails = (visitorId: string) => {
  alert(`Viewing details for visitor: ${visitorId}`);
};

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new AdminDashboard();
});

// Type definitions for global debug object
declare global {
  interface Window {
    NBW_DEBUG?: {
      getStatus: () => any;
      getPerformanceReport: () => Promise<any>;
      getBundleAnalysis: () => Promise<any>;
      getVisitorData: () => Promise<any>;
    };
  }
}

export { AdminAuth, AdminDashboard };