"use client";

import { useEffect, useState, type ReactNode } from "react";
import { NavButton, Panel, Portrait, raised } from "./retro";
import { GUIDE_NAME } from "./script";
import type { ConvoStatus } from "./useConversation";

// Help for first-time visitors: a short tour in Pip's voice (one bubble per place: the welcome window, the island, the
// table, and after your first session), a friendly ask before the browser's microphone prompt, a big plain-words banner
// saying whose turn it is, and a help window with the controls.

export const TOUR_STEPS = ["welcome", "island", "table", "grow"] as const;
export type TourStep = (typeof TOUR_STEPS)[number];

const TOUR_KEY = "pip:tour";
const MIC_KEY = "pip:mic";

export function loadTourDone(): TourStep[] {
  try {
    return JSON.parse(window.localStorage.getItem(TOUR_KEY) ?? "[]") as TourStep[];
  } catch {
    return [...TOUR_STEPS]; // storage blocked: don't nag on every visit
  }
}
export function saveTourDone(done: TourStep[]) {
  try {
    window.localStorage.setItem(TOUR_KEY, JSON.stringify(done));
  } catch {
    // Not remembered; fine.
  }
}

/** Whether we've already asked about the microphone (and what you chose). */
export function micChoice(): "mic" | "typing" | null {
  try {
    return window.localStorage.getItem(MIC_KEY) as "mic" | "typing" | null;
  } catch {
    return "mic";
  }
}
export function saveMicChoice(choice: "mic" | "typing") {
  try {
    window.localStorage.setItem(MIC_KEY, choice);
  } catch {
    // Not remembered; fine.
  }
}

const TOUR_TEXT: Record<TourStep, ReactNode> = {
  welcome: (
    <>
      Hi, I&apos;m {GUIDE_NAME}! Getting yourself to prep is the hard part, so we&apos;ll start small. Press <b>Start practising</b> for a
      gentle warm-up, or choose a round.
    </>
  ),
  island: (
    <>
      This is our island. Drag to look around and scroll to zoom. When you&apos;re ready, press <b>Sit down</b> and we&apos;ll start.
    </>
  ),
  table: (
    <>
      Just talk to me, or type below. When you pause, I&apos;ll take that as your answer. Need time? Press <b>I need a moment</b>.
      Press <b>Space</b> to talk, and <b>?</b> for help.
    </>
  ),
  grow: (
    <>
      You did it, and starting was the hardest part. Every session grows something on our island, and your stories are saved
      under <b>Stories</b>. An extra view a day keeps the spirals away. See you tomorrow?
    </>
  ),
};

/** One tour bubble: Pip, a line of help, and a way to move on or skip the rest. */
export function TourBubble({ step, onNext, onSkip, className = "" }: { step: TourStep; onNext: () => void; onSkip: () => void; className?: string }) {
  const last = step === "grow";
  return (
    <Panel title={`${GUIDE_NAME} says`} tone="active" className={`w-[min(340px,calc(100vw-2rem))] lowercase ${className}`}>
      <div className="flex gap-2.5 px-2 pt-2 pb-2.5">
        <Portrait size={44} />
        <p className="text-[13.5px] leading-snug text-[#1b1d22]">{TOUR_TEXT[step]}</p>
      </div>
      <div className="flex items-center justify-end gap-2 px-1.5 pb-1">
        {!last && (
          <button onClick={onSkip} className="mr-auto text-[12px] text-[#55534e] underline underline-offset-2">
            Skip the tour
          </button>
        )}
        <NavButton tone="yellow" onClick={onNext} className="px-3">
          Got it
        </NavButton>
      </div>
    </Panel>
  );
}

/** Asked once, before the browser's own microphone prompt, so it isn't a surprise. */
export function MicPrimer({ onMic, onType }: { onMic: () => void; onType: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#3d2a1c]/20 px-4">
      <Panel title="Can I hear you?" tone="active" className="w-[min(420px,100%)]">
        <div className="flex gap-3 px-3 pt-3 pb-2">
          <Portrait size={56} />
          <div className="space-y-2 text-[13.5px] leading-snug text-[#1b1d22]">
            <p>Knowing the answer is one thing; saying it out loud is another. That&apos;s what we practise here. Your browser will ask to use your microphone next.</p>
            <p className="text-[12.5px] text-[#55534e]">
              Your browser turns speech into text (Chrome uses Google&apos;s speech service); {GUIDE_NAME} only sees the text. Headphones
              help, so {GUIDE_NAME}&apos;s voice doesn&apos;t end up in your answer.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-2 pb-2">
          <NavButton onClick={onType}>I&apos;ll type instead</NavButton>
          <NavButton tone="yellow" onClick={onMic}>
            Use my microphone
          </NavButton>
        </div>
      </Panel>
    </div>
  );
}

/** A big, plain-words line saying whose turn it is, over the middle of the scene. */
export function StatusBanner({ status, handsFree, holding }: { status: ConvoStatus; handsFree: boolean; holding: boolean }) {
  const lines: Partial<Record<ConvoStatus, { text: string; dot: string; pulse?: boolean }>> = {
    connecting: { text: `${GUIDE_NAME} is getting settled…`, dot: "#f2c94c", pulse: true },
    thinking: { text: `${GUIDE_NAME} is thinking…`, dot: "#f2c94c", pulse: true },
    speaking: { text: `${GUIDE_NAME} is talking`, dot: "#4a7bd0" },
    "your-turn": { text: "Your turn: press Talk (or Space), or type", dot: "#5aa65a" },
    listening: {
      text: holding ? "Take your time. I'm listening." : handsFree ? "I'm listening. Just talk, and pause when you're done." : "I'm listening. Press Done (or Space) when you've finished.",
      dot: "#d9534f",
      pulse: true,
    },
    scoring: { text: `${GUIDE_NAME} is writing your feedback…`, dot: "#f2c94c", pulse: true },
  };
  const line = lines[status];
  if (!line) return null;
  return (
    // centred in the space left of the side panel (its width comes in as --panel-w)
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-4 sm:top-5 sm:right-[var(--panel-w,440px)]">
      <p
        role="status"
        aria-live="polite"
        className="flex max-w-[min(480px,100%)] items-center gap-2.5 rounded-full bg-[#fff8ec]/95 px-5 py-2.5 text-[15px] font-bold leading-snug text-[#3d2a1c]"
        style={{ boxShadow: raised.boxShadow }}
      >
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${line.pulse ? "animate-pulse" : ""}`} style={{ background: line.dot }} />
        {line.text}
      </p>
    </div>
  );
}

const HELP: [string, ReactNode][] = [
  ["Start", <>Press <b>Sit down</b> or click the table. {GUIDE_NAME} says hello and asks the first question.</>],
  ["Answer", <>Talk out loud, or type in the box. With <b>Auto-send: on</b>, a pause sends your answer; saying &ldquo;that&apos;s my answer&rdquo; sends it right away.</>],
  ["Need time", <>Press <b>I need a moment</b> and {GUIDE_NAME} waits until you speak again. Asking for a moment is normal in real interviews too.</>],
  ["Keys", <><b>Space</b>: talk, or send now while talking. <b>Esc</b>: close windows.</>],
  ["Finish", <>Press <b>Finish</b> any time for feedback. Every finished session grows something on your island.</>],
  ["Look around", <>Drag to look around and scroll to zoom, on the island and at the table.</>],
  ["Stories", <>The stories you tell are saved here, with tips. If you freeze, {GUIDE_NAME} can remind you of one.</>],
  ["Sound", <><b>Mute {GUIDE_NAME}</b> to read instead of listen; <b>Sound</b> in the dock sets the volumes.</>],
];

const AI_LABEL: Record<string, string> = {
  live: "Claude (live)",
  mock: "Practice script (MOCK_AI is on)",
  "missing-key": "Not set up: add ANTHROPIC_API_KEY",
};
const VOICE_LABEL: Record<string, string> = { elevenlabs: "ElevenLabs", browser: "Your browser's voice" };

/** Which interviewer and voice the server is using, so you can tell whether your setup worked. */
function SetupStatus() {
  const [status, setStatus] = useState<{ ai: string; voice: string } | null>(null);
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);
  if (!status) return null;
  return (
    <div className="mt-3 rounded-2xl bg-white/70 px-3 py-2.5 text-[12.5px] text-[#6b5640] ring-1 ring-[#ead8b8]">
      <p>
        <b className="text-[#4a3424]">Interviewer:</b> {AI_LABEL[status.ai] ?? status.ai}
      </p>
      <p>
        <b className="text-[#4a3424]">Voice:</b> {VOICE_LABEL[status.voice] ?? status.voice}
      </p>
    </div>
  );
}

/** The controls, in one place. */
export function HelpPanel({ onReplayTour }: { onReplayTour: () => void }) {
  return (
    <div className="retro-scroll min-h-0 flex-1 overflow-y-auto">
      <dl className="space-y-2.5 px-1 py-1 text-[13.5px] leading-snug">
        {HELP.map(([label, text]) => (
          <div key={label} className="flex gap-3">
            <dt className="w-[86px] shrink-0 font-bold text-[#4a3424]">{label}</dt>
            <dd className="text-[#3d2a1c]">{text}</dd>
          </div>
        ))}
      </dl>
      <SetupStatus />
      <div className="flex justify-end px-1 pt-3">
        <NavButton onClick={onReplayTour}>Show the tour again</NavButton>
      </div>
    </div>
  );
}
