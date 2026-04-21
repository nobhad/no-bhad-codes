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
import { getDebugMode } from '../core/env';
import { ICONS } from '../constants/icons';
import { Z_INDEX_CONSENT_BANNER } from '../constants/z-index';

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
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: ConsentBannerProps) {
    const initialState: ConsentBannerState = {
      isVisible: !ConsentBanner.hasExistingConsent(),
      showDetails: false,
      hasResponded: ConsentBanner.hasExistingConsent()
    };

    super('ConsentBanner', props, initialState, { debug: getDebugMode() });

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

    // Detect site theme from document attribute (overrides props)
    const siteTheme = document.documentElement.getAttribute('data-theme');
    const effectiveTheme = siteTheme === 'dark' ? 'dark' : theme;

    const positionClass = `consent-banner--${position}`;
    const themeClass = `consent-banner--${effectiveTheme}`;

    return ComponentUtils.html`
      <div class="consent-banner ${positionClass} ${themeClass}" data-ref="banner">
        <div class="consent-banner__content">
          <div class="consent-banner__icon">
            ${ICONS.COOKIE}
          </div>
          
          <div class="consent-banner__text">
            <h3 class="consent-banner__title">I respect your privacy</h3>
            <p class="consent-banner__message">
              ${companyName} uses cookies and similar technologies to analyze site traffic
              and understand visitor behavior &mdash; so I can improve what I build.
              <strong>I will never sell or share your data with anyone.</strong>
              This is non-negotiable.
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
        <h4>What I track:</h4>
        <ul>
          <li><strong>Page Views:</strong> Which pages you visit and how long you stay</li>
          <li><strong>Interactions:</strong> Buttons you click and forms you use</li>
          <li><strong>Performance:</strong> How fast the site loads for you</li>
          <li><strong>Technical Info:</strong> Your browser type and screen size</li>
        </ul>
        
        <h4>What I will never do:</h4>
        <ul>
          <li><strong>Sell or share your data</strong> &mdash; ever, with anyone</li>
          <li>Track your identity across other websites</li>
          <li>Collect sensitive personal data</li>
          <li>Use dark patterns to harvest information</li>
        </ul>

        <p class="consent-banner__note">
          You can change your mind anytime by clearing your browser cookies or
          contacting me. Declining won't affect your ability to use the website.
        </p>
      </div>
    `;
  }

  private getStyles(): string {
    return ComponentUtils.css`
      /* color-mix() requires Safari 16.3+. Each color-mix line is preceded by
         a solid-token fallback — older browsers skip the invalid color-mix
         declaration and use the preceding line. */
      .consent-banner {
        position: fixed;
        left: 0;
        right: 0;
        overflow: hidden;
        background: var(--color-bg-primary);
        background: color-mix(in srgb, var(--color-bg-primary) 30%, transparent);
        -webkit-backdrop-filter: blur(12px);
        backdrop-filter: blur(12px);
        border: none;
        border-top: 1px solid var(--color-border-primary);
        border-top: 1px solid color-mix(in srgb, white 20%, transparent);
        border-left: 1px solid var(--color-border-primary);
        border-left: 1px solid color-mix(in srgb, white 20%, transparent);
        box-shadow: 0 -1px 24px var(--color-shadow);
        box-shadow: 0 -1px 24px color-mix(in srgb, var(--color-text-primary) 8%, transparent);
        z-index: ${Z_INDEX_CONSENT_BANNER};
        font-family: var(--font-family-sans, system-ui, -apple-system, sans-serif);
        animation: slideIn var(--transition-fast, 0.2s) ease-out;
        max-width: 100%;
        padding: 0 var(--space-4, 20px);
        box-sizing: border-box;
        color: var(--color-text-primary, #171717);
      }

      .consent-banner::after {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        background: transparent;
        background: linear-gradient(
          135deg,
          color-mix(in srgb, white 15%, transparent),
          color-mix(in srgb, white 5%, transparent)
        );
        border-radius: inherit;
        pointer-events: none;
      }

      .consent-banner--top {
        top: 0;
      }

      .consent-banner--bottom {
        bottom: 0;
      }

      /* Dark mode: push more of the dark theme color into the mix so bright
         backdrop content (title card, hero imagery) can't wash out the banner.
         Light mode stays at 30% for a more translucent glass look. */
      .consent-banner--dark {
        background: var(--color-bg-primary);
        background: color-mix(in srgb, var(--color-bg-primary) 65%, transparent);
      }


      .consent-banner__content {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        max-width: var(--size-container);
        margin: 0 auto;
        padding: var(--space-4) 0;
      }

      .consent-banner__icon {
        flex-shrink: 0;
        margin-top: var(--space-0-5);
        color: var(--color-text-primary);
      }

      .consent-banner__icon svg {
        width: var(--icon-size-xl);
        height: var(--icon-size-xl);
      }

      .consent-banner__text {
        flex: 1;
        min-width: 0;
      }

      .consent-banner__title {
        margin: 0 0 var(--space-1) 0;
        font-size: var(--font-size-lg);
        font-weight: var(--font-weight-semibold);
        font-family: var(--font-family-display);
        text-transform: uppercase;
        color: inherit;
      }

      .consent-banner__message {
        margin: 0 0 var(--space-2) 0;
        font-size: var(--font-size-sm);
        line-height: var(--line-height-normal);
        color: inherit;
        opacity: var(--opacity-high);
      }

      .consent-banner__details {
        background: var(--color-state-hover);
        border-radius: var(--border-radius-md);
        padding: var(--space-3);
        margin-top: var(--space-2);
        font-size: var(--font-size-xs);
        line-height: var(--line-height-normal);
        border: var(--border-width) solid var(--color-border-secondary);
      }

      .consent-banner__details h4 {
        margin: 0 0 var(--space-1) 0;
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        font-family: var(--font-family-display);
        text-transform: uppercase;
      }

      .consent-banner__details ul {
        margin: 0 0 var(--space-2) var(--space-3);
        padding: 0;
      }

      .consent-banner__details li {
        margin-bottom: var(--space-0-5);
      }

      .consent-banner__note {
        margin: var(--space-2) 0 0 0;
        font-style: italic;
        opacity: var(--opacity-secondary);
      }

      .consent-banner__actions {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        flex-shrink: 0;
      }

      .consent-banner__buttons {
        display: flex;
        gap: var(--icon-gap-md);
      }

      /* Consent banner buttons — uses the site's brutalist button tokens
         but overrides border-bottom-width for a flatter look suited to the banner. */
      .consent-banner__btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: var(--portal-btn-padding, var(--space-2, 8px) var(--space-4, 18px));
        border: var(--portal-btn-border-width, 2px) solid var(--color-text-primary);
        border-bottom-width: var(--portal-btn-border-width, 2px);
        border-radius: var(--portal-btn-border-radius, 0);
        font-size: var(--portal-btn-font-size, var(--font-size-sm, 0.875rem));
        font-weight: var(--portal-btn-font-weight, 500);
        font-family: var(--portal-btn-font-family, "Inconsolata", ui-monospace, monospace);
        letter-spacing: var(--portal-btn-letter-spacing, -0.02em);
        text-transform: var(--portal-btn-text-transform, uppercase);
        cursor: pointer;
        transition: all var(--transition-fast, 0.2s);
        white-space: nowrap;
        box-sizing: border-box;
      }

      .consent-banner__btn:focus {
        outline: 2px solid var(--color-text-secondary);
        outline-offset: 2px;
        box-shadow: none;
      }

      .consent-banner__btn--primary {
        background: var(--color-text-primary);
        color: var(--color-bg-primary);
        border-color: var(--color-text-primary);
      }

      .consent-banner__btn--primary:hover {
        background: transparent;
        color: var(--color-text-primary);
        border-color: var(--color-text-primary);
      }

      .consent-banner__btn--secondary {
        background: transparent;
        color: var(--color-text-primary);
        border-color: var(--color-text-primary);
      }

      .consent-banner__btn--secondary:hover {
        background: var(--color-text-primary);
        color: var(--color-bg-primary);
        border-color: var(--color-text-primary);
      }

      .consent-banner__links {
        display: flex;
        gap: var(--space-3);
        align-items: center;
      }

      .consent-banner__link {
        background: none;
        border: none;
        color: var(--color-text-secondary);
        font-size: var(--font-size-xs);
        text-decoration: underline;
        cursor: pointer;
        transition: color var(--transition-fast);
        padding: 0;
        font-family: inherit;
      }

      .consent-banner__link:hover {
        color: var(--color-accent);
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
          padding: 0 var(--space-3);
        }

        .consent-banner__content {
          flex-direction: column;
          gap: var(--space-2);
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
