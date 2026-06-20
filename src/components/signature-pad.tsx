"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";

type Point = { x: number; y: number };

export function SignaturePad({ name = "signature_data" }: { name?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [value, setValue] = useState("");
  const helpId = useId();
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const strokes = useRef<Point[][]>([]);
  const activeStroke = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function prepareCanvas() {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const width = canvas!.clientWidth;
      const height = canvas!.clientHeight;
      const pixelWidth = Math.round(width * ratio);
      const pixelHeight = Math.round(height * ratio);
      if (canvas!.width === pixelWidth && canvas!.height === pixelHeight) return;
      canvas!.width = pixelWidth;
      canvas!.height = pixelHeight;
      const context = canvas!.getContext("2d");
      context?.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (context) {
        context.lineCap = "round";
        context.lineJoin = "round";
        context.lineWidth = 2.4;
        context.strokeStyle = "#102d49";
        context.fillStyle = "#102d49";
      }
      hasInk.current = false;
      strokes.current = [];
      activeStroke.current = null;
      setValue("");
    }
    prepareCanvas();
    const observer = new ResizeObserver(prepareCanvas);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  function point(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
    const box = canvas.getBoundingClientRect();
    return { x: clientX - box.left, y: clientY - box.top };
  }

  function renderStrokes(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.4;
    context.strokeStyle = "#102d49";
    context.fillStyle = "#102d49";

    for (const stroke of strokes.current) {
      if (stroke.length === 1) {
        context.beginPath();
        context.arc(stroke[0].x, stroke[0].y, context.lineWidth / 2, 0, Math.PI * 2);
        context.fill();
        continue;
      }
      if (stroke.length < 2) continue;

      context.beginPath();
      context.moveTo(stroke[0].x, stroke[0].y);
      for (let index = 1; index < stroke.length - 1; index += 1) {
        const current = stroke[index];
        const next = stroke[index + 1];
        const midpoint = {
          x: (current.x + next.x) / 2,
          y: (current.y + next.y) / 2,
        };
        context.quadraticCurveTo(current.x, current.y, midpoint.x, midpoint.y);
      }
      const last = stroke[stroke.length - 1];
      context.lineTo(last.x, last.y);
      context.stroke();
    }
  }

  function appendPoint(canvas: HTMLCanvasElement, next: Point) {
    const strokeIndex = activeStroke.current;
    if (strokeIndex === null) return;
    const stroke = strokes.current[strokeIndex];
    const previous = stroke[stroke.length - 1];
    if (previous && Math.hypot(next.x - previous.x, next.y - previous.y) < 0.15) return;
    stroke.push(next);
    if (stroke.length > 1) hasInk.current = true;
    renderStrokes(canvas);
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const p = point(event.currentTarget, event.clientX, event.clientY);
    strokes.current.push([p]);
    activeStroke.current = strokes.current.length - 1;
    renderStrokes(event.currentTarget);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    event.preventDefault();
    const canvas = event.currentTarget;
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    for (const sample of coalesced) {
      appendPoint(canvas, point(canvas, sample.clientX, sample.clientY));
    }
  }

  function finish(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !canvasRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drawing.current = false;
    appendPoint(
      event.currentTarget,
      point(event.currentTarget, event.clientX, event.clientY),
    );
    activeStroke.current = null;
    setValue(hasInk.current ? canvasRef.current.toDataURL("image/png") : "");
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    strokes.current = [];
    activeStroke.current = null;
    setValue("");
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-white">
        <canvas ref={canvasRef} className="h-44 w-full touch-none cursor-crosshair" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} aria-label="Área para dibujar la firma" aria-describedby={helpId} />
        {!value && <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate-400"><PenLine className="size-5" /> Firme dentro del recuadro</div>}
      </div>
      <input type="hidden" name={name} value={value} required />
      <Button type="button" variant="outline" size="sm" onClick={clear}><Eraser className="size-4" /> Limpiar firma</Button>
      <p id={helpId} className="text-xs text-muted-foreground">Use mouse, pantalla táctil o lápiz. Podrá limpiar el trazo antes de confirmar.</p>
    </div>
  );
}
