/**
 * ===============================================
 * BUSINESS CARD RENDERER MODULE
 * ===============================================
 * @file src/modules/business-card-renderer.ts
 * @extends BaseModule
 *
 * Handles ONLY business card rendering and basic setup:
 * - Card DOM element initialization
 * - Card visibility management
 * - Basic card state setup
 * - CSS class management
 *
 * Does NOT handle animations or interactions
 * ===============================================
 */

import { BaseModule } from '../core/base';
import type { ModuleOptions } from '../../types/modules';

interface BusinessCardConfig {
  businessCardId?: string;
  businessCardInnerId?: string;
  frontSelector?: string;
  backSelector?: string;
  containerSelector?: string;
}

export class BusinessCardRenderer extends BaseModule {
  // Element configuration
  private elementConfig: Required<BusinessCardConfig>;

  // Card elements
  private businessCard: HTMLElement | null = null;
  private businessCardInner: HTMLElement | null = null;
  private cardFront: HTMLElement | null = null;
  private cardBack: HTMLElement | null = null;
  private cardContainer: HTMLElement | null = null;

  // Render state
  private isRendered = false;
  private isVisible = false;

  constructor(config: BusinessCardConfig = {}, options: ModuleOptions = {}) {
    super('BusinessCardRenderer', { debug: true, ...options });

    this.elementConfig = {
      businessCardId: config.businessCardId || 'business-card',
      businessCardInnerId: config.businessCardInnerId || 'business-card-inner',
      frontSelector: config.frontSelector || '#business-card .business-card-front',
      backSelector: config.backSelector || '#business-card .business-card-back',
      containerSelector: config.containerSelector || '.business-card-container'
    };

    this.log('BusinessCardRenderer constructor completed');
  }

  override async onInit() {
    this.log('BusinessCardRenderer initialization started with config:', this.elementConfig);

    try {
      // Wait for DOM readiness
      await this.waitForDOMReady();

      // Cache card elements
      this.cacheCardElements();

      if (!this.hasRequiredElements()) {
        this.error('Required card elements not found for config:', this.elementConfig);
        this.error('Available business card elements in DOM:', {
          allBusinessCards: Array.from(document.querySelectorAll('[id*="business-card"]')).map(
            (el) => ({ id: el.id, classes: el.className })
          ),
          allCardInners: Array.from(document.querySelectorAll('[id*="business-card-inner"]')).map(
            (el) => ({ id: el.id, classes: el.className })
          ),
          allContainers: Array.from(
            document.querySelectorAll('[class*="business-card-container"]')
          ).map((el) => ({ id: el.id, classes: el.className }))
        });
        return;
      }

      // Setup basic card rendering
      this.setupCardRendering();

      this.isRendered = true;
      this.log('BusinessCardRenderer initialization completed');
    } catch (error) {
      this.error('BusinessCardRenderer initialization failed:', error);
    }
  }

  /**
   * ==========================================
   * DOM READY DETECTION
   * ==========================================
   */
  async waitForDOMReady() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        resolve(undefined);
      } else {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      }
    });
  }

  /**
   * ==========================================
   * ELEMENT CACHING
   * ==========================================
   */
  cacheCardElements() {
    this.log('Caching business card elements with config:', this.elementConfig);

    // Main card elements using configuration
    this.businessCard = document.getElementById(this.elementConfig.businessCardId);
    this.businessCardInner = document.getElementById(this.elementConfig.businessCardInnerId);
    this.cardFront = document.querySelector(this.elementConfig.frontSelector);
    this.cardBack = document.querySelector(this.elementConfig.backSelector);
    this.cardContainer = document.querySelector(this.elementConfig.containerSelector);

    this.log('Card elements found:', {
      businessCard: !!this.businessCard,
      businessCardInner: !!this.businessCardInner,
      cardFront: !!this.cardFront,
      cardBack: !!this.cardBack,
      cardContainer: !!this.cardContainer
    });

    this.log('Card element IDs:', {
      businessCardId: this.businessCard?.id,
      businessCardInnerId: this.businessCardInner?.id,
      containerClass: this.cardContainer?.className
    });
  }

  /**
   * ==========================================
   * VALIDATION
   * ==========================================
   */
  hasRequiredElements() {
    return !!(this.businessCard && this.businessCardInner && this.cardFront && this.cardBack);
  }

  /**
   * ==========================================
   * CARD RENDERING SETUP
   * ==========================================
   */
  setupCardRendering() {
    this.log('Setting up card rendering...');

    if (!this.hasRequiredElements()) {
      this.error('Cannot setup rendering - required elements missing');
      return;
    }

    // Handle positioning based on card type
    if (this.elementConfig.businessCardId === 'overlay-business-card') {
      // Overlay card positioning handled by IntroAnimationModule - just ensure visibility
      this.businessCard!.style.opacity = '1';
      this.businessCard!.style.visibility = 'visible';
      this.businessCard!.style.display = 'block';
    } else {
      // Section card positioning - handled by BusinessCardRenderer
      this.log('Setting up section card positioning...');
      if (this.cardContainer) {
        this.cardContainer.style.position = 'static';
        this.cardContainer.style.margin = '0 auto';
      }
      this.businessCard!.style.position = 'static';
      this.businessCard!.style.zIndex = 'auto';
      this.log('Section card positioning set');
    }

    // Ensure card inner is ready for 3D transforms
    this.businessCardInner!.style.transformStyle = 'preserve-3d';

    // Ensure faces are positioned correctly
    this.cardFront!.style.backfaceVisibility = 'hidden';
    this.cardBack!.style.backfaceVisibility = 'hidden';
    this.cardFront!.style.transform = 'rotateY(0deg)';
    this.cardBack!.style.transform = 'rotateY(180deg)';

    this.isVisible = true;
    this.log('Card rendering setup completed');
  }

  /**
   * ==========================================
   * PUBLIC API FOR OTHER MODULES
   * ==========================================
   */

  /**
   * Get card elements for other modules to use
   */
  getCardElements() {
    return {
      businessCard: this.businessCard,
      businessCardInner: this.businessCardInner,
      cardFront: this.cardFront,
      cardBack: this.cardBack,
      cardContainer: this.cardContainer
    };
  }

  /**
   * Show/hide card
   */
  setVisible(visible: boolean) {
    if (!this.hasRequiredElements()) {
      this.error('Cannot set visibility - required elements missing');
      return;
    }

    this.isVisible = visible;
    this.businessCard!.style.opacity = visible ? '1' : '0';
    this.businessCard!.style.visibility = visible ? 'visible' : 'hidden';

    this.log('Card visibility set to:', visible);
  }

  /**
   * Enable section card after intro completion
   */
  enableAfterIntro() {
    if (this.elementConfig.businessCardId === 'business-card') {
      this.log('Enabling section card after intro completion');
      this.businessCard!.style.opacity = '1';
      this.businessCard!.style.visibility = 'visible';
      this.businessCard!.style.display = 'block';
    }
  }

  /**
   * ==========================================
   * STATUS & DEBUG
   * ==========================================
   */
  override getStatus() {
    return {
      ...super.getStatus(),
      isRendered: this.isRendered,
      isVisible: this.isVisible,
      hasRequiredElements: this.hasRequiredElements(),
      elementConfig: this.elementConfig,
      elements: {
        businessCard: !!this.businessCard,
        businessCardInner: !!this.businessCardInner,
        cardFront: !!this.cardFront,
        cardBack: !!this.cardBack,
        cardContainer: !!this.cardContainer
      }
    };
  }

  /**
   * ==========================================
   * CLEANUP
   * ==========================================
   */
  override async onDestroy() {
    this.log('BusinessCardRenderer cleanup started');

    // Reset card visibility
    if (this.hasRequiredElements()) {
      this.setVisible(false);
    }

    // Clear element references
    this.businessCard = null;
    this.businessCardInner = null;
    this.cardFront = null;
    this.cardBack = null;
    this.cardContainer = null;

    this.isRendered = false;
    this.isVisible = false;

    this.log('BusinessCardRenderer cleanup completed');
  }
}
