"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NERVOUSNESS_LABELS, loadHistory, type SessionRecord } from "@/lib/history";

/** A one-line summary of past practice for the home page; nothing shows for first-time visitors. */
export function ProgressSnapshot() {
  const [history, setHistory] = useState<SessionRecord[]>([]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser storage after mount
  useEffect(() => setHistory(loadHistory()), []);
  if (history.length === 0) return null;

  const withNerves = history.filter((h) => h.nervousBefore);
  const first = withNerves[0]?.nervousBefore;
  const latest = withNerves.at(-1)?.nervousBefore;

  return (
    <Link
      href="/progress"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-teal-50 px-5 py-4 text-sm text-teal-900 ring-1 ring-teal-100 transition hover:bg-teal-100/70"
    >
      <span>
        <span className="font-semibold">
          {history.length} practice session{history.length === 1 ? "" : "s"}
        </span>
        {first && latest && withNerves.length > 1 && (
          <span className="text-teal-800">
            {" "}
            · nerves before starting: {NERVOUSNESS_LABELS[first - 1].toLowerCase()} → {NERVOUSNESS_LABELS[latest - 1].toLowerCase()}
          </span>
        )}
      </span>
      <span className="font-medium">See your progress →</span>
    </Link>
  );
}
