/**
 * ===============================================
 * GSAP ANIMATION UTILITIES
 * ===============================================
 * @file src/utils/gsap-animations.ts
 *
 * Centralized GSAP animations to replace CSS @keyframes
 * All animations on the site should use GSAP, not CSS animations
 */

import { gsap } from 'gsap';

/**
 * Spinner animation - replaces CSS @keyframes spin
 * Returns a GSAP tween that can be killed when no longer needed
 */
export function createSpinner(element: HTMLElement | string): gsap.core.Tween {
  return gsap.to(element, {
    rotation: 360,
    duration: 1,
    ease: 'none',
    repeat: -1
  });
}

/**
 * Fade in up animation - replaces CSS @keyframes fadeInUp
 */
export function fadeInUp(
  element: HTMLElement | string,
  options: { duration?: number; delay?: number; y?: number } = {}
): gsap.core.Tween {
  const { duration = 0.6, delay = 0, y = 20 } = options;
  return gsap.fromTo(
    element,
    { opacity: 0, y },
    { opacity: 1, y: 0, duration, delay, ease: 'power2.out' }
  );
}

/**
 * Slide down animation - replaces CSS @keyframes slideDown
 */
export function slideDown(
  element: HTMLElement | string,
  options: { duration?: number; delay?: number } = {}
): gsap.core.Tween {
  const { duration = 0.3, delay = 0 } = options;
  return gsap.fromTo(
    element,
    { opacity: 0, height: 0, overflow: 'hidden' },
    { opacity: 1, height: 'auto', duration, delay, ease: 'power2.out' }
  );
}

/**
 * Cursor blink animation - replaces CSS @keyframes cursor-blink
 * Returns a GSAP tween that can be killed when no longer needed
 */
export function createCursorBlink(element: HTMLElement | string): gsap.core.Tween {
  return gsap.to(element, {
    opacity: 0,
    duration: 0.5,
    ease: 'steps(1)',
    repeat: -1,
    yoyo: true
  });
}

/**
 * Blink animation - replaces CSS @keyframes blink
 */
export function createBlink(element: HTMLElement | string): gsap.core.Tween {
  return gsap.to(element, {
    opacity: 0.5,
    duration: 0.25,
    ease: 'power1.inOut',
    repeat: -1,
    yoyo: true
  });
}

/**
 * Static TV animation - replaces CSS @keyframes static-animation
 */
export function createStaticAnimation(element: HTMLElement | string): gsap.core.Tween {
  return gsap.to(element, {
    backgroundPositionY: '10px',
    duration: 0.2,
    ease: 'none',
    repeat: -1
  });
}

/**
 * Skeleton shimmer animation - replaces CSS @keyframes skeleton-shimmer
 */
export function createSkeletonShimmer(element: HTMLElement | string): gsap.core.Tween {
  return gsap.to(element, {
    backgroundPositionX: '200%',
    duration: 1.5,
    ease: 'none',
    repeat: -1
  });
}

/**
 * Skeleton pulse animation - replaces CSS @keyframes skeleton-pulse
 */
export function createSkeletonPulse(element: HTMLElement | string): gsap.core.Tween {
  return gsap.to(element, {
    opacity: 0.7,
    duration: 0.75,
    ease: 'power1.inOut',
    repeat: -1,
    yoyo: true
  });
}

/**
 * Loading progress animation - replaces CSS @keyframes loading-progress
 */
export function animateLoadingProgress(
  element: HTMLElement | string,
  options: { duration?: number } = {}
): gsap.core.Tween {
  const { duration = 1 } = options;
  return gsap.fromTo(
    element,
    { width: '0%' },
    { width: '100%', duration, ease: 'power2.out' }
  );
}

/**
 * Avatar flicker animation - replaces CSS @keyframes avatar-flicker
 */
export function createAvatarFlicker(element: HTMLElement | string): gsap.core.Timeline {
  const tl = gsap.timeline({ repeat: -1 });
  tl.to(element, { opacity: 1, duration: 2.85 })
    .to(element, { opacity: 0.85, duration: 0.03 })
    .to(element, { opacity: 0.95, duration: 0.03 })
    .to(element, { opacity: 0.8, duration: 0.03 })
    .to(element, { opacity: 1, duration: 0.06 });
  return tl;
}

/**
 * Kill all GSAP animations on an element
 */
export function killAnimations(element: HTMLElement | string): void {
  gsap.killTweensOf(element);
}

/**
 * Animation registry for managing active animations
 */
const activeAnimations = new Map<string, gsap.core.Tween | gsap.core.Timeline>();

/**
 * Register an animation with a unique key for later cleanup
 */
export function registerAnimation(
  key: string,
  animation: gsap.core.Tween | gsap.core.Timeline
): void {
  // Kill existing animation with same key
  const existing = activeAnimations.get(key);
  if (existing) {
    existing.kill();
  }
  activeAnimations.set(key, animation);
}

/**
 * Unregister and kill an animation by key
 */
export function unregisterAnimation(key: string): void {
  const animation = activeAnimations.get(key);
  if (animation) {
    animation.kill();
    activeAnimations.delete(key);
  }
}

/**
 * Kill all registered animations
 */
export function killAllRegisteredAnimations(): void {
  activeAnimations.forEach((animation) => animation.kill());
  activeAnimations.clear();
}
