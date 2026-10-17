"use client";

import { useEffect, useState } from "react";
import { Button } from "../ui";

const PHASES = ["Breathe in", "Hold", "Breathe out", "Hold"];
const PHASE_SECONDS = 4;
const ROUNDS = 4;

/**
 * Box breathing (4 in, 4 hold, 4 out, 4 hold): a quick, well-known way to
 * settle nerves. Used before starting and whenever the candidate pauses.
 */
export function Breathing({ title, onDone, doneLabel = "I'm ready" }: { title: string; onDone: () => void; doneLabel?: string }) {
  const [tick, setTick] = useState(0);
  // Start small so the first "breathe in" visibly grows.
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const start = setTimeout(() => setStarted(true), 50);
    const id = setInterval(() => setTick((t) => t + 1), PHASE_SECONDS * 1000);
    return () => {
      clearTimeout(start);
      clearInterval(id);
    };
  }, []);

  const phase = tick % PHASES.length;
  const finished = tick >= PHASES.length * ROUNDS;
  // The circle grows while breathing in, stays big while holding, shrinks while breathing out.
  const scale = started && (phase === 0 || phase === 1) ? 1 : 0.55;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-white/90 p-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex max-w-sm flex-col items-center text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-teal-700">{title}</p>
        <div className="relative my-10 grid h-56 w-56 place-items-center">
          <div
            className="absolute inset-0 rounded-full bg-teal-100"
            style={{ transform: `scale(${scale})`, transition: `transform ${PHASE_SECONDS}s ease-in-out` }}
          />
          <div
            className="absolute inset-6 rounded-full bg-teal-200/70"
            style={{ transform: `scale(${scale})`, transition: `transform ${PHASE_SECONDS}s ease-in-out` }}
          />
          <span className="relative text-2xl font-semibold tracking-tight text-teal-900" aria-live="polite">
            {finished ? "Nice." : PHASES[phase]}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-slate-600">
          {finished
            ? "Your heart rate has had a chance to settle. Go when you're ready."
            : "Follow the circle: in for four, hold for four, out for four, hold for four."}
        </p>
        <Button variant="primary" size="lg" className="mt-8" onClick={onDone}>
          {doneLabel}
        </Button>
      </div>
    </div>
  );
}
