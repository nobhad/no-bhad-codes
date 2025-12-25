/**
 * ===============================================
 * BLOB ANIMATION MODULE
 * ===============================================
 * @file src/modules/animation/blob-animation.ts
 *
 * Physics-based blob animation based on balance circle design.
 * Creates an interactive background element that responds to mouse/touch.
 */

import type { DOMModule, ModuleStatus } from '../../types/modules';

interface BlobAnimationConfig {
  canvasId?: string;
  numPoints?: number;
  baseRadius?: number;
  position?: { x: number; y: number };
  debug?: boolean;
}

interface Point {
  azimuth: number;
  components: { x: number; y: number };
  acceleration: number;
  speed: number;
  radialEffect: number;
  elasticity: number;
  friction: number;
}

/**
 * Get CSS variable value from document
 */
function getCSSVariable(name: string): string {
  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * BlobAnimationModule
 * Creates a physics-based blob animation in a canvas element
 */
export class BlobAnimationModule implements DOMModule {
  public readonly name = 'BlobAnimationModule';
  public isInitialized = false;

  private config: Required<BlobAnimationConfig>;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: globalThis.CanvasRenderingContext2D | null = null;
  private points: Point[] = [];
  private animationId: number | null = null;
  private resizeHandler: (() => void) | null = null;
  private pointerMoveHandler: ((e: globalThis.PointerEvent | TouchEvent) => void) | null = null;
  private hover = false;
  private oldMousePoint = { x: 0, y: 0 };
  private _radius = 150;
  private _center = { x: 0, y: 0 };

  constructor(config: BlobAnimationConfig = {}) {
    this.config = {
      canvasId: config.canvasId ?? 'blob-canvas',
      numPoints: config.numPoints ?? 32,
      baseRadius: config.baseRadius ?? 150,
      position: config.position ?? { x: 0.5, y: 0.5 },
      debug: config.debug ?? false
    };
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    this.canvas = document.getElementById(this.config.canvasId) as HTMLCanvasElement;
    if (!this.canvas) {
      if (this.config.debug) {
        console.warn(`[BlobAnimationModule] Canvas #${this.config.canvasId} not found`);
      }
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      console.error('[BlobAnimationModule] Could not get 2D context');
      return;
    }

    // Initialize points
    this.initPoints();

    // Set up resize handler
    this.resizeHandler = this.handleResize.bind(this);
    window.addEventListener('resize', this.resizeHandler);
    this.handleResize();

    // Set up pointer interaction
    this.pointerMoveHandler = this.handlePointerMove.bind(this);
    window.addEventListener('pointermove', this.pointerMoveHandler as EventListener);
    window.addEventListener('touchmove', this.pointerMoveHandler as EventListener, { passive: true });

    // Start animation loop
    this.render();

    this.isInitialized = true;
    if (this.config.debug) {
      console.log('[BlobAnimationModule] Initialized');
    }
  }

  getStatus(): ModuleStatus {
    return {
      name: this.name,
      initialized: this.isInitialized,
      destroyed: !this.isInitialized && this.canvas === null,
      ready: this.isInitialized && this.canvas !== null,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      elementCount: this.canvas ? 1 : 0,
      listenerCount: (this.resizeHandler ? 1 : 0) + (this.pointerMoveHandler ? 2 : 0),
      timelineCount: 0
    };
  }

  isReady(): boolean {
    return this.isInitialized && this.canvas !== null;
  }

  async destroy(): Promise<void> {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    if (this.pointerMoveHandler) {
      window.removeEventListener('pointermove', this.pointerMoveHandler as EventListener);
      window.removeEventListener('touchmove', this.pointerMoveHandler as EventListener);
      this.pointerMoveHandler = null;
    }

    this.points = [];
    this.canvas = null;
    this.ctx = null;
    this.isInitialized = false;
  }

  /**
   * Initialize blob points around the perimeter
   */
  private initPoints(): void {
    const divisional = (Math.PI * 2) / this.config.numPoints;

    for (let i = 0; i < this.config.numPoints; i++) {
      const azimuth = Math.PI - divisional * (i + 1);
      this.points.push({
        azimuth,
        components: {
          x: Math.cos(azimuth),
          y: Math.sin(azimuth)
        },
        acceleration: -0.3 + Math.random() * 0.6,
        speed: 0,
        radialEffect: 0,
        elasticity: 0.001,
        friction: 0.0085
      });
    }
  }

  /**
   * Handle canvas resize
   */
  private handleResize(): void {
    if (!this.canvas) return;

    const parent = this.canvas.parentElement;
    if (!parent) return;

    this.canvas.width = parent.clientWidth;
    this.canvas.height = parent.clientHeight;

    // Adjust radius based on viewport
    const minDimension = Math.min(this.canvas.width, this.canvas.height);
    this._radius = Math.min(minDimension * 0.25, this.config.baseRadius);

    // Calculate center with offset for shadow
    const visualCenterOffset = this._radius * 0.85;
    this._center = {
      x: this.canvas.width * this.config.position.x,
      y: this.canvas.height * this.config.position.y - visualCenterOffset
    };
  }

  /**
   * Handle pointer/touch movement for interaction
   */
  private handlePointerMove(e: globalThis.PointerEvent | TouchEvent): void {
    const clientX = 'clientX' in e ? e.clientX : e.touches?.[0]?.clientX;
    const clientY = 'clientY' in e ? e.clientY : e.touches?.[0]?.clientY;

    if (clientX === undefined || clientY === undefined) return;

    const diff = { x: clientX - this._center.x, y: clientY - this._center.y };
    const dist = Math.sqrt(diff.x * diff.x + diff.y * diff.y);
    let angle: number | null = null;

    if (dist < this._radius && !this.hover) {
      angle = Math.atan2(diff.y, diff.x);
      this.hover = true;
    } else if (dist > this._radius && this.hover) {
      angle = Math.atan2(diff.y, diff.x);
      this.hover = false;
    }

    if (typeof angle === 'number') {
      let nearestPoint: Point | null = null;
      let distanceFromPoint = 100;

      for (const point of this.points) {
        if (Math.abs(angle - point.azimuth) < distanceFromPoint) {
          nearestPoint = point;
          distanceFromPoint = Math.abs(angle - point.azimuth);
        }
      }

      if (nearestPoint) {
        const strength = Math.min(
          100,
          Math.sqrt(
            Math.pow(this.oldMousePoint.x - clientX, 2) +
            Math.pow(this.oldMousePoint.y - clientY, 2)
          ) * 10
        );
        nearestPoint.acceleration = (strength / 100) * (this.hover ? -1 : 1);
      }
    }

    this.oldMousePoint = { x: clientX, y: clientY };
  }

  /**
   * Solve physics for a point
   */
  private solvePoint(point: Point, leftPoint: Point, rightPoint: Point): void {
    const acceleration =
      (-0.3 * point.radialEffect +
        (leftPoint.radialEffect - point.radialEffect) +
        (rightPoint.radialEffect - point.radialEffect)) *
        point.elasticity -
      point.speed * point.friction;

    point.acceleration = acceleration;
    point.speed += acceleration * 2;
    point.radialEffect += point.speed * 4;
  }

  /**
   * Get point position
   */
  private getPointPosition(point: Point): { x: number; y: number } {
    return {
      x: this._center.x + point.components.x * (this._radius + point.radialEffect),
      y: this._center.y + point.components.y * (this._radius + point.radialEffect)
    };
  }

  /**
   * Main render loop
   */
  private render = (): void => {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const points = this.points;
    const numPoints = points.length;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Solve physics for first point
    this.solvePoint(points[0], points[numPoints - 1], points[1]);

    const p0 = this.getPointPosition(points[numPoints - 1]);
    let p1 = this.getPointPosition(points[0]);
    const startPoint = p1;

    // Draw shadow ellipse (positioned below the blob for 3D effect)
    const shadowColor = getCSSVariable('--blob-shadow') || getCSSVariable('--color-neutral-800') || '#333333';
    ctx.beginPath();
    ctx.ellipse(
      this._center.x,
      this._center.y + this._radius * 1.7,
      this._radius * 1.0,
      this._radius * 0.23,
      0,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = shadowColor;
    ctx.fill();

    // Draw blob
    ctx.beginPath();
    ctx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);

    for (let i = 1; i < numPoints; i++) {
      this.solvePoint(points[i], points[i - 1], points[i + 1] || points[0]);

      const p2 = this.getPointPosition(points[i]);
      const xc = (p1.x + p2.x) / 2;
      const yc = (p1.y + p2.y) / 2;
      ctx.quadraticCurveTo(p1.x, p1.y, xc, yc);

      p1 = p2;
    }

    const xc = (p1.x + startPoint.x) / 2;
    const yc = (p1.y + startPoint.y) / 2;
    ctx.quadraticCurveTo(p1.x, p1.y, xc, yc);

    // Use brand primary color (crimson red)
    const blobColor = getCSSVariable('--color-brand-primary') || '#dc2626';
    ctx.fillStyle = blobColor;
    ctx.fill();

    this.animationId = requestAnimationFrame(this.render);
  };

  /**
   * Pause animation
   */
  pause(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Resume animation
   */
  resume(): void {
    if (!this.animationId && this.isInitialized) {
      this.render();
    }
  }
}
