// Hand-written signature pad (CLAUDE.md §14): Pointer Events on a canvas with
// `touch-action: none`, smoothed strokes, Clear. Each finished stroke exports
// the signature cropped to its ink as a transparent PNG data URL. Black ink on
// a white pad in both color schemes: it's ink for the PDF. Copy comes in
// through props.

import { useEffect, useRef } from 'preact/hooks';
import { inkBounds, padRect } from './trim.ts';

interface Point {
  x: number;
  y: number;
}

export interface SignaturePadProps {
  id: string;
  /** The current signature (PNG data URL), redrawn when the pad remounts. */
  value: string | null;
  onChange: (pngDataUrl: string | null) => void;
  labels: { pad: string; clear: string };
  /** Ids of text that describes the pad (instructions, errors). */
  describedBy?: string;
}

const LINE_WIDTH = 2.5;
const TRIM_PAD = 4;

export function SignaturePad({ id, value, onChange, labels, describedBy }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  // A signature from before this mount, kept under any new strokes.
  const base = useRef<HTMLImageElement | null>(null);
  const activePointer = useRef<number | null>(null);

  // Read back after every stroke (the ink crop), so ask for a CPU-backed canvas.
  const context = () => canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null;

  const repaint = () => {
    const canvas = canvasRef.current;
    const ctx = context();
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const image = base.current;
    if (image) {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const scale = Math.min(1, (w * 0.9) / image.width, (h * 0.8) / image.height);
      const iw = image.width * scale;
      const ih = image.height * scale;
      ctx.drawImage(image, (w - iw) / 2, (h - ih) / 2, iw, ih);
    }
    for (const stroke of strokes.current) drawStroke(ctx, stroke);
  };

  // Size the backing store to the element (sharp on high-DPI screens), and
  // repaint on resize, e.g. a phone rotating.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sizeToElement = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = Math.round(rect.width * dpr);
      const height = Math.round(rect.height * dpr);
      if (width === canvas.width && height === canvas.height) return;
      canvas.width = width;
      canvas.height = height;
      repaint();
    };
    sizeToElement();
    const observer = new ResizeObserver(sizeToElement);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Show the signature drawn on an earlier visit.
  useEffect(() => {
    if (!value || strokes.current.length > 0 || base.current) return;
    const image = new Image();
    image.onload = () => {
      base.current = image;
      repaint();
    };
    image.src = value;
  }, []);

  // Coalesced events have no currentTarget, so measure the canvas itself.
  const point = (e: PointerEvent, rect: DOMRect): Point => ({
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  });

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (activePointer.current !== null) return;
    e.preventDefault();
    activePointer.current = e.pointerId;
    const canvas = e.currentTarget as HTMLCanvasElement;
    canvas.setPointerCapture(e.pointerId);
    strokes.current.push([point(e, canvas.getBoundingClientRect())]);
    const ctx = context();
    const stroke = strokes.current.at(-1);
    if (ctx && stroke) drawStroke(ctx, stroke);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (activePointer.current !== e.pointerId) return;
    const stroke = strokes.current.at(-1);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!stroke || !rect) return;
    const events = e.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e]) stroke.push(point(ev, rect));
    // Redraw just this stroke's tail; earlier segments are already on the canvas.
    const ctx = context();
    if (ctx) drawStroke(ctx, stroke.slice(-events.length - 3));
  };

  const onPointerEnd = (e: PointerEvent) => {
    if (activePointer.current !== e.pointerId) return;
    activePointer.current = null;
    onChange(exportTrimmed(canvasRef.current));
  };

  const clear = () => {
    strokes.current = [];
    base.current = null;
    repaint();
    onChange(null);
  };

  return (
    <div class="signature-pad">
      <canvas
        id={id}
        ref={canvasRef}
        class="signature-canvas"
        role="img"
        aria-label={labels.pad}
        aria-describedby={describedBy}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      />
      <button type="button" class="button button-secondary" onClick={clear}>
        {labels.clear}
      </button>
    </div>
  );
}

/** Quadratic curves through the midpoints, for smooth strokes. */
function drawStroke(ctx: CanvasRenderingContext2D, points: readonly Point[]) {
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#000000';
  ctx.lineWidth = LINE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const [first] = points;
  if (!first) return;
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(first.x, first.y, LINE_WIDTH / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i] as Point;
    const next = points[i + 1] as Point;
    ctx.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
  }
  const last = points.at(-1) as Point;
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

/** The canvas cropped to its ink, as a PNG data URL; null when empty. */
function exportTrimmed(canvas: HTMLCanvasElement | null): string | null {
  const ctx = canvas?.getContext('2d', { willReadFrequently: true });
  if (!canvas || !ctx || canvas.width === 0 || canvas.height === 0) return null;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const ink = inkBounds(data, canvas.width, canvas.height);
  if (!ink) return null;
  const box = padRect(ink, TRIM_PAD, canvas.width, canvas.height);
  const out = document.createElement('canvas');
  out.width = box.width;
  out.height = box.height;
  out
    .getContext('2d')
    ?.drawImage(canvas, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
  const url = out.toDataURL('image/png');
  out.width = 0;
  out.height = 0;
  return url;
}
