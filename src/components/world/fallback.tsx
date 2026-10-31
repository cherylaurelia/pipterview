"use client";

import { Component, useEffect, useRef, type ReactNode } from "react";
import { PipLogo } from "./retro";
import type { WorldMode } from "./WorldScene";

// When the 3D island can't run (no WebGL on this device, or the scene crashed), practice still works: the interview,
// the panels and the report are all plain HTML. This stands in for the scene with a calm backdrop, and tells the page
// it has "arrived" wherever it's going, which the camera would otherwise do at the end of each flight.

/** Whether this browser can draw the 3D scene at all. */
export function canUseWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function SceneFallback({ mode, onArrive, reason }: { mode: WorldMode; onArrive: (mode: WorldMode) => void; reason: "unsupported" | "crashed" }) {
  const arrive = useRef(onArrive);
  useEffect(() => {
    arrive.current = onArrive;
  });
  // "arrive" once per change of place, as the camera would at the end of its flight
  useEffect(() => {
    const id = window.setTimeout(() => arrive.current(mode), 0);
    return () => window.clearTimeout(id);
  }, [mode]);
  return (
    <div className="absolute inset-0 bg-gradient-to-b from-[#f6efe2] via-[#efe6d3] to-[#e3edcf]">
      {/* Pip, waiting in the space the scene would fill (left of the side panel when you're at the table) */}
      <div className="absolute inset-y-0 left-0 flex items-center justify-center" style={{ right: "var(--panel-w, 0px)" }}>
        <PipLogo size={150} />
      </div>
      <p className="absolute bottom-20 left-4 max-w-[min(360px,80vw)] rounded-2xl bg-[#fff8ec]/90 px-4 py-2 text-[12.5px] text-[#6b5640] ring-1 ring-[#f0dfc2]">
        {reason === "unsupported" ? "This device can't show the 3D island, but practice works just the same." : "The 3D island hit a problem, but practice works just the same."}
      </p>
    </div>
  );
}

/** Catches a crash inside the 3D scene and shows `fallback` instead of a blank page. */
export class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("3D scene crashed", error);
  }
  render() {
    return this.state.crashed ? this.props.fallback : this.props.children;
  }
}
