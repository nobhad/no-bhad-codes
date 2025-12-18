/**
 * ===============================================
 * INTRO ANIMATION MODULE
 * ===============================================
 * @file src/modules/intro-animation.ts
 * @extends BaseModule
 *
 * DESIGN:
 * - Desktop: Paw morph animation with aligned business card
 * - Mobile: Simple card flip (no morph overlay)
 * - Enter key skips animation
 * - Header fades in after animation completes
 *
 * TODO: [Code Review Dec 2025] This file is 400+ lines.
 *       Consider extracting SVG loading/parsing into a separate
 *       utility module (e.g., svg-loader.ts).
 *
 * NOTE: SVG constants below are extracted from coyote_paw.svg
 *       Card_Outline rect. Update these if the SVG changes.
 */

import { BaseModule } from './base';
import { gsap } from 'gsap';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import type { ModuleOptions } from '../types/modules';

// Register MorphSVG plugin
gsap.registerPlugin(MorphSVGPlugin);

// SVG file containing all paw variations (cache bust with timestamp)
const PAW_SVG = `/images/coyote_paw.svg?v=${Date.now()}`;

// SVG card position/dimensions (from coyote_paw.svg Card_Outline)
// Card rect: x="1250.15" y="1029.85" width="1062.34" height="591.3"
const SVG_CARD_X = 1250.15;
const SVG_CARD_Y = 1029.85;
const SVG_CARD_WIDTH = 1062.34;
const _SVG_CARD_HEIGHT = 591.3;
const _SVG_VIEWBOX_WIDTH = 2316.99;  // Full viewBox width
const _SVG_VIEWBOX_HEIGHT = 1801.19; // Full viewBox height

// Extracted SVG style colors
interface SvgStyleColors {
  textFill: string;       // cls-2 fill
  cardFill: string;       // cls-3 fill
  cardStroke: string;     // cls-3 stroke
  cardStrokeWidth: string;
}

export class IntroAnimationModule extends BaseModule {
  private timeline: gsap.core.Timeline | null = null;
  private isComplete = false;
  private skipHandler: ((event: KeyboardEvent) => void) | null = null;
  private morphOverlay: HTMLElement | null = null;
  private pawPaths: string[] = [];
  private whiteFillPaths: string[] = [];
  private svgColors: SvgStyleColors | null = null;

  constructor(options: ModuleOptions = {}) {
    super('IntroAnimationModule', { debug: true, ...options });

    // Bind methods
    this.handleSkip = this.handleSkip.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
  }

  override async init(): Promise<void> {
    await super.init();

    // MOBILE: Ensure header is visible from the very start (no intro effect on header)
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (isMobile) {
      const header = document.querySelector('.header') as HTMLElement;
      if (header) {
        header.style.removeProperty('opacity');
        header.style.removeProperty('visibility');
        Array.from(header.children).forEach((child) => {
          (child as HTMLElement).style.removeProperty('opacity');
          (child as HTMLElement).style.removeProperty('visibility');
        });
      }
    }

    // Check if intro has already been shown this session
    const introShown = sessionStorage.getItem('introShown');
    if (introShown === 'true') {
      this.log('Intro already shown this session - skipping');
      this.skipIntroImmediately();
      return;
    }

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      this.log('Reduced motion preferred - skipping animation');
      this.skipIntroImmediately();
      return;
    }

    try {
      if (isMobile) {
        // Mobile: Simple card flip only
        this.runCardFlip();
      } else {
        // Desktop: Paw morph animation
        await this.runMorphAnimation();
      }
    } catch (error) {
      this.error('Failed to initialize intro animation:', error);
      this.completeIntro();
    }
  }

  /**
   * Load paw paths from SVG - returns both black fill and white fill paths
   * SVG structure: paw group contains _Black_Fill_ (no class) then _White_Fill_ (cls-2)
   */
  private async loadPawPaths(url: string, pathId: string): Promise<{ black: string | null; white: string | null }> {
    try {
      const response = await fetch(url);
      const svgText = await response.text();

      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');

      const pawGroup = svgDoc.getElementById(pathId);
      let blackPath: string | null = null;
      let whitePath: string | null = null;

      if (pawGroup) {
        // Get _Black_Fill_ path (no class attribute)
        const directChildren = pawGroup.children;
        for (let i = 0; i < directChildren.length; i++) {
          const child = directChildren[i];
          if (child.tagName.toLowerCase() === 'path' && !child.hasAttribute('class')) {
            blackPath = child.getAttribute('d');
            break;
          }
        }

        // Get _White_Fill_ path (cls-2 for paw1, cls-3 for paw2)
        let whiteEl = pawGroup.querySelector('path.cls-2');
        if (!whiteEl) {
          whiteEl = pawGroup.querySelector('path.cls-3');
        }
        if (whiteEl) {
          whitePath = whiteEl.getAttribute('d');
        }

        this.log(`Loaded ${pathId}: black=${!!blackPath}, white=${!!whitePath}`);
      }

      return { black: blackPath, white: whitePath };
    } catch (error) {
      this.error(`Failed to load paw paths: ${url}`, error);
      return { black: null, white: null };
    }
  }

  /**
   * Extract style colors from SVG's <style> block
   * Parses cls-2 (text) and cls-3 (card) definitions
   */
  private async extractSvgStyles(url: string): Promise<SvgStyleColors | null> {
    try {
      const response = await fetch(url);
      const svgText = await response.text();

      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');

      const styleElement = svgDoc.querySelector('style');
      if (!styleElement) {
        this.error('No style element found in SVG');
        return null;
      }

      const styleText = styleElement.textContent || '';

      // Extract cls-2 fill (text color)
      const cls2Match = styleText.match(/\.cls-2\s*\{[^}]*fill:\s*([^;}\s]+)/);
      const textFill = cls2Match ? cls2Match[1].trim() : '#231f20';

      // Extract cls-3 fill and stroke (card)
      const cls3Match = styleText.match(/\.cls-3\s*\{([^}]*)\}/);
      let cardFill = '#fff';
      let cardStroke = '#000';
      let cardStrokeWidth = '3';

      if (cls3Match) {
        const cls3Content = cls3Match[1];
        const fillMatch = cls3Content.match(/fill:\s*([^;}\s]+)/);
        const strokeMatch = cls3Content.match(/stroke:\s*([^;}\s]+)/);
        const strokeWidthMatch = cls3Content.match(/stroke-width:\s*([^;}\s]+)/);

        if (fillMatch) cardFill = fillMatch[1].trim();
        if (strokeMatch) cardStroke = strokeMatch[1].trim();
        if (strokeWidthMatch) cardStrokeWidth = strokeWidthMatch[1].replace('px', '').trim();
      }

      this.log('Extracted SVG colors:', { textFill, cardFill, cardStroke, cardStrokeWidth });

      return { textFill, cardFill, cardStroke, cardStrokeWidth };
    } catch (error) {
      this.error(`Failed to extract SVG styles: ${url}`, error);
      return null;
    }
  }

  /**
   * Load static content from SVG (card outline + text) - these do NOT morph
   * Card outline from: _No_Morph_Outline_ > Card_Outline (cls-2)
   * Text from: _No_Morph_Text_on_Top_ (cls-1 paths)
   */
  private async loadStaticContent(url: string): Promise<{ outline: string | null; text: string | null }> {
    try {
      const response = await fetch(url);
      const svgText = await response.text();

      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');

      let outlineHtml: string | null = null;
      let textHtml: string | null = null;

      // Load card outline from _No_Morph_Outline_ group
      const outlineGroup = svgDoc.getElementById('_No_Morph_Outline_');
      if (outlineGroup) {
        const cardOutline = outlineGroup.querySelector('#Card_Outline');
        if (cardOutline) {
          // Outline only - no fill, just black stroke
          cardOutline.setAttribute('fill', 'none');
          cardOutline.setAttribute('stroke', '#000');
          cardOutline.setAttribute('stroke-width', '5');
          cardOutline.setAttribute('stroke-miterlimit', '10');
          outlineHtml = cardOutline.outerHTML;
          this.log('Loaded card outline from _No_Morph_Outline_ (stroke only)');
        }
      }

      // Load text from _No_Morph_Text_on_Top_ group
      const textGroup = svgDoc.getElementById('_No_Morph_Text_on_Top_');
      if (textGroup) {
        // Get all cls-1 paths (text) and force black fill
        const textPaths = textGroup.querySelectorAll('path.cls-1');
        const textElements: string[] = [];
        textPaths.forEach(el => {
          el.setAttribute('style', 'fill: #000');
          textElements.push(el.outerHTML);
        });
        textHtml = textElements.join('');
        this.log(`Loaded ${textPaths.length} text paths from _No_Morph_Text_on_Top_`);
      }

      return { outline: outlineHtml, text: textHtml };
    } catch (error) {
      this.error(`Failed to load static content: ${url}`, error);
      return { outline: null, text: null };
    }
  }

  /**
   * Run paw morph animation (desktop only)
   */
  private async runMorphAnimation(): Promise<void> {
    // Scroll to top - reset both window and main container
    const mainContainer = document.querySelector('main') as HTMLElement;
    if (mainContainer) {
      mainContainer.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;

    // Get overlay elements
    this.morphOverlay = document.getElementById('intro-morph-overlay');
    const morphSvg = document.getElementById('intro-morph-svg') as SVGSVGElement | null;
    const morphPaw = document.getElementById('morph-paw');
    const morphCardGroup = document.getElementById('morph-card-group');

    if (!this.morphOverlay || !morphSvg || !morphPaw || !morphCardGroup) {
      this.log('Morph overlay elements not found, falling back to card flip');
      this.runCardFlip();
      return;
    }

    // Get the actual business card element for alignment
    const businessCard = document.getElementById('business-card');
    if (!businessCard) {
      this.log('Business card element not found, falling back to card flip');
      this.runCardFlip();
      return;
    }

    // Load SVG and extract morphing paths
    this.log('Loading SVG file...');
    const response = await fetch(PAW_SVG);
    const svgText = await response.text();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');

    // Get paw groups for morphing
    const paw1Group = svgDoc.getElementById('paw1');
    const paw2Group = svgDoc.getElementById('paw2');
    const outlineGroup = svgDoc.getElementById('_No_Morph_Outline_');
    const textGroup = svgDoc.getElementById('_No_Morph_Text_on_Top_');

    if (!paw1Group || !paw2Group) {
      this.error('paw groups not found in SVG');
      this.runCardFlip();
      return;
    }

    // Extract BLACK fill paths (no class attribute)
    const paw1Black = paw1Group.querySelector('path:not([class])');
    const paw2Black = paw2Group.querySelector('path:not([class])');

    // Extract WHITE fill paths (cls-2 or cls-3)
    const paw1White = paw1Group.querySelector('path.cls-2') || paw1Group.querySelector('path.cls-3');
    const paw2White = paw2Group.querySelector('path.cls-2') || paw2Group.querySelector('path.cls-3');

    if (!paw1Black || !paw2Black) {
      this.error('Black fill paths not found');
      this.runCardFlip();
      return;
    }

    this.log('Loaded: paw1 black+white, paw2 black+white, outline, text');

    // Get business card screen position for pixel-perfect alignment
    const cardRect = businessCard.getBoundingClientRect();

    // Get the card front element for accurate dimensions
    const cardFront = businessCard.querySelector('.business-card-front') as HTMLElement;
    const actualCardRect = cardFront ? cardFront.getBoundingClientRect() : cardRect;

    // Calculate uniform scale based on card width (proportions preserved)
    const scale = actualCardRect.width / SVG_CARD_WIDTH;

    // ViewBox matches viewport - we'll scale content uniformly with transform
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    morphSvg.setAttribute('viewBox', `0 0 ${viewportWidth} ${viewportHeight}`);
    morphSvg.setAttribute('preserveAspectRatio', 'none'); // We handle scaling ourselves

    // Calculate translation: position scaled SVG card to match screen card position
    const translateX = actualCardRect.left - (SVG_CARD_X * scale);
    const translateY = actualCardRect.top - (SVG_CARD_Y * scale);

    this.log('Alignment:', {
      cardRect: actualCardRect,
      scale,
      translateX,
      translateY
    });

    // Create wrapper for all layers
    const transformWrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    transformWrapper.setAttribute('id', 'intro-layers-wrapper');
    transformWrapper.setAttribute('transform', `translate(${translateX}, ${translateY}) scale(${scale})`);

    // Remove existing placeholder elements from morphSvg
    morphSvg.removeChild(morphCardGroup);
    morphSvg.removeChild(morphPaw);

    // Create morphing elements in correct order (bottom to top):
    // 1. BLACK fill (morphs)
    // 2. WHITE fill (morphs)
    // 3. OUTLINE (static)
    // 4. TEXT (static)

    // 1. BLACK FILL - clone paw1's black, will morph to paw2's black
    const blackFillEl = paw1Black.cloneNode(true) as SVGPathElement;
    blackFillEl.setAttribute('id', 'morph-black');
    transformWrapper.appendChild(blackFillEl);
    console.log('Layer 1: BLACK fill (morphs)');

    // 2. WHITE FILL - clone paw1's white, will morph to paw2's white
    let whiteFillEl: SVGPathElement | null = null;
    if (paw1White) {
      whiteFillEl = paw1White.cloneNode(true) as SVGPathElement;
      whiteFillEl.setAttribute('id', 'morph-white');
      transformWrapper.appendChild(whiteFillEl);
      console.log('Layer 2: WHITE fill (morphs)');
    }

    // 3. OUTLINE (static)
    if (outlineGroup) {
      const clonedOutline = outlineGroup.cloneNode(true) as Element;
      transformWrapper.appendChild(clonedOutline);
      console.log('Layer 3: OUTLINE (static)');
    }

    // 4. TEXT (static, top)
    if (textGroup) {
      const clonedText = textGroup.cloneNode(true) as Element;
      transformWrapper.appendChild(clonedText);
      console.log('Layer 4: TEXT (static, top)');
    }

    // Add wrapper to SVG
    morphSvg.appendChild(transformWrapper);

    this.log('SVG layers: black(morph) → white(morph) → outline → text');

    // Store paths for morphing
    const paw2BlackPath = paw2Black.getAttribute('d');
    const paw2WhitePath = paw2White?.getAttribute('d');

    // Hide actual business card during morph animation
    businessCard.style.opacity = '0';

    // Setup Enter key to skip animation
    this.skipHandler = this.handleKeyPress;
    document.addEventListener('keydown', this.skipHandler);

    // Create morph animation timeline
    this.timeline = gsap.timeline({
      onComplete: () => this.completeMorphAnimation()
    });

    const header = document.querySelector('.header') as HTMLElement;

    // Timeline: show paw1, morph to paw2, then fade out
    const morphDuration = 1.0;
    const morphEase = 'power2.inOut';

    // Initial pause showing paw1
    this.timeline.to({}, { duration: 0.8 });

    // Morph BLACK fill: paw1 → paw2
    if (paw2BlackPath) {
      this.timeline.to(blackFillEl, {
        morphSVG: {
          shape: paw2BlackPath,
          shapeIndex: 'auto'
        },
        duration: morphDuration,
        ease: morphEase
      });
    }

    // Morph WHITE fill: paw1 → paw2 (at same time as black)
    if (whiteFillEl && paw2WhitePath) {
      this.timeline.to(whiteFillEl, {
        morphSVG: {
          shape: paw2WhitePath,
          shapeIndex: 'auto'
        },
        duration: morphDuration,
        ease: morphEase
      }, '<'); // '<' = same time as previous
    }

    // Brief hold showing paw2
    this.timeline.to({}, { duration: 0.6 });

    // Fade out overlay
    this.timeline.to(this.morphOverlay, {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out',
      onComplete: () => {
        // Show the actual business card
        businessCard.style.opacity = '1';

        // Remove intro-loading class
        document.documentElement.classList.remove('intro-loading');
        document.documentElement.classList.add('intro-complete');

        // Fade in header content
        if (header) {
          this.animateHeaderIn(header);
        }
      }
    });
  }

  /**
   * Complete morph animation and clean up
   */
  private completeMorphAnimation(): void {
    // Hide overlay completely
    if (this.morphOverlay) {
      this.morphOverlay.style.visibility = 'hidden';
    }

    this.completeIntro();
  }

  /**
   * Animate header content in (desktop only)
   */
  private animateHeaderIn(header: HTMLElement): void {
    const headerChildren = header.children;

    // Set initial state
    Array.from(headerChildren).forEach((child) => {
      (child as HTMLElement).style.setProperty('opacity', '0', 'important');
      (child as HTMLElement).style.setProperty('visibility', 'visible', 'important');
    });

    // Animate with proxy
    const proxy = { opacity: 0 };
    gsap.to(proxy, {
      opacity: 1,
      duration: 1.0,
      ease: 'power2.out',
      onUpdate: () => {
        Array.from(headerChildren).forEach((child) => {
          (child as HTMLElement).style.setProperty(
            'opacity',
            String(proxy.opacity),
            'important'
          );
        });
      },
      onComplete: () => {
        Array.from(headerChildren).forEach((child) => {
          (child as HTMLElement).style.removeProperty('opacity');
          (child as HTMLElement).style.removeProperty('visibility');
        });
      }
    });
  }

  /**
   * Skip intro immediately (for returning visitors in same session)
   */
  private skipIntroImmediately(): void {
    this.isComplete = true;

    // Hide morph overlay
    const morphOverlay = document.getElementById('intro-morph-overlay');
    if (morphOverlay) {
      morphOverlay.classList.add('hidden');
    }

    // Remove intro classes and show content immediately
    document.documentElement.classList.remove('intro-loading');
    document.documentElement.classList.add('intro-complete', 'intro-finished');

    // Make sure card is visible
    const businessCard = document.getElementById('business-card');
    if (businessCard) {
      businessCard.style.opacity = '1';
    }

    const cardInner = document.getElementById('business-card-inner');
    if (cardInner) {
      cardInner.style.transition = 'none';
      cardInner.style.transform = 'rotateY(0deg)';
    }

    // Make header visible immediately
    const header = document.querySelector('.header') as HTMLElement;
    if (header) {
      header.style.removeProperty('opacity');
      header.style.removeProperty('visibility');
    }
  }

  /**
   * Handle keyboard input (Enter to skip)
   */
  private handleKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !this.isComplete) {
      this.handleSkip();
    }
  }

  /**
   * Skip to end of animation
   */
  private handleSkip(): void {
    if (this.timeline && !this.isComplete) {
      this.timeline.progress(1);
    } else if (!this.isComplete) {
      this.completeIntro();
    }
  }

  /**
   * Run card flip animation (mobile fallback)
   */
  private runCardFlip(): void {
    // Hide morph overlay on mobile
    const morphOverlay = document.getElementById('intro-morph-overlay');
    if (morphOverlay) {
      morphOverlay.classList.add('hidden');
    }

    // Scroll to top - reset both window and main container
    const mainContainer = document.querySelector('main') as HTMLElement;
    if (mainContainer) {
      mainContainer.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;

    const cardInner = document.getElementById('business-card-inner');

    if (!cardInner) {
      this.completeIntro();
      return;
    }

    const cardContainer = cardInner.parentElement;

    // Set initial state - showing back
    cardInner.style.transition = 'none';
    cardInner.style.transform = 'rotateY(180deg)';

    if (cardContainer) {
      cardContainer.style.perspective = '1000px';
    }

    // Setup Enter key to skip animation
    this.skipHandler = this.handleKeyPress;
    document.addEventListener('keydown', this.skipHandler);

    // Create timeline for card flip
    this.timeline = gsap.timeline({
      onComplete: () => this.completeIntro()
    });

    const header = document.querySelector('.header') as HTMLElement;

    this.timeline
      .to({}, { duration: 2.0 }) // Pause showing back
      .to(cardInner, {
        rotationY: 0,
        duration: 1.5,
        ease: 'power2.inOut',
        force3D: true,
        overwrite: true,
        onComplete: () => {
          document.documentElement.classList.remove('intro-loading');
          document.documentElement.classList.add('intro-complete');

          const isMobile = window.matchMedia('(max-width: 767px)').matches;
          if (isMobile && header) {
            header.style.removeProperty('opacity');
            header.style.removeProperty('visibility');
          } else if (header) {
            this.animateHeaderIn(header);
          }
        }
      });
  }

  /**
   * Complete the intro and clean up
   */
  private completeIntro(): void {
    if (this.isComplete) return;

    this.isComplete = true;

    // Mark intro as shown for this session
    sessionStorage.setItem('introShown', 'true');

    // Ensure main page content is visible
    document.documentElement.classList.remove('intro-loading');
    document.documentElement.classList.add('intro-complete');

    // Ensure business card is visible
    const businessCard = document.getElementById('business-card');
    if (businessCard) {
      businessCard.style.opacity = '1';
    }

    // Scroll to top - reset both window and main container
    const mainContainer = document.querySelector('main') as HTMLElement;
    if (mainContainer) {
      mainContainer.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;

    // Add intro-finished after transition completes
    setTimeout(() => {
      document.documentElement.classList.add('intro-finished');
    }, 600);

    // Clean up event listeners
    if (this.skipHandler) {
      document.removeEventListener('keydown', this.skipHandler);
      this.skipHandler = null;
    }

    // Update app state
    if (typeof window !== 'undefined' && (window as any).NBW_STATE) {
      (window as any).NBW_STATE.setState({ introAnimating: false });
    }
  }

  /**
   * Get current status
   */
  override getStatus() {
    return {
      ...super.getStatus(),
      isComplete: this.isComplete,
      timelineProgress: this.timeline?.progress() || 0
    };
  }

  /**
   * Cleanup method
   */
  override async destroy(): Promise<void> {
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }

    if (this.skipHandler) {
      document.removeEventListener('keydown', this.skipHandler);
      this.skipHandler = null;
    }

    await super.destroy();
  }
}
