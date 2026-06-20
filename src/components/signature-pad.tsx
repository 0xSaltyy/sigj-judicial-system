"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignaturePad({ name = "signature_data" }: { name?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [value, setValue] = useState("");
  const helpId = useId();
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

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
        context.strokeStyle = "#102d49";
      }
      hasInk.current = false;
      lastPoint.current = null;
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

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const context = event.currentTarget.getContext("2d");
    const p = point(event.currentTarget, event.clientX, event.clientY);
    lastPoint.current = p;
    context?.beginPath();
    context?.moveTo(p.x, p.y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    event.preventDefault();
    const canvas = event.currentTarget;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    for (const sample of coalesced) {
      const current = point(canvas, sample.clientX, sample.clientY);
      const previous = lastPoint.current;
      if (!previous) {
        lastPoint.current = current;
        continue;
      }
      const midpoint = {
        x: (previous.x + current.x) / 2,
        y: (previous.y + current.y) / 2,
      };
      const pressure = sample.pressure > 0 ? sample.pressure : 0.5;
      context.lineWidth = 1.5 + pressure * 1.8;
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.quadraticCurveTo(previous.x, previous.y, midpoint.x, midpoint.y);
      context.stroke();
      lastPoint.current = current;
      hasInk.current = true;
    }
  }

  function finish(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !canvasRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drawing.current = false;
    lastPoint.current = null;
    setValue(hasInk.current ? canvasRef.current.toDataURL("image/png") : "");
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    lastPoint.current = null;
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
