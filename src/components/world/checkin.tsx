"use client";

import { useEffect, useState } from "react";
import { NervousnessScale } from "../room/NervousnessScale";
import { NavButton, Panel, Portrait } from "./retro";
import { GUIDE_NAME } from "./script";

// Before the first question, at the table: one tap for how nervous you are (kept with the session, so the report and
// your progress can show nerves falling with practice), and, if you'd like, a minute of box breathing with Pip, who
// breathes along with you in the scene.

/** When the breathing started (performance.now()), so Pip in the scene can breathe in time with the circle. */
export const breathing = { start: 0 };

/** Box breathing: in for four, hold for four, out for four, hold for four. */
export const BREATH_PHASES = ["Breathe in", "Hold", "Breathe out", "Hold"] as const;
export const BREATH_PHASE_SECONDS = 4;
const ROUNDS = 3;

/** How full of breath you are at `seconds` into box breathing, 0 to 1: rising, held, falling, held. */
export function breathAt(seconds: number) {
  const phase = Math.floor(seconds / BREATH_PHASE_SECONDS) % 4, k = (seconds % BREATH_PHASE_SECONDS) / BREATH_PHASE_SECONDS;
  const ease = k * k * (3 - 2 * k);
  return phase === 0 ? ease : phase === 1 ? 1 : phase === 2 ? 1 - ease : 0;
}

/** "How are you feeling?": one tap carries on; a high number offers a breather first. */
export function CheckIn({ onDone, onBreathe }: { onDone: (nervous: number | null) => void; onBreathe: (nervous: number | null) => void }) {
  const [level, setLevel] = useState<number>();
  const high = (level ?? 0) >= 4;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#3d2a1c]/15 px-4">
      <Panel title="Before we start" className="w-[min(460px,100%)]">
        <div className="flex gap-3 px-3 pt-2 pb-3">
          <Portrait size={52} />
          <p className="text-[13.5px] leading-snug text-[#1b1d22]">
            {high
              ? "That's okay, and honestly normal. Want to breathe together for a minute first? It really does help."
              : "Quick check-in. There's no right answer, and it helps us see your nerves settle as you practise."}
          </p>
        </div>
        <div className="px-3 pb-3">
          <NervousnessScale
            label="How are you feeling right now?"
            value={level}
            onChange={(v) => {
              setLevel(v);
              if (v < 4) onDone(v); // one tap and we're off
            }}
          />
        </div>
        <div className="flex items-center justify-end gap-2 px-2 pb-2">
          {high ? (
            <>
              <NavButton onClick={() => onDone(level ?? null)}>I&apos;m ready</NavButton>
              <NavButton tone="yellow" onClick={() => onBreathe(level ?? null)}>
                Yes, let&apos;s breathe
              </NavButton>
            </>
          ) : (
            <>
              <button onClick={() => onDone(null)} className="mr-auto px-2 text-[12.5px] text-[#8a6a4a] underline-offset-2 hover:underline">
                Skip
              </button>
              <NavButton onClick={() => onBreathe(level ?? null)}>Breathe with {GUIDE_NAME} first</NavButton>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}

/**
 * A minute of box breathing at the table: a soft circle to follow, in the corner so you can see Pip breathing along.
 * Done when you say so, or after three rounds.
 */
export function BreatheWithPip({ onDone }: { onDone: () => void }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    breathing.start = performance.now();
    const id = window.setInterval(() => setSeconds((performance.now() - breathing.start) / 1000), 100);
    return () => window.clearInterval(id);
  }, []);
  const finished = seconds >= BREATH_PHASE_SECONDS * 4 * ROUNDS;
  const phase = Math.floor(seconds / BREATH_PHASE_SECONDS) % 4;
  const scale = 0.55 + breathAt(seconds) * 0.45;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-end justify-center px-4 pb-24 sm:items-center sm:justify-start sm:pb-0 sm:pl-10">
      <div className="pointer-events-auto flex w-[260px] flex-col items-center rounded-[24px] bg-[#fff8ec]/90 px-5 pt-4 pb-4 text-center shadow-[0_12px_32px_rgba(70,45,20,0.2)] ring-1 ring-[#f0dfc2] backdrop-blur" role="dialog" aria-label={`Breathe with ${GUIDE_NAME}`}>
        <div className="relative my-3 grid h-40 w-40 place-items-center">
          <div className="absolute inset-0 rounded-full bg-[#ffe6b0]" style={{ transform: `scale(${scale})` }} />
          <div className="absolute inset-5 rounded-full bg-[#ffd27a]/70" style={{ transform: `scale(${scale})` }} />
          <span className="relative text-[19px] font-bold text-[#4a3424]" aria-live="polite">
            {finished ? "Nice." : BREATH_PHASES[phase]}
          </span>
        </div>
        <p className="text-[12.5px] leading-snug text-[#6b5640]">
          {finished ? "Your heart's had a moment to settle. Go when you're ready." : `In for four, hold, out for four, hold. ${GUIDE_NAME} will breathe with you.`}
        </p>
        <NavButton tone="yellow" onClick={onDone} className="mt-3">
          I&apos;m ready
        </NavButton>
      </div>
    </div>
  );
}
