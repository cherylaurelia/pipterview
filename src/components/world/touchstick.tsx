"use client";

import { useEffect, useRef, useState } from "react";
import { stick } from "./explore";

const RADIUS = 46;

/**
 * An on-screen joystick for walking on touch screens: drag the knob, and how far you push it sets the pace (all the
 * way to run). Only shown on devices whose main pointer is a finger. Tapping the ground to walk there still works too.
 */
export function TouchStick({ show }: { show: boolean }) {
  const [coarse, setCoarse] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const base = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);
  useEffect(() => {
    const q = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(q.matches);
    update();
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (show) return;
    stick.x = stick.y = 0;
  }, [show]);
  if (!show || !coarse) return null;

  const move = (clientX: number, clientY: number) => {
    const r = base.current!.getBoundingClientRect();
    let dx = clientX - (r.left + r.width / 2), dy = clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) {
      dx = (dx / d) * RADIUS;
      dy = (dy / d) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    stick.x = dx / RADIUS;
    stick.y = -dy / RADIUS; // up the screen is forwards
  };
  const release = () => {
    active.current = null;
    setKnob({ x: 0, y: 0 });
    stick.x = stick.y = 0;
  };
  return (
    <div
      ref={base}
      className="absolute bottom-20 left-5 z-20 h-[120px] w-[120px] touch-none rounded-full bg-[#fff8ec]/55 ring-1 ring-[#f0dfc2] backdrop-blur-sm"
      aria-label="Walk"
      onPointerDown={(e) => {
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => e.pointerId === active.current && move(e.clientX, e.clientY)}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div
        className="absolute top-1/2 left-1/2 h-12 w-12 rounded-full bg-[#ffd27a] shadow-[0_4px_12px_rgba(70,45,20,0.25)] ring-2 ring-white"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}
