/**
 * ===============================================
 * VISITOR TRACKING SERVICE
 * ===============================================
 * @file src/services/visitor-tracking.ts
 *
 * Privacy-compliant visitor tracking and analytics service.
 * Tracks user interactions, page views, and engagement metrics.
 */

export interface VisitorSession {
  sessionId: string;
  visitorId: string;
  startTime: number;
  lastActivity: number;
  pageViews: number;
  totalTimeOnSite: number;
  bounced: boolean;
  referrer: string;
  userAgent: string;
  screenResolution: string;
  language: string;
  timezone: string;
}

export interface PageView {
  sessionId: string;
  url: string;
  title: string;
  timestamp: number;
  timeOnPage?: number;
  scrollDepth: number;
  interactions: number;
}

export interface InteractionEvent {
  sessionId: string;
  type: 'click' | 'scroll' | 'hover' | 'form' | 'download' | 'external_link' | 'business_card' | 'navigation' | 'contact';
  element: string;
  timestamp: number;
  data?: Record<string, any>;
  url: string;
}

export interface EngagementMetrics {
  averageTimeOnSite: number;
  bounceRate: number;
  pagesPerSession: number;
  topPages: Array<{ url: string; views: number; avgTime: number }>;
  topInteractions: Array<{ type: string; element: string; count: number }>;
  deviceTypes: Record<string, number>;
  referrers: Record<string, number>;
}

export interface VisitorTrackingConfig {
  enableTracking: boolean;
  respectDoNotTrack: boolean;
  cookieConsent: boolean;
  sessionTimeout: number; // minutes
  trackScrollDepth: boolean;
  trackClicks: boolean;
  trackBusinessCardInteractions: boolean;
  trackFormSubmissions: boolean;
  trackDownloads: boolean;
  trackExternalLinks: boolean;
  endpoint?: string; // For sending data to analytics backend
  batchSize: number;
  flushInterval: number; // seconds
}

export class VisitorTrackingService {
  private config: VisitorTrackingConfig;
  private currentSession: VisitorSession | null = null;
  private currentPageView: PageView | null = null;
  private eventQueue: (PageView | InteractionEvent)[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isTracking = false;
  private scrollDepth = 0;
  private pageInteractions = 0;
  private pageStartTime = 0;

  constructor(config: Partial<VisitorTrackingConfig> = {}) {
    this.config = {
      enableTracking: true,
      respectDoNotTrack: true,
      cookieConsent: true,
      sessionTimeout: 30, // 30 minutes
      trackScrollDepth: true,
      trackClicks: true,
      trackBusinessCardInteractions: true,
      trackFormSubmissions: true,
      trackDownloads: true,
      trackExternalLinks: true,
      batchSize: 10,
      flushInterval: 30, // 30 seconds
      ...config
    };
  }

  /**
   * Initialize visitor tracking
   */
  async init(): Promise<void> {
    if (!this.shouldTrack()) {
      console.log('[VisitorTracking] Tracking disabled due to privacy settings');
      return;
    }

    this.isTracking = true;
    await this.initializeSession();
    this.setupEventListeners();
    this.trackPageView();
    this.startFlushTimer();

    console.log('[VisitorTracking] Initialized with session:', this.currentSession?.sessionId);
  }

  /**
   * Check if tracking should be enabled
   */
  private shouldTrack(): boolean {
    if (!this.config.enableTracking) return false;

    // Respect Do Not Track header
    if (this.config.respectDoNotTrack && navigator.doNotTrack === '1') {
      return false;
    }

    // Check for cookie consent if required
    if (this.config.cookieConsent && !this.hasConsentCookie()) {
      return false;
    }

    return true;
  }

  /**
   * Check for consent cookie
   */
  private hasConsentCookie(): boolean {
    return document.cookie.includes('tracking_consent=true');
  }

  /**
   * Initialize or resume visitor session
   */
  private async initializeSession(): Promise<void> {
    const visitorId = this.getOrCreateVisitorId();
    const sessionId = this.getOrCreateSessionId();
    const now = Date.now();

    // Try to resume existing session
    const existingSession = this.getStoredSession();
    if (existingSession && this.isSessionValid(existingSession)) {
      this.currentSession = existingSession;
      this.currentSession.lastActivity = now;
      this.currentSession.pageViews++;
    } else {
      // Create new session
      this.currentSession = {
        sessionId,
        visitorId,
        startTime: now,
        lastActivity: now,
        pageViews: 1,
        totalTimeOnSite: 0,
        bounced: true, // Will be set to false on second page view or interaction
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
    }

    this.storeSession();
  }

  /**
   * Get or create visitor ID
   */
  private getOrCreateVisitorId(): string {
    const stored = localStorage.getItem('nbw_visitor_id');
    if (stored) return stored;

    const visitorId = this.generateId();
    localStorage.setItem('nbw_visitor_id', visitorId);
    return visitorId;
  }

  /**
   * Get or create session ID
   */
  private getOrCreateSessionId(): string {
    const stored = sessionStorage.getItem('nbw_session_id');
    if (stored) return stored;

    const sessionId = this.generateId();
    sessionStorage.setItem('nbw_session_id', sessionId);
    return sessionId;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Get stored session from sessionStorage
   */
  private getStoredSession(): VisitorSession | null {
    try {
      const stored = sessionStorage.getItem('nbw_session');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Store current session
   */
  private storeSession(): void {
    if (this.currentSession) {
      sessionStorage.setItem('nbw_session', JSON.stringify(this.currentSession));
    }
  }

  /**
   * Check if session is still valid
   */
  private isSessionValid(session: VisitorSession): boolean {
    const now = Date.now();
    const timeoutMs = this.config.sessionTimeout * 60 * 1000;
    return (now - session.lastActivity) < timeoutMs;
  }

  /**
   * Setup event listeners for tracking
   */
  private setupEventListeners(): void {
    if (this.config.trackScrollDepth) {
      this.addEventListener(window, 'scroll', this.handleScroll.bind(this));
    }

    if (this.config.trackClicks) {
      this.addEventListener(document, 'click', this.handleClick.bind(this) as EventListener);
    }

    // Track page visibility changes
    this.addEventListener(document, 'visibilitychange', this.handleVisibilityChange.bind(this));

    // Track page unload
    this.addEventListener(window, 'beforeunload', this.handlePageUnload.bind(this));

    // Track business card interactions
    if (this.config.trackBusinessCardInteractions) {
      this.setupBusinessCardTracking();
    }

    // Track form submissions
    if (this.config.trackFormSubmissions) {
      this.addEventListener(document, 'submit', this.handleFormSubmit.bind(this));
    }
  }

  /**
   * Add event listener with cleanup tracking
   */
  private addEventListener(target: EventTarget, event: string, handler: EventListener): void {
    target.addEventListener(event, handler, { passive: true });
  }

  /**
   * Track page view
   */
  private trackPageView(): void {
    if (!this.currentSession) return;

    // Complete previous page view
    if (this.currentPageView) {
      this.completePageView();
    }

    // Start new page view
    this.pageStartTime = Date.now();
    this.scrollDepth = 0;
    this.pageInteractions = 0;

    this.currentPageView = {
      sessionId: this.currentSession.sessionId,
      url: window.location.href,
      title: document.title,
      timestamp: this.pageStartTime,
      scrollDepth: 0,
      interactions: 0
    };

    this.queueEvent(this.currentPageView);
  }

  /**
   * Complete current page view
   */
  private completePageView(): void {
    if (!this.currentPageView || !this.currentSession) return;

    const timeOnPage = Date.now() - this.pageStartTime;
    this.currentPageView.timeOnPage = timeOnPage;
    this.currentPageView.scrollDepth = this.scrollDepth;
    this.currentPageView.interactions = this.pageInteractions;

    // Update session totals
    this.currentSession.totalTimeOnSite += timeOnPage;
    this.currentSession.lastActivity = Date.now();

    // No longer bounced if spent significant time or had interactions
    if (timeOnPage > 5000 || this.pageInteractions > 2) {
      this.currentSession.bounced = false;
    }

    this.storeSession();
  }

  /**
   * Handle scroll events
   */
  private handleScroll = (): void => {
    const scrollPercent = Math.round(
      (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
    );

    if (scrollPercent > this.scrollDepth) {
      this.scrollDepth = Math.min(scrollPercent, 100);

      // Track scroll milestones
      if (scrollPercent >= 25 && this.scrollDepth < 25) {
        this.trackInteraction('scroll', 'page', { depth: '25%' });
      } else if (scrollPercent >= 50 && this.scrollDepth < 50) {
        this.trackInteraction('scroll', 'page', { depth: '50%' });
      } else if (scrollPercent >= 75 && this.scrollDepth < 75) {
        this.trackInteraction('scroll', 'page', { depth: '75%' });
      } else if (scrollPercent >= 100 && this.scrollDepth < 100) {
        this.trackInteraction('scroll', 'page', { depth: '100%' });
      }
    }
  };

  /**
   * Handle click events
   */
  private handleClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    if (!target) return;

    let elementDescription = target.tagName.toLowerCase();

    // Add more specific descriptions
    if (target.id) {
      elementDescription += `#${target.id}`;
    } else if (target.className) {
      elementDescription += `.${target.className.split(' ')[0]}`;
    }

    // Track external links
    if (target.tagName === 'A' && this.config.trackExternalLinks) {
      const { href } = (target as HTMLAnchorElement);
      if (href && !href.includes(window.location.hostname)) {
        this.trackInteraction('external_link', elementDescription, { url: href });
      }
    }

    // Track downloads
    if (this.config.trackDownloads && target.tagName === 'A') {
      const { href } = (target as HTMLAnchorElement);
      const downloadExtensions = ['.pdf', '.zip', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
      if (href && downloadExtensions.some(ext => href.includes(ext))) {
        this.trackInteraction('download', elementDescription, { file: href });
      }
    }

    this.trackInteraction('click', elementDescription);
    this.pageInteractions++;
  };

  /**
   * Setup business card specific tracking
   */
  private setupBusinessCardTracking(): void {
    // Wait for business card elements to be available
    setTimeout(() => {
      const businessCard = document.getElementById('business-card');
      if (businessCard) {
        this.addEventListener(businessCard, 'click', () => {
          this.trackInteraction('business_card', 'card_click', { action: 'flip' });
        });
      }

      // Track navigation interactions
      const navButtons = document.querySelectorAll('.nav-btn, .navigation button');
      navButtons.forEach(btn => {
        this.addEventListener(btn, 'click', () => {
          const text = btn.textContent?.trim() || 'unknown';
          this.trackInteraction('navigation', `nav_${text.toLowerCase()}`);
        });
      });

      // Track contact form interactions
      const contactForm = document.querySelector('.contact-form, form');
      if (contactForm) {
        this.addEventListener(contactForm, 'focus', (e) => {
          const target = e.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
            this.trackInteraction('form', `focus_${target.getAttribute('name') || 'field'}`);
          }
        });
      }
    }, 1000);
  }

  /**
   * Handle form submissions
   */
  private handleFormSubmit = (event: Event): void => {
    const form = event.target as HTMLFormElement;
    const formName = form.id || form.className || 'unknown_form';

    this.trackInteraction('form', `submit_${formName}`);

    // Mark session as not bounced
    if (this.currentSession) {
      this.currentSession.bounced = false;
    }
  };

  /**
   * Handle visibility change
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.completePageView();
      this.flush(); // Send data immediately when page becomes hidden
    } else if (document.visibilityState === 'visible') {
      this.trackPageView(); // Start new page view when returning
    }
  };

  /**
   * Handle page unload
   */
  private handlePageUnload = (): void => {
    this.completePageView();
    this.flush();
  };

  /**
   * Track interaction event
   */
  private trackInteraction(
    type: InteractionEvent['type'],
    element: string,
    data?: Record<string, any>
  ): void {
    if (!this.currentSession) return;

    const event: InteractionEvent = {
      sessionId: this.currentSession.sessionId,
      type,
      element,
      timestamp: Date.now(),
      data: data || {},
      url: window.location.href
    };

    this.queueEvent(event);

    // Update session activity
    this.currentSession.lastActivity = Date.now();
    this.storeSession();
  }

  /**
   * Queue event for batch processing
   */
  private queueEvent(event: PageView | InteractionEvent): void {
    this.eventQueue.push(event);

    // Flush immediately if queue is full
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval * 1000);
  }

  /**
   * Flush queued events
   */
  private flush(): void {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    // Log events to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[VisitorTracking] Flushing events:', events);
    }

    // Send to analytics endpoint if configured
    if (this.config.endpoint) {
      this.sendToEndpoint(events);
    }

    // Store locally for debugging/analysis
    this.storeEventsLocally(events);
  }

  /**
   * Send events to analytics endpoint
   */
  private async sendToEndpoint(events: (PageView | InteractionEvent)[]): Promise<void> {
    if (!this.config.endpoint) return;

    try {
      await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session: this.currentSession,
          events
        })
      });
    } catch (error) {
      console.warn('[VisitorTracking] Failed to send events:', error);
      // Re-queue events for retry
      this.eventQueue.unshift(...events);
    }
  }

  /**
   * Store events locally for analysis
   */
  private storeEventsLocally(events: (PageView | InteractionEvent)[]): void {
    try {
      const existing = JSON.parse(localStorage.getItem('nbw_tracking_events') || '[]');
      const updated = [...existing, ...events];

      // Keep only last 1000 events to prevent localStorage bloat
      const trimmed = updated.slice(-1000);

      localStorage.setItem('nbw_tracking_events', JSON.stringify(trimmed));
    } catch (error) {
      console.warn('[VisitorTracking] Failed to store events locally:', error);
    }
  }

  /**
   * Get engagement metrics
   */
  getEngagementMetrics(): EngagementMetrics {
    const events = this.getStoredEvents();
    const pageViews = events.filter(e => 'title' in e) as PageView[];
    const interactions = events.filter(e => 'type' in e) as InteractionEvent[];

    // Calculate metrics
    const totalSessions = new Set(pageViews.map(pv => pv.sessionId)).size;
    const totalPageViews = pageViews.length;
    const totalTimeOnSite = pageViews.reduce((sum, pv) => sum + (pv.timeOnPage || 0), 0);

    const bounceRate = totalSessions > 0 ?
      (pageViews.filter(pv => pv.interactions === 0 && (pv.timeOnPage || 0) < 5000).length / totalSessions) * 100 : 0;

    // Top pages
    const pageStats = new Map<string, { views: number; totalTime: number }>();
    pageViews.forEach(pv => {
      const existing = pageStats.get(pv.url) || { views: 0, totalTime: 0 };
      pageStats.set(pv.url, {
        views: existing.views + 1,
        totalTime: existing.totalTime + (pv.timeOnPage || 0)
      });
    });

    const topPages = Array.from(pageStats.entries())
      .map(([url, stats]) => ({
        url,
        views: stats.views,
        avgTime: stats.totalTime / stats.views
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    // Top interactions
    const interactionStats = new Map<string, number>();
    interactions.forEach(interaction => {
      const key = `${interaction.type}:${interaction.element}`;
      interactionStats.set(key, (interactionStats.get(key) || 0) + 1);
    });

    const topInteractions = Array.from(interactionStats.entries())
      .map(([key, count]) => {
        const [type, element] = key.split(':');
        return { type: type || '', element: element || '', count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      averageTimeOnSite: totalSessions > 0 ? totalTimeOnSite / totalSessions : 0,
      bounceRate,
      pagesPerSession: totalSessions > 0 ? totalPageViews / totalSessions : 0,
      topPages,
      topInteractions,
      deviceTypes: { desktop: 0, mobile: 0, tablet: 0 }, // Would need user agent parsing
      referrers: {} // Would need referrer analysis
    };
  }

  /**
   * Get stored events from localStorage
   */
  private getStoredEvents(): (PageView | InteractionEvent)[] {
    try {
      return JSON.parse(localStorage.getItem('nbw_tracking_events') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Get current session info
   */
  getCurrentSession(): VisitorSession | null {
    return this.currentSession;
  }

  /**
   * Enable/disable tracking
   */
  setTrackingEnabled(enabled: boolean): void {
    this.config.enableTracking = enabled;

    if (enabled && !this.isTracking) {
      this.init();
    } else if (!enabled && this.isTracking) {
      this.stop();
    }
  }

  /**
   * Stop tracking and clean up
   */
  stop(): void {
    if (!this.isTracking) return;

    this.completePageView();
    this.flush();

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    this.isTracking = false;
    console.log('[VisitorTracking] Stopped');
  }

  /**
   * Clear all tracking data
   */
  clearData(): void {
    localStorage.removeItem('nbw_visitor_id');
    localStorage.removeItem('nbw_tracking_events');
    sessionStorage.removeItem('nbw_session_id');
    sessionStorage.removeItem('nbw_session');

    this.currentSession = null;
    this.currentPageView = null;
    this.eventQueue = [];
  }

  /**
   * Export tracking data
   */
  exportData(): {
    session: VisitorSession | null;
    events: (PageView | InteractionEvent)[];
    metrics: EngagementMetrics;
    } {
    return {
      session: this.currentSession,
      events: this.getStoredEvents(),
      metrics: this.getEngagementMetrics()
    };
  }
}