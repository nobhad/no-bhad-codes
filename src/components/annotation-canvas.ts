/**
 * ============================================
 * ANNOTATION CANVAS COMPONENT
 * ============================================
 *
 * Drawing canvas for design review annotations
 * Supports: draw, highlight, text annotations
 */

/* eslint-disable no-undef */

export type AnnotationTool = 'draw' | 'highlight' | 'text' | 'pointer';
export type AnnotationColor = 'red' | 'yellow' | 'blue' | 'green';

export interface Annotation {
  id: string;
  type: 'draw' | 'highlight' | 'text';
  color: AnnotationColor;
  coordinates?: Array<{ x: number; y: number }>;
  text?: string;
  x?: number;
  y?: number;
  timestamp: number;
  authorId: string;
  elementId?: string;
}

export class AnnotationCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private image: HTMLImageElement;
  private currentTool: AnnotationTool = 'pointer';
  private currentColor: AnnotationColor = 'red';
  private isDrawing = false;
  private startX = 0;
  private startY = 0;
  private annotations: Annotation[] = [];
  private onAnnotationAdded: ((annotation: Annotation) => void) | null = null;
  private zoomLevel = 1;

  constructor(
    canvasElement: HTMLCanvasElement,
    imageElement: HTMLImageElement
  ) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.image = imageElement;

    this.setupCanvas();
    this.attachEventListeners();
  }

  private setupCanvas(): void {
    // Set canvas size to match image
    this.canvas.width = this.image.width;
    this.canvas.height = this.image.height;

    // Draw initial image
    this.redraw();
  }

  private attachEventListeners(): void {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('mouseleave', () => this.stopDrawing());
    this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
    this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
    this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));
  }

  private getMousePos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / this.zoomLevel,
      y: (e.clientY - rect.top) / this.zoomLevel
    };
  }

  private getTouchPos(e: TouchEvent): { x: number; y: number } {
    if (!e.touches.length) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.touches[0].clientX - rect.left) / this.zoomLevel,
      y: (e.touches[0].clientY - rect.top) / this.zoomLevel
    };
  }

  private onMouseDown(e: MouseEvent): void {
    if (this.currentTool === 'pointer') return;
    if (this.currentTool === 'text') {
      this.addTextAnnotation(e);
      return;
    }

    this.isDrawing = true;
    const pos = this.getMousePos(e);
    this.startX = pos.x;
    this.startY = pos.y;
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isDrawing || this.currentTool === 'pointer' || this.currentTool === 'text') return;

    const pos = this.getMousePos(e);
    this.redraw();
    this.drawPreview(pos.x, pos.y);
  }

  private onMouseUp(e: MouseEvent): void {
    if (!this.isDrawing) return;

    const pos = this.getMousePos(e);
    this.completeAnnotation(pos.x, pos.y);
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    if (this.currentTool === 'pointer' || this.currentTool === 'text') return;

    this.isDrawing = true;
    const pos = this.getTouchPos(e);
    this.startX = pos.x;
    this.startY = pos.y;
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.isDrawing) return;

    const pos = this.getTouchPos(e);
    this.redraw();
    this.drawPreview(pos.x, pos.y);
  }

  private onTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    if (!this.isDrawing) return;

    const pos = this.getTouchPos(e);
    this.completeAnnotation(pos.x, pos.y);
  }

  private drawPreview(endX: number, endY: number): void {
    if (this.currentTool === 'draw') {
      this.ctx.strokeStyle = this.getColorValue();
      this.ctx.lineWidth = 2;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(this.startX, this.startY);
      this.ctx.lineTo(endX, endY);
      this.ctx.stroke();
    } else if (this.currentTool === 'highlight') {
      const color = this.getColorValue();
      this.ctx.fillStyle = `${color  }40`; // 25% opacity
      this.ctx.fillRect(
        Math.min(this.startX, endX),
        Math.min(this.startY, endY),
        Math.abs(endX - this.startX),
        Math.abs(endY - this.startY)
      );
    }
  }

  private completeAnnotation(endX: number, endY: number): void {
    if (!this.isDrawing) return;

    this.isDrawing = false;

    const annotation: Annotation = {
      id: `ann-${Date.now()}-${Math.random()}`,
      type: this.currentTool as 'draw' | 'highlight',
      color: this.currentColor,
      timestamp: Date.now(),
      authorId: '', // Will be set by caller
      coordinates: [
        { x: this.startX, y: this.startY },
        { x: endX, y: endY }
      ]
    };

    this.annotations.push(annotation);
    this.redraw();

    if (this.onAnnotationAdded) {
      this.onAnnotationAdded(annotation);
    }
  }

  private addTextAnnotation(e: MouseEvent): void {
    const pos = this.getMousePos(e);
    const text = prompt('Enter annotation text:');

    if (!text) return;

    const annotation: Annotation = {
      id: `ann-${Date.now()}-${Math.random()}`,
      type: 'text',
      color: this.currentColor,
      text,
      x: pos.x,
      y: pos.y,
      timestamp: Date.now(),
      authorId: ''
    };

    this.annotations.push(annotation);
    this.redraw();

    if (this.onAnnotationAdded) {
      this.onAnnotationAdded(annotation);
    }
  }

  private drawAnnotations(): void {
    for (const ann of this.annotations) {
      if (ann.type === 'draw' && ann.coordinates) {
        this.ctx.strokeStyle = this.getColorValue(ann.color);
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(ann.coordinates[0].x, ann.coordinates[0].y);
        this.ctx.lineTo(ann.coordinates[1].x, ann.coordinates[1].y);
        this.ctx.stroke();
      } else if (ann.type === 'highlight' && ann.coordinates) {
        const color = this.getColorValue(ann.color);
        this.ctx.fillStyle = `${color  }40`;
        this.ctx.fillRect(
          Math.min(ann.coordinates[0].x, ann.coordinates[1].x),
          Math.min(ann.coordinates[0].y, ann.coordinates[1].y),
          Math.abs(ann.coordinates[1].x - ann.coordinates[0].x),
          Math.abs(ann.coordinates[1].y - ann.coordinates[0].y)
        );
      } else if (ann.type === 'text' && ann.x !== undefined && ann.y !== undefined) {
        // Draw text annotation
        this.ctx.fillStyle = this.getColorValue(ann.color);
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.fillText(ann.text || '', ann.x + 5, ann.y - 5);

        // Draw flag/marker
        this.ctx.fillStyle = this.getColorValue(ann.color);
        this.ctx.beginPath();
        this.ctx.arc(ann.x, ann.y, 6, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  private redraw(): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw image
    this.ctx.drawImage(this.image, 0, 0);

    // Draw annotations
    this.drawAnnotations();
  }

  private stopDrawing(): void {
    this.isDrawing = false;
    this.redraw();
  }

  private getColorValue(color?: AnnotationColor): string {
    const colorMap: Record<AnnotationColor, string> = {
      red: '#ef4444',
      yellow: '#eab308',
      blue: '#3b82f6',
      green: '#22c55e'
    };
    return colorMap[color || this.currentColor];
  }

  public setTool(tool: AnnotationTool): void {
    this.currentTool = tool;
    this.canvas.style.cursor = tool === 'pointer' ? 'default' : 'crosshair';
  }

  public setColor(color: AnnotationColor): void {
    this.currentColor = color;
  }

  public clearAnnotations(): void {
    this.annotations = [];
    this.redraw();
  }

  public getAnnotations(): Annotation[] {
    return [...this.annotations];
  }

  public removeAnnotation(id: string): void {
    this.annotations = this.annotations.filter((a) => a.id !== id);
    this.redraw();
  }

  public setOnAnnotationAdded(callback: (annotation: Annotation) => void): void {
    this.onAnnotationAdded = callback;
  }

  public setZoom(level: number): void {
    this.zoomLevel = level;
    this.canvas.style.transform = `scale(${level})`;
    this.canvas.style.transformOrigin = 'top left';
  }

  public exportAnnotations(): string {
    return JSON.stringify(this.annotations.map((a) => ({
      ...a,
      authorId: '' // Will be filled by caller
    })));
  }

  public getCanvasImage(): string {
    return this.canvas.toDataURL('image/png');
  }
}

export function createAnnotationCanvas(
  imageUrl: string,
  targetContainer: HTMLElement
): Promise<AnnotationCanvas> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'annotation-canvas';

    const img = new Image();
    img.onload = () => {
      targetContainer.appendChild(canvas);
      const annotationCanvas = new AnnotationCanvas(canvas, img);
      resolve(annotationCanvas);
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}
