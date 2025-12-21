/**
 * ===============================================
 * GSAP ANIMATION UTILITIES
 * ===============================================
 * @file src/utils/gsap-utilities.ts
 *
 * Reusable GSAP animation patterns to replace CSS keyframes
 * GSAP-first approach for all complex animations
 */

import { gsap } from 'gsap';
import { ANIMATION_CONSTANTS } from '../config/animation-constants';

// ============================================
// CORE ANIMATION UTILITIES
// ============================================

/**
 * Fade in animation (replaces CSS fadeIn keyframe)
 * @param target - Element(s) to animate
 * @param duration - Animation duration in seconds
 * @param options - Additional GSAP options
 * @returns GSAP Tween
 */
export function fadeIn(
  target: gsap.TweenTarget,
  duration = ANIMATION_CONSTANTS.DURATIONS.NORMAL,
  options: gsap.TweenVars = {}
) {
  return gsap.from(target, {
    opacity: 0,
    duration,
    ease: ANIMATION_CONSTANTS.EASING.SMOOTH,
    ...options,
  });
}

/**
 * Fade out animation (replaces CSS fadeOut keyframe)
 * @param target - Element(s) to animate
 * @param duration - Animation duration in seconds
 * @param options - Additional GSAP options
 * @returns GSAP Tween
 */
export function fadeOut(
  target: gsap.TweenTarget,
  duration = ANIMATION_CONSTANTS.DURATIONS.NORMAL,
  options: gsap.TweenVars = {}
) {
  return gsap.to(target, {
    opacity: 0,
    duration,
    ease: ANIMATION_CONSTANTS.EASING.SMOOTH,
    ...options,
  });
}

/**
 * Slide in from direction (replaces CSS slideInFrom* keyframes)
 * @param target - Element(s) to animate
 * @param direction - Direction to slide from
 * @param duration - Animation duration in seconds
 * @param options - Additional GSAP options
 * @returns GSAP Tween
 */
export function slideIn(
  target: gsap.TweenTarget,
  direction: 'top' | 'bottom' | 'left' | 'right',
  duration = ANIMATION_CONSTANTS.DURATIONS.SLOW,
  options: gsap.TweenVars = {}
) {
  const from: gsap.TweenVars = { opacity: 0 };

  switch (direction) {
    case 'top':
      from.y = '-100%';
      break;
    case 'bottom':
      from.y = '100%';
      break;
    case 'left':
      from.x = '-100%';
      break;
    case 'right':
      from.x = '100%';
      break;
  }

  return gsap.from(target, {
    ...from,
    duration,
    ease: ANIMATION_CONSTANTS.EASING.SMOOTH,
    ...options,
  });
}

/**
 * Scale in animation (replaces CSS scaleIn keyframe)
 * @param target - Element(s) to animate
 * @param duration - Animation duration in seconds
 * @param options - Additional GSAP options
 * @returns GSAP Tween
 */
export function scaleIn(
  target: gsap.TweenTarget,
  duration = ANIMATION_CONSTANTS.DURATIONS.SLOW,
  options: gsap.TweenVars = {}
) {
  return gsap.from(target, {
    opacity: 0,
    scale: 0,
    duration,
    ease: ANIMATION_CONSTANTS.EASING.BACK,
    ...options,
  });
}

/**
 * Scale out animation (replaces CSS scaleOut keyframe)
 * @param target - Element(s) to animate
 * @param duration - Animation duration in seconds
 * @param options - Additional GSAP options
 * @returns GSAP Tween
 */
export function scaleOut(
  target: gsap.TweenTarget,
  duration = ANIMATION_CONSTANTS.DURATIONS.NORMAL,
  options: gsap.TweenVars = {}
) {
  return gsap.to(target, {
    opacity: 0,
    scale: 0,
    duration,
    ease: ANIMATION_CONSTANTS.EASING.SMOOTH,
    ...options,
  });
}

/**
 * Spin animation (replaces CSS spin keyframe)
 * @param target - Element(s) to animate
 * @param duration - Animation duration in seconds
 * @param options - Additional GSAP options
 * @returns GSAP Tween
 */
export function spin(
  target: gsap.TweenTarget,
  duration = 1,
  options: gsap.TweenVars = {}
) {
  return gsap.to(target, {
    rotation: 360,
    duration,
    ease: ANIMATION_CONSTANTS.EASING.LINEAR,
    repeat: -1,
    ...options,
  });
}

/**
 * Pulse animation (replaces CSS pulse keyframe)
 * @param target - Element(s) to animate
 * @param duration - Animation duration in seconds
 * @param options - Additional GSAP options
 * @returns GSAP Tween
 */
export function pulse(
  target: gsap.TweenTarget,
  duration = 2,
  options: gsap.TweenVars = {}
) {
  return gsap.to(target, {
    opacity: 0.5,
    duration,
    ease: ANIMATION_CONSTANTS.EASING.SMOOTH,
    repeat: -1,
    yoyo: true,
    ...options,
  });
}

/**
 * Bounce animation (replaces CSS bounce keyframe)
 * @param target - Element(s) to animate
 * @param duration - Animation duration in seconds
 * @param options - Additional GSAP options
 * @returns GSAP Tween
 */
export function bounce(
  target: gsap.TweenTarget,
  duration = 1,
  options: gsap.TweenVars = {}
) {
  return gsap.to(target, {
    y: -30,
    duration: duration / 2,
    ease: ANIMATION_CONSTANTS.EASING.BOUNCE,
    repeat: -1,
    yoyo: true,
    ...options,
  });
}

/**
 * Shake animation (replaces CSS shake keyframe)
 * @param target - Element(s) to animate
 * @param duration - Animation duration in seconds
 * @param options - Additional GSAP options
 * @returns GSAP Tween
 */
export function shake(
  target: gsap.TweenTarget,
  duration = 0.5,
  options: gsap.TweenVars = {}
) {
  return gsap.to(target, {
    x: -10,
    duration: duration / 10,
    ease: ANIMATION_CONSTANTS.EASING.LINEAR,
    repeat: 9,
    yoyo: true,
    ...options,
  });
}

/**
 * Flip animation (replaces CSS flip keyframe)
 * @param target - Element(s) to animate
 * @param duration - Animation duration in seconds
 * @param options - Additional GSAP options
 * @returns GSAP Tween
 */
export function flip(
  target: gsap.TweenTarget,
  duration = ANIMATION_CONSTANTS.DURATIONS.CARD_FLIP,
  options: gsap.TweenVars = {}
) {
  return gsap.to(target, {
    rotationY: 180,
    duration,
    ease: ANIMATION_CONSTANTS.EASING.SMOOTH,
    ...options,
  });
}

/**
 * Pulse glow animation (replaces pulse-glow CSS keyframe in nav-base.css)
 * @param target - Element(s) to animate
 * @param options - Additional GSAP options
 * @returns GSAP Tween
 */
export function pulseGlow(
  target: gsap.TweenTarget,
  options: gsap.TweenVars = {}
) {
  return gsap.to(target, {
    boxShadow: '0 2px 16px rgba(var(--color-brand-primary-rgb), 0.6)',
    duration: 2,
    ease: ANIMATION_CONSTANTS.EASING.SMOOTH_IN_OUT,
    repeat: -1,
    yoyo: true,
    ...options,
  });
}

// ============================================
// PERFORMANCE UTILITIES
// ============================================

/**
 * Throttle utility for event handlers
 * Ensures function is called at most once per specified limit
 * @param func - Function to throttle
 * @param limit - Time limit in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Debounce utility for event handlers
 * Delays function execution until after specified delay since last call
 * @param func - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return function (this: any, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}
