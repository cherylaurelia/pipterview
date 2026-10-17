"use client";

import { useEffect, useState } from "react";

const format = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * Elapsed time against the round's usual length. Time pressure is part of
 * real interviews, so it shows in standard and realistic modes; gentle mode
 * hides it so the first reps stay low-stakes.
 */
export function RoundTimer({ running, targetMinutes, hidden }: { running: boolean; targetMinutes: number; hidden: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (hidden) return <span className="text-xs text-slate-400">No clock in gentle mode</span>;

  const target = targetMinutes * 60;
  const tone = elapsed > target ? "text-rose-600" : elapsed > target * 0.8 ? "text-amber-600" : "text-slate-600";
  return (
    <span className={`font-mono text-sm tabular-nums ${tone}`} title="Elapsed / typical length of this round">
      {format(elapsed)} <span className="text-slate-400">/ {targetMinutes}:00</span>
    </span>
  );
}
