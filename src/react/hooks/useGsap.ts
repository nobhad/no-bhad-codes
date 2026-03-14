import { useEffect, useRef, useCallback } from 'react';
import { gsap } from 'gsap';
import { GSAP } from '../config/portal-constants';

/**
 * Hook for basic fade-in animation
 * @param delay - Delay before animation starts (in seconds)
 * @returns Ref to attach to the animated element
 */
export function useFadeIn<T extends HTMLElement>(delay = 0) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: GSAP.FADE_Y_OFFSET },
        { opacity: 1, y: 0, duration: GSAP.DURATION_NORMAL, delay, ease: GSAP.EASE_DEFAULT, clearProps: 'all' }
      );
    });

    return () => ctx.revert();
  }, [delay]);

  return ref;
}

/**
 * Hook for slide-in animation from a direction
 * @param direction - Direction to slide from ('left', 'right', 'top', 'bottom')
 * @param delay - Delay before animation starts
 * @param distance - Distance to slide (in pixels)
 */
export function useSlideIn<T extends HTMLElement>(
  direction: 'left' | 'right' | 'top' | 'bottom' = 'left',
  delay = 0,
  distance = 30
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;

    const axis = direction === 'left' || direction === 'right' ? 'x' : 'y';
    const value = direction === 'left' || direction === 'top' ? -distance : distance;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { opacity: 0, [axis]: value },
        { opacity: 1, [axis]: 0, duration: GSAP.DURATION_NORMAL, delay, ease: GSAP.EASE_DEFAULT, clearProps: 'all' }
      );
    });

    return () => ctx.revert();
  }, [direction, delay, distance]);

  return ref;
}

/**
 * Hook for staggered children animation
 * @param stagger - Time between each child animation
 * @param delay - Initial delay before animation starts
 */
export function useStaggerChildren<T extends HTMLElement>(stagger: number = GSAP.STAGGER_DEFAULT, delay: number = 0) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;

    const children = ref.current.children;
    if (children.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        children,
        { opacity: 0, y: GSAP.FADE_Y_OFFSET },
        {
          opacity: 1,
          y: 0,
          duration: GSAP.DURATION_NORMAL,
          delay,
          stagger,
          ease: GSAP.EASE_DEFAULT,
          clearProps: 'all'
        }
      );
    });

    return () => ctx.revert();
  }, [stagger, delay]);

  return ref;
}

/**
 * Hook for scale animation (useful for modals, buttons)
 * @param delay - Delay before animation starts
 */
export function useScaleIn<T extends HTMLElement>(delay = 0) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { opacity: 0, scale: GSAP.SCALE_START },
        { opacity: 1, scale: 1, duration: GSAP.DURATION_FAST, delay, ease: GSAP.EASE_DEFAULT, clearProps: 'all' }
      );
    });

    return () => ctx.revert();
  }, [delay]);

  return ref;
}

/**
 * Hook for imperative GSAP control
 * Returns a timeline that can be controlled programmatically
 */
export function useGsapTimeline() {
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const createTimeline = useCallback((options?: gsap.TimelineVars) => {
    // Clean up existing timeline
    if (timelineRef.current) {
      timelineRef.current.kill();
    }
    timelineRef.current = gsap.timeline(options);
    return timelineRef.current;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timelineRef.current) {
        timelineRef.current.kill();
      }
    };
  }, []);

  return { timeline: timelineRef, createTimeline };
}

/**
 * Hook for scroll-triggered animations
 * Note: Requires ScrollTrigger plugin to be registered
 */
export function useScrollReveal<T extends HTMLElement>(delay = 0) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: GSAP.SCROLL_Y_OFFSET },
        {
          opacity: 1,
          y: 0,
          duration: GSAP.DURATION_SLOW,
          delay,
          ease: GSAP.EASE_DEFAULT,
          scrollTrigger: {
            trigger: ref.current,
            start: 'top 85%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    });

    return () => ctx.revert();
  }, [delay]);

  return ref;
}
