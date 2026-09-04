'use client';

import { useRef, useState } from 'react';

type Vector = { x: number; y: number };

export function AimPad({
  onEngage,
  onVector,
  onTravel,
}: {
  onEngage: () => void;
  onVector?: (vector: Vector) => void;
  onTravel?: (dx: number, dy: number) => void;
}) {
  const last = useRef<Vector | null>(null);
  const pressed = useRef(false);
  const [knob, setKnob] = useState<Vector>({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const reset = () => {
    last.current = null;
    pressed.current = false;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    onVector?.({ x: 0, y: 0 });
  };

  const update = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' && !pressed.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = rect.width * .32;
    let x = (event.clientX - cx) / radius;
    let y = (event.clientY - cy) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    setKnob({ x, y });
    onVector?.({ x, y });
    if (last.current) onTravel?.(event.clientX - last.current.x, event.clientY - last.current.y);
    last.current = { x: event.clientX, y: event.clientY };
  };

  return (
    <div
      role="application"
      aria-label="右手瞄准操控区"
      className={`absolute bottom-5 right-5 z-30 size-[118px] rounded-full border-2 backdrop-blur-sm transition-colors ${active ? 'border-primary bg-primary/10' : 'border-white/25 bg-black/35'}`}
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') { setActive(true); last.current = { x: event.clientX, y: event.clientY }; onEngage(); } }}
      onPointerMove={update}
      onPointerDown={(event) => { pressed.current = true; setActive(true); event.currentTarget.setPointerCapture(event.pointerId); last.current = { x: event.clientX, y: event.clientY }; onEngage(); update(event); }}
      onPointerUp={reset}
      onPointerCancel={reset}
      onPointerLeave={(event) => { if (event.pointerType === 'mouse') reset(); }}
    >
      <div className="absolute inset-[13px] rounded-full border border-dashed border-white/20" />
      <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20" />
      <div
        className="absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-primary/80 bg-[#17201c] shadow-[0_0_22px_rgba(216,255,53,.22)]"
        style={{ marginLeft: knob.x * 32, marginTop: knob.y * 32 }}
      >
        <span className="size-2 rounded-full bg-primary" />
      </div>
      <span className="pointer-events-none absolute -top-6 right-0 whitespace-nowrap text-[11px] font-medium text-white/55">右手操控区</span>
    </div>
  );
}
