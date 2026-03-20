/**
 * SignatureCanvas
 * Two-mode signature input: draw (canvas) or type (cursive text preview).
 * Exports signature as base64 PNG data URL.
 */

import * as React from 'react';
import { useRef, useEffect, useCallback, useState } from 'react';
import { Eraser, Pencil, Type, Upload } from 'lucide-react';

// ============================================
// CONSTANTS
// ============================================

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 200;
const LINE_WIDTH = 2;
const SIGNATURE_FONT_FAMILY = '\'Allura\', \'Segoe Script\', cursive';
const TYPED_FONT_SIZE = 40;
const TYPED_CANVAS_FONT = `${TYPED_FONT_SIZE}px ${SIGNATURE_FONT_FAMILY}`;
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// ============================================
// TYPES
// ============================================

export type SignatureMode = 'draw' | 'type' | 'upload';

interface SignatureCanvasProps {
  /** Called when signature data changes (base64 PNG or null) */
  onSignatureChange: (data: string | null) => void;
  /** Current signature mode */
  mode: SignatureMode;
  /** Callback to switch modes */
  onModeChange: (mode: SignatureMode) => void;
}

// ============================================
// HELPERS
// ============================================

/** Render typed text onto an offscreen canvas and return base64 PNG */
function renderTypedSignature(text: string): string {
  const offscreen = document.createElement('canvas');
  offscreen.width = CANVAS_WIDTH;
  offscreen.height = CANVAS_HEIGHT;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue('--app-color-text-primary').trim() || '#23324a';
  ctx.font = TYPED_CANVAS_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  return offscreen.toDataURL('image/png');
}

/** Get the ink color from CSS variables */
function getInkColor(): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--app-color-text-primary').trim() || '#23324a';
}

// ============================================
// COMPONENT
// ============================================

export function SignatureCanvas({ onSignatureChange, mode, onModeChange }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const hasStrokesRef = useRef(false);

  const [typedValue, setTypedValue] = useState('');
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ------- Canvas drawing setup -------

  const initCanvasContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = getInkColor();
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    initCanvasContext();
  }, [initCanvasContext]);

  // ------- Drawing handlers -------

  const getCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = useCallback((clientX: number, clientY: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    isDrawingRef.current = true;
    const { x, y } = getCanvasPoint(clientX, clientY);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const draw = useCallback((clientX: number, clientY: number) => {
    if (!isDrawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    hasStrokesRef.current = true;
    const { x, y } = getCanvasPoint(clientX, clientY);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, []);

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    // Emit signature data after a stroke ends
    if (hasStrokesRef.current && canvasRef.current) {
      onSignatureChange(canvasRef.current.toDataURL('image/png'));
    }
  }, [onSignatureChange]);

  // Mouse events
  const onMouseDown = useCallback((e: React.MouseEvent) => startDrawing(e.clientX, e.clientY), [startDrawing]);
  const onMouseMove = useCallback((e: React.MouseEvent) => draw(e.clientX, e.clientY), [draw]);

  // Touch events
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    startDrawing(touch.clientX, touch.clientY);
  }, [startDrawing]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    draw(touch.clientX, touch.clientY);
  }, [draw]);

  // ------- Clear -------

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    hasStrokesRef.current = false;
    onSignatureChange(null);
  }, [onSignatureChange]);

  // ------- Typed signature -------

  const handleTypedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTypedValue(value);
    if (value.trim()) {
      onSignatureChange(renderTypedSignature(value.trim()));
    } else {
      onSignatureChange(null);
    }
  }, [onSignatureChange]);

  // ------- Upload handler -------

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setUploadError('Please upload a PNG, JPEG, or WebP image.');
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setUploadError('File must be under 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setUploadPreview(dataUrl);
      onSignatureChange(dataUrl);
    };
    reader.readAsDataURL(file);
  }, [onSignatureChange]);

  const clearUpload = useCallback(() => {
    setUploadPreview(null);
    setUploadError(null);
    onSignatureChange(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [onSignatureChange]);

  // Clear state when switching modes
  useEffect(() => {
    if (mode === 'draw') {
      setTypedValue('');
      setUploadPreview(null);
      setUploadError(null);
      onSignatureChange(null);
    } else if (mode === 'type') {
      clearCanvas();
      setUploadPreview(null);
      setUploadError(null);
    } else {
      clearCanvas();
      setTypedValue('');
    }
    // Only run on mode change — not on every onSignatureChange ref change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div className="signature-canvas-wrapper">
      {/* Mode toggle */}
      <div className="signature-mode-toggle">
        <button
          type="button"
          className={`btn-outline-sm ${mode === 'draw' ? 'is-active' : ''}`}
          onClick={() => onModeChange('draw')}
        >
          <Pencil />
          Draw
        </button>
        <button
          type="button"
          className={`btn-outline-sm ${mode === 'type' ? 'is-active' : ''}`}
          onClick={() => onModeChange('type')}
        >
          <Type />
          Type
        </button>
        <button
          type="button"
          className={`btn-outline-sm ${mode === 'upload' ? 'is-active' : ''}`}
          onClick={() => onModeChange('upload')}
        >
          <Upload />
          Upload
        </button>
      </div>

      {/* Draw mode */}
      {mode === 'draw' && (
        <div className="signature-draw-area">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="signature-canvas"
            style={{ touchAction: 'none' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={stopDrawing}
          />
          <p className="signature-hint">Draw your signature above using your mouse or finger</p>
          <div className="signature-actions">
            <button type="button" className="btn-outline-sm" onClick={clearCanvas}>
              <Eraser />
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Type mode */}
      {mode === 'type' && (
        <div className="signature-type-area">
          <input
            type="text"
            className="form-input"
            placeholder="Type your signature"
            value={typedValue}
            onChange={handleTypedChange}
            autoFocus
          />
          <div className="signature-type-preview" style={{ fontFamily: SIGNATURE_FONT_FAMILY }}>
            {typedValue || 'Your Name'}
          </div>
        </div>
      )}

      {/* Upload mode */}
      {mode === 'upload' && (
        <div className="signature-upload-area">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            onChange={handleFileUpload}
            className="signature-upload-input"
          />
          {uploadError && (
            <p className="form-error-message">{uploadError}</p>
          )}
          {uploadPreview && (
            <div className="signature-upload-preview">
              <img
                src={uploadPreview}
                alt="Signature preview"
                style={{ maxWidth: CANVAS_WIDTH, maxHeight: CANVAS_HEIGHT, objectFit: 'contain' }}
              />
              <div className="signature-actions">
                <button type="button" className="btn-outline-sm" onClick={clearUpload}>
                  <Eraser />
                  Clear
                </button>
              </div>
            </div>
          )}
          {!uploadPreview && !uploadError && (
            <p className="signature-hint">Upload a PNG, JPEG, or WebP image of your signature</p>
          )}
        </div>
      )}
    </div>
  );
}
