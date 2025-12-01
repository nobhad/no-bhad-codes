/**
 * ===============================================
 * CONSENT BANNER COMPONENT
 * ===============================================
 * @file src/components/consent-banner.ts
 *
 * Privacy-compliant consent banner for visitor tracking.
 */

import { BaseComponent, type ComponentProps, type ComponentState } from './base-component';
import { ComponentUtils } from './component-store';

export interface ConsentBannerProps extends ComponentProps {
  position?: 'top' | 'bottom';
  theme?: 'light' | 'dark';
  showDetailsLink?: boolean;
  autoHide?: boolean;
  hideDelay?: number;
  companyName?: string;
  privacyPolicyUrl?: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onDetailsClick?: () => void;
}

export interface ConsentBannerState extends ComponentState {
  isVisible: boolean;
  showDetails: boolean;
  hasResponded: boolean;
}

export class ConsentBanner extends BaseComponent<ConsentBannerProps, ConsentBannerState> {
  private hideTimer: any = null;

  constructor(props: ConsentBannerProps) {
    const initialState: ConsentBannerState = {
      isVisible: !ConsentBanner.hasExistingConsent(),
      showDetails: false,
      hasResponded: ConsentBanner.hasExistingConsent()
    };

    super('ConsentBanner', props, initialState, { debug: true });

    this.template = {
      render: () => this.renderTemplate(),
      css: () => this.getStyles()
    };
  }

  /**
   * Check if user has already provided consent
   */
  static hasExistingConsent(): boolean {
    return document.cookie.includes('tracking_consent=');
  }

  /**
   * Get current consent status
   */
  static getConsentStatus(): 'accepted' | 'declined' | null {
    const match = document.cookie.match(/tracking_consent=([^;]+)/);
    return match ? (match[1] as 'accepted' | 'declined') : null;
  }

  override async mounted(): Promise<void> {
    // Auto-hide after delay if configured
    if (this.props.autoHide && this.state.isVisible) {
      const delay = this.props.hideDelay || 10000; // 10 seconds default
      this.hideTimer = setTimeout(() => {
        this.handleDecline();
      }, delay);
    }
  }

  private renderTemplate(): string {
    const {
      position = 'bottom',
      theme = 'light',
      showDetailsLink = true,
      companyName = 'This website',
      privacyPolicyUrl
    } = this.props;

    const { isVisible, showDetails } = this.state;

    if (!isVisible) {
      return '';
    }

    const positionClass = `consent-banner--${position}`;
    const themeClass = `consent-banner--${theme}`;

    return ComponentUtils.html`
      <div class="consent-banner ${positionClass} ${themeClass}" data-ref="banner">
        <div class="consent-banner__content">
          <div class="consent-banner__icon">
            🍪
          </div>
          
          <div class="consent-banner__text">
            <h3 class="consent-banner__title">We respect your privacy</h3>
            <p class="consent-banner__message">
              ${companyName} uses cookies and similar technologies to enhance your browsing experience, 
              analyze site traffic, and understand visitor behavior. Your privacy is important to us.
            </p>
            
            ${showDetails ? this.renderDetails() : ''}
          </div>
          
          <div class="consent-banner__actions">
            <div class="consent-banner__buttons">
              <button 
                class="consent-banner__btn consent-banner__btn--secondary" 
                data-ref="declineBtn"
              >
                Decline
              </button>
              <button 
                class="consent-banner__btn consent-banner__btn--primary" 
                data-ref="acceptBtn"
              >
                Accept All
              </button>
            </div>
            
            ${
  showDetailsLink
    ? `
              <div class="consent-banner__links">
                <button 
                  class="consent-banner__link" 
                  data-ref="detailsBtn"
                >
                  ${showDetails ? 'Hide Details' : 'Learn More'}
                </button>
                ${
  privacyPolicyUrl
    ? `
                  <a 
                    href="${privacyPolicyUrl}" 
                    class="consent-banner__link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Privacy Policy
                  </a>
                `
    : ''
}
              </div>
            `
    : ''
}
          </div>
        </div>
      </div>
    `;
  }

  private renderDetails(): string {
    return ComponentUtils.html`
      <div class="consent-banner__details">
        <h4>What we track:</h4>
        <ul>
          <li><strong>Page Views:</strong> Which pages you visit and how long you stay</li>
          <li><strong>Interactions:</strong> Buttons you click and forms you use</li>
          <li><strong>Performance:</strong> How fast our site loads for you</li>
          <li><strong>Technical Info:</strong> Your browser type and screen size</li>
        </ul>
        
        <h4>What we don't track:</h4>
        <ul>
          <li>Personal information without consent</li>
          <li>Your identity across other websites</li>
          <li>Sensitive personal data</li>
        </ul>
        
        <p class="consent-banner__note">
          You can change your mind anytime by clearing your browser cookies or 
          contacting us. Declining won't affect your ability to use our website.
        </p>
      </div>
    `;
  }

  private getStyles(): string {
    return ComponentUtils.css`
      .consent-banner {
        position: fixed;
        left: 0;
        right: 0;
        background: rgba(255, 255, 255, 0.98);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(0, 0, 0, 0.1);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: slideIn 0.3s ease-out;
        max-width: 100%;
        padding: 0 20px;
        box-sizing: border-box;
      }

      .consent-banner--top {
        top: 0;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 0 0 12px 12px;
      }

      .consent-banner--bottom {
        bottom: 0;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 12px 12px 0 0;
      }

      .consent-banner--dark {
        background: rgba(33, 33, 33, 0.98);
        border-color: rgba(255, 255, 255, 0.1);
        color: white;
      }

      .consent-banner--dark .consent-banner__btn--secondary {
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border-color: rgba(255, 255, 255, 0.2);
      }

      .consent-banner__content {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px 0;
      }

      .consent-banner__icon {
        font-size: 24px;
        flex-shrink: 0;
        margin-top: 4px;
      }

      .consent-banner__text {
        flex: 1;
        min-width: 0;
      }

      .consent-banner__title {
        margin: 0 0 8px 0;
        font-size: 18px;
        font-weight: 600;
        color: inherit;
      }

      .consent-banner__message {
        margin: 0 0 16px 0;
        font-size: 14px;
        line-height: 1.5;
        color: inherit;
        opacity: 0.8;
      }

      .consent-banner__details {
        background: rgba(0, 0, 0, 0.05);
        border-radius: 8px;
        padding: 16px;
        margin-top: 12px;
        font-size: 13px;
        line-height: 1.4;
      }

      .consent-banner--dark .consent-banner__details {
        background: rgba(255, 255, 255, 0.05);
      }

      .consent-banner__details h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 600;
      }

      .consent-banner__details ul {
        margin: 0 0 12px 16px;
        padding: 0;
      }

      .consent-banner__details li {
        margin-bottom: 4px;
      }

      .consent-banner__note {
        margin: 12px 0 0 0;
        font-style: italic;
        opacity: 0.7;
      }

      .consent-banner__actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
        flex-shrink: 0;
      }

      .consent-banner__buttons {
        display: flex;
        gap: 8px;
      }

      .consent-banner__btn {
        padding: 10px 20px;
        border: 1px solid transparent;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }

      .consent-banner__btn--primary {
        background: #2563eb;
        color: white;
        border-color: #2563eb;
      }

      .consent-banner__btn--primary:hover {
        background: #1d4ed8;
        border-color: #1d4ed8;
      }

      .consent-banner__btn--secondary {
        background: transparent;
        color: #374151;
        border-color: #d1d5db;
      }

      .consent-banner__btn--secondary:hover {
        background: #f9fafb;
        border-color: #9ca3af;
      }

      .consent-banner__links {
        display: flex;
        gap: 16px;
        align-items: center;
      }

      .consent-banner__link {
        background: none;
        border: none;
        color: #333;
        font-size: 13px;
        text-decoration: underline;
        cursor: pointer;
        transition: opacity 0.2s ease;
        padding: 0;
      }

      .consent-banner__link:hover {
        opacity: 0.7;
      }

      .consent-banner--dark .consent-banner__link {
        color: #ccc;
      }

      @keyframes slideIn {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      .consent-banner--top {
        animation-name: slideInTop;
      }

      @keyframes slideInTop {
        from {
          transform: translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      @media (max-width: 768px) {
        .consent-banner {
          padding: 0 16px;
        }

        .consent-banner__content {
          flex-direction: column;
          gap: 12px;
        }

        .consent-banner__actions {
          width: 100%;
        }

        .consent-banner__buttons {
          flex-direction: column;
          width: 100%;
        }

        .consent-banner__btn {
          width: 100%;
        }

        .consent-banner__links {
          justify-content: center;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .consent-banner {
          animation: none;
        }
      }
    `;
  }

  protected override cacheElements(): void {
    // Use shadow root or host for element queries
    const root = this.shadowRoot || this.host || document;

    const banner = root.querySelector('[data-ref="banner"]') as HTMLElement;
    if (banner) this.elements.set('banner', banner);

    const acceptBtn = root.querySelector('[data-ref="acceptBtn"]') as HTMLElement;
    if (acceptBtn) this.elements.set('acceptBtn', acceptBtn);

    const declineBtn = root.querySelector('[data-ref="declineBtn"]') as HTMLElement;
    if (declineBtn) this.elements.set('declineBtn', declineBtn);

    const detailsBtn = root.querySelector('[data-ref="detailsBtn"]') as HTMLElement;
    if (detailsBtn) this.elements.set('detailsBtn', detailsBtn);
  }

  protected override bindEvents(): void {
    const acceptBtn = this.getElement('acceptBtn', '[data-ref="acceptBtn"]', false);
    const declineBtn = this.getElement('declineBtn', '[data-ref="declineBtn"]', false);
    const detailsBtn = this.getElement('detailsBtn', '[data-ref="detailsBtn"]', false);

    if (acceptBtn) {
      this.addEventListener(acceptBtn, 'click', this.handleAccept.bind(this));
    }

    if (declineBtn) {
      this.addEventListener(declineBtn, 'click', this.handleDecline.bind(this));
    }

    if (detailsBtn) {
      this.addEventListener(detailsBtn, 'click', this.handleToggleDetails.bind(this));
    }
  }

  private handleAccept = (): void => {
    this.setConsent('accepted');
    this.hide();
    this.props.onAccept?.();
    this.dispatchEvent('consent-accepted');
  };

  private handleDecline = (): void => {
    this.setConsent('declined');
    this.hide();
    this.props.onDecline?.();
    this.dispatchEvent('consent-declined');
  };

  private handleToggleDetails = (): void => {
    this.setState({ showDetails: !this.state.showDetails });
    this.props.onDetailsClick?.();
  };

  private setConsent(consent: 'accepted' | 'declined'): void {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1); // 1 year expiry

    document.cookie = `tracking_consent=${consent}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;

    this.setState({ hasResponded: true });
  }

  private hide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    this.setState({ isVisible: false });

    // Remove from DOM after animation
    setTimeout(() => {
      const banner = this.getElement('banner', '[data-ref="banner"]') as HTMLElement;
      if (banner) {
        (banner as HTMLElement).style.animation = 'slideOut 0.3s ease-in forwards';
      }
    }, 100);
  }

  /**
   * Public API
   */
  show(): void {
    this.setState({ isVisible: true, hasResponded: false });
  }

  reset(): void {
    // Clear consent cookie
    document.cookie = 'tracking_consent=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    this.setState({
      isVisible: true,
      hasResponded: false,
      showDetails: false
    });
  }

  getConsentStatus(): 'accepted' | 'declined' | null {
    return ConsentBanner.getConsentStatus();
  }

  override async destroy(): Promise<void> {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    await super.destroy();
  }
}
