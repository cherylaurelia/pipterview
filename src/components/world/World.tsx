"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { GARDEN_ITEMS, gardenItem, growGarden, loadGarden, markGardenSeen, streakDays, type Garden } from "@/lib/garden";
import type { Intensity, SessionLength } from "@/lib/interview/types";
import { loadStories, storyLines, type SavedStory } from "@/lib/stories";
import type { CodeLanguage, WorkspaceSnapshot } from "@/lib/workspace/types";
import { FeedbackReport } from "../FeedbackReport";
import { isTailored, toProfile, useSavedProfile } from "../ProfileForm";
import { useSessionSettings } from "../room/SessionSetup";
import { ChatPanel, CodePanel } from "./panels";
import { ResumeStep } from "./resume";
import { HelpPanel, MicPrimer, StatusBanner, TOUR_STEPS, TourBubble, loadTourDone, micChoice, saveMicChoice, saveTourDone, type TourStep } from "./onboarding";
import { createAmbience, type Ambience } from "./sound";
import { setVoiceVolume } from "@/lib/voice/speak";
import { BookIcon, ChatIcon, CodeIcon, HelpIcon, HomeIcon, IslandIcon, SpeakerIcon } from "./icons";
import { IslandPanel } from "./islandpanel";
import { StoryBook } from "./storybook";
import { GardenIcon } from "../GardenIcon";
import { RoundIcon } from "../RoundIcon";
import { NavButton, Panel, PipLogo, uiFont } from "./retro";
import { GUIDE_NAME, PREP_LABELS, PREP_TYPES, type PrepType } from "./script";
import { useConversation } from "./useConversation";
import type { Mood } from "./people";
import type { WorldMode } from "./WorldScene";

const WorldScene = dynamic(() => import("./WorldScene"), { ssr: false, loading: () => <div className="absolute inset-0 bg-[#dfe9f3]" /> });

const PREP_BLURB: Record<PrepType, string> = {
  behavioral: "The stories you've lived but haven't said out loud yet.",
  technical: "One problem, a real editor, and room to think out loud.",
  resume: "The random things on your resume you hope they skip.",
};

const PRESSURE: { value: Intensity; label: string }[] = [
  { value: "gentle", label: "Gentle" },
  { value: "standard", label: "Standard" },
  { value: "realistic", label: "Realistic" },
];
const LENGTH: { value: SessionLength; label: string }[] = [
  { value: "quick", label: "1 question" },
  { value: "full", label: "Full round" },
];

/** A row of pick-one buttons in the window style. */
function Toggle<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[70px] shrink-0 text-[12.5px] font-bold text-[#3c3a36]">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <NavButton key={o.value} tone={o.value === value ? "yellow" : "plain"} aria-pressed={o.value === value} onClick={() => onChange(o.value)} className="px-2.5 py-0.5 text-[12.5px]">
            {o.label}
          </NavButton>
        ))}
      </div>
    </div>
  );
}

/** A little plant that grows while you practise, in place of a ticking clock. */
function Sprout({ minutes }: { minutes: number }) {
  const stage = minutes < 2 ? 0 : minutes < 5 ? 1 : minutes < 10 ? 2 : 3;
  const top = [10, 7, 5, 4][stage];
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden className="shrink-0">
      <path d="M4 13 h6 l-1 3 h-4 z" fill="#c9785d" />
      <path d={`M7 13 V${top}`} stroke="#5f8f45" strokeWidth="1.4" />
      <path d="M7 11 q-3 -0.5 -3.5 -3 q3 0 3.5 3 M7 11 q3 -0.5 3.5 -3 q-3 0 -3.5 3" fill="#7fb05a" />
      {stage >= 2 && <path d="M7 8 q-2.5 -0.5 -3 -2.6 q2.6 0 3 2.6 M7 8 q2.5 -0.5 3 -2.6 q-2.6 0 -3 2.6" fill="#8cc063" />}
      {stage === 3 && (
        <g>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={7 + Math.cos((a * Math.PI) / 180) * 1.8} cy={top + Math.sin((a * Math.PI) / 180) * 1.8} r="1.3" fill="#f6b6c8" />
          ))}
          <circle cx="7" cy={top} r="1.1" fill="#f5d43c" />
        </g>
      )}
    </svg>
  );
}

const SOUND_KEY = "extraview:sound";
const VOLUME_KEY = "pip:volume";

/** Volumes, 0 to 1: the music, the birds and breeze, and Pip's voice. */
export interface SoundLevels {
  music: number;
  nature: number;
  voice: number;
}
const DEFAULT_LEVELS: SoundLevels = { music: 0.7, nature: 0.7, voice: 1 };

/**
 * The soundscape, on unless you've turned it off. Browsers only allow audio after you've interacted with the page, so
 * it starts on your first click or key press.
 */
function useAmbience(state: { listening: boolean; speaking: boolean; evening: boolean }) {
  const [enabled, setEnabledState] = useState(true);
  const [levels, setLevelsState] = useState<SoundLevels>(DEFAULT_LEVELS);
  const [interacted, setInteracted] = useState(false);
  const ambience = useRef<Ambience | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved choice once
      if (window.localStorage.getItem(SOUND_KEY) === "off") setEnabledState(false);
      const saved = window.localStorage.getItem(VOLUME_KEY);
      if (saved) setLevelsState({ ...DEFAULT_LEVELS, ...(JSON.parse(saved) as Partial<SoundLevels>) });
    } catch {
      // Storage blocked; sound stays on.
    }
    const first = () => setInteracted(true);
    window.addEventListener("pointerdown", first, { once: true });
    window.addEventListener("keydown", first, { once: true });
    return () => {
      window.removeEventListener("pointerdown", first);
      window.removeEventListener("keydown", first);
    };
  }, []);

  useEffect(() => {
    if (!interacted || !enabled || ambience.current) return;
    try {
      ambience.current = createAmbience();
    } catch {
      // No Web Audio here; the world stays quiet.
    }
  }, [interacted, enabled]);
  useEffect(
    () => () => {
      ambience.current?.dispose();
      ambience.current = null; // StrictMode remounts: let the next mount build a fresh one
    },
    [],
  );

  useEffect(() => {
    ambience.current?.setEnabled(enabled);
  }, [enabled, interacted]);
  useEffect(() => {
    ambience.current?.setVolumes({ music: levels.music, nature: levels.nature });
    setVoiceVolume(levels.voice);
  }, [levels, interacted, enabled]);
  const { listening, speaking, evening } = state;
  useEffect(() => {
    ambience.current?.setState({ listening, speaking, evening });
  }, [listening, speaking, evening, interacted, enabled]);

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    try {
      window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
    } catch {
      // Not remembered; fine.
    }
  }, []);
  const setLevels = useCallback((next: SoundLevels) => {
    setLevelsState(next);
    try {
      window.localStorage.setItem(VOLUME_KEY, JSON.stringify(next));
    } catch {
      // Not remembered; fine.
    }
  }, []);
  return { enabled, setEnabled, levels, setLevels, ambience };
}

type PanelTab = "chat" | "code" | "island" | "stories" | "help";

/** A button in the dock along the bottom: an icon and a word. */
function DockButton({ icon, label, active = false, onClick, title }: { icon: ReactNode; label: string; active?: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13.5px] font-bold text-[#4a3424] transition-colors ${active ? "bg-[#ffe1a1]" : "hover:bg-[#fff0d4]"}`}
    >
      {icon}
      {label}
    </button>
  );
}

/** One volume slider, in the sound window. */
function Slider({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-3 text-[13px] ${disabled ? "opacity-50" : ""}`}>
      <span className="w-[86px] shrink-0 font-bold text-[#1b1d22]">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="min-w-0 flex-1 accent-[#e8a93b]"
        aria-label={`${label} volume`}
      />
      <span className="w-9 text-right font-mono text-[12px] text-[#55534e]">{Math.round(value * 100)}%</span>
    </label>
  );
}

/**
 * The 3D practice world: a welcome window over the scene where you pick a kind of prep, then the open field with you
 * and your guide at a table. Click the table and the camera takes your seat; a real conversation with the
 * interviewer starts (spoken and typed), with the editor alongside for technical rounds.
 */
export default function World() {
  const [mode, setMode] = useState<WorldMode>("splash");
  const [arrived, setArrived] = useState<WorldMode | null>(null);
  const [type, setType] = useState<PrepType>("technical");
  const [step, setStep] = useState<"pick" | "resume" | "context">("pick"); // context: "about you", opened from Customize
  const [elapsed, setElapsed] = useState(0);
  const [showClock, setShowClock] = useState(false); // the session clock stays hidden unless you ask for it
  const [customizing, setCustomizing] = useState(false);
  // after you finish: a few seconds of sunset before the report opens, and you can close it to keep watching
  const [lingered, setLingered] = useState(false);
  const [watchingSunset, setWatchingSunset] = useState(false);
  const [settings, setSettings] = useSessionSettings();
  const [profileDraft, setProfileDraft] = useSavedProfile();
  // what you've grown on the island, and the stories you've told (both kept in this browser)
  const [garden, setGarden] = useState<Garden>({ grown: 0, seen: 0, log: [] });
  const [grewNow, setGrewNow] = useState<ReturnType<typeof gardenItem> | null>(null);
  const [stories, setStories] = useState<SavedStory[]>([]);
  // the one side panel: chat and code while you're at the table; stories and help any time
  const [panel, setPanel] = useState<PanelTab | null>(null);
  const [poked, setPoked] = useState(false);
  // first-visit help: which tour bubbles you've seen (null until loaded, so nothing flashes), the help window, and the
  // one-time "can I hear you?" before the browser's microphone prompt
  const [tourDone, setTourDone] = useState<TourStep[] | null>(null);
  const [soundOpen, setSoundOpen] = useState(false);
  const [micAsk, setMicAsk] = useState(false);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- restore saved progress once */
    setGarden(loadGarden());
    setStories(loadStories());
    setTourDone(loadTourDone());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // your code and its latest test run, sent to the guide with an answer whenever either has changed
  const code = useRef<{
    text: string | null;
    language: CodeLanguage;
    run: { summary: string; code: string } | null;
    sentKey: string | null;
    questionId: string | null;
  }>({ text: null, language: "python", run: null, sentKey: null, questionId: null });
  const snapshot = useCallback((): WorkspaceSnapshot | undefined => {
    const c = code.current;
    if (type !== "technical" || !c.text || !c.questionId) return undefined;
    const run = c.run ? `${c.run.summary}${c.run.code !== c.text ? "\n(The code has changed since this run.)" : ""}` : undefined;
    return { kind: "code", questionId: c.questionId, language: c.language, code: c.text, run };
  }, [type]);
  const getWork = useCallback((): WorkspaceSnapshot | undefined => {
    const work = snapshot();
    if (!work || work.kind !== "code") return undefined;
    const key = `${work.language}:${work.code}:${work.run ?? ""}`;
    if (key === code.current.sentKey) return undefined;
    code.current.sentKey = key;
    return work;
  }, [snapshot]);
  const getFinalWork = useCallback(() => {
    const work = snapshot();
    return work ? [work] : [];
  }, [snapshot]);

  const convo = useConversation(type, {
    // your saved stories go to the guide (not for coding rounds), so it can nudge you towards one if you blank
    settings: { ...settings, interviewerName: GUIDE_NAME, ...(type !== "technical" && stories.length ? { stories: storyLines(stories) } : {}) },
    // optional context (resume, job posting) shapes the non-coding rounds when you've added some
    profile: type !== "technical" && isTailored(profileDraft) ? toProfile(profileDraft) : undefined,
    getWork,
    getFinalWork,
  });
  const { start, reset, status } = convo;
  const seated = mode === "seated" && arrived === "seated";
  const tableTab: PanelTab = type === "technical" ? "code" : "chat"; // what the side panel shows when you sit down
  // the guide's body language: nods while you talk, tilts its head while thinking, bounces when you're done
  const mood: Mood =
    poked ? "happy"
    : status === "speaking" ? "speaking"
    : status === "listening" || status === "your-turn" ? "listening"
    : status === "thinking" || status === "connecting" ? "thinking"
    : status === "scoring" || status === "report" ? "happy"
    : "idle";
  const evening = status === "scoring" || status === "report";
  const yourTurn = seated && (status === "your-turn" || status === "listening");
  const sound = useAmbience({ listening: status === "listening", speaking: status === "speaking", evening });

  // a soft pop for each new thing the guide says, and a chime when it's your turn
  const guideLines = convo.messages.filter((m) => m.from === "guide").length;
  useEffect(() => {
    if (guideLines > 0) sound.ambience.current?.pop();
  }, [guideLines, sound.ambience]);
  useEffect(() => {
    if (yourTurn) sound.ambience.current?.chime();
  }, [yourTurn, sound.ambience]);

  // a few seconds into the sunset: something new grows on your island, and the report opens
  useEffect(() => {
    if (status !== "report") return;
    const id = window.setTimeout(() => {
      setGrewNow(gardenItem(loadGarden().grown));
      setGarden(growGarden(type));
      setLingered(true);
    }, 2500);
    return () => clearTimeout(id);
  }, [status, type]);

  // back at the island: new things pop in, then count as seen
  const viewingIsland = mode === "splash" || (mode === "world" && arrived === "world");
  useEffect(() => {
    if (!viewingIsland || garden.grown <= garden.seen) return;
    const id = window.setTimeout(() => setGarden(markGardenSeen()), 2500 + (garden.grown - garden.seen) * 600);
    return () => clearTimeout(id);
  }, [viewingIsland, garden.grown, garden.seen]);
  const streak = garden.log.length ? streakDays(garden.log) : 0; // (the log is empty when prerendering, so no clock read then)

  // the tour bubble for where you are, if you haven't seen it
  const tourStep: TourStep | null = (() => {
    if (!tourDone || micAsk || panel === "help") return null;
    const open = (step: TourStep) => !tourDone.includes(step);
    if (mode === "splash" && step === "pick" && open("welcome")) return "welcome";
    if (mode === "world" && arrived === "world" && open("island")) return "island";
    if (seated && open("table")) return "table";
    if (mode === "world" && arrived === "world" && garden.grown > 0 && open("grow")) return "grow";
    return null;
  })();
  const finishTourStep = (stepDone: TourStep) => {
    const done = [...(tourDone ?? []), stepDone];
    setTourDone(done);
    saveTourDone(done);
  };
  const skipTour = () => {
    setTourDone([...TOUR_STEPS]);
    saveTourDone([...TOUR_STEPS]);
  };

  // keys: Space talks (or sends, while you're talking) when you're not typing somewhere; Esc closes windows
  const { canTalk, toggleTalk } = convo;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPanel((p) => (seated ? (p === "stories" || p === "help" ? tableTab : p) : null));
        setSoundOpen(false);
        return;
      }
      if (e.code !== "Space" || e.repeat || !seated || micAsk) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable], .monaco-editor")) return;
      if (!canTalk || !(status === "your-turn" || status === "speaking" || status === "listening")) return;
      e.preventDefault();
      void toggleTalk();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [seated, micAsk, canTalk, status, toggleTalk, tableTab]);

  const pokePip = () => {
    sound.ambience.current?.chirp();
    setPoked(true);
    window.setTimeout(() => setPoked(false), 1300);
  };
  const toggleTab = (tab: "island" | "stories" | "help") => {
    if (tab === "stories") setStories(loadStories());
    setPanel((p) => (p === tab ? (seated ? tableTab : null) : tab));
  };

  useEffect(() => {
    code.current = { text: null, language: "python", run: null, sentKey: null, questionId: convo.question?.id ?? null };
  }, [convo.question?.id]);

  const onArrive = useCallback(
    (m: WorldMode) => {
      setArrived(m);
      if (m !== "seated" || status !== "idle") return;
      // the first time, ask about the microphone before the browser does; then the guide says hello
      const speech = "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
      if (speech && micChoice() === null) setMicAsk(true);
      else start();
    },
    [start, status],
  );
  const chooseMic = async () => {
    setMicAsk(false);
    saveMicChoice("mic");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); // the browser's own prompt, now expected
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      void convo.setHandsFree(false); // no mic after all: typing works, and Talk is still there to retry
    }
    start();
  };
  const typeInstead = () => {
    setMicAsk(false);
    saveMicChoice("typing");
    void convo.setHandsFree(false);
    start();
  };

  useEffect(() => {
    if (!seated) return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [seated]);

  const choose = (t: PrepType) => {
    setType(t);
    if (t === "resume" && !isTailored(profileDraft)) return setStep("resume"); // offer (not require) a resume first
    setMode("world");
  };
  const sitDown = () => {
    setPanel(tableTab);
    setMode("seated");
  };
  const standUp = () => {
    reset();
    setElapsed(0);
    setArrived(null);
    setPanel(null);
    setLingered(false);
    setWatchingSunset(false);
    setGrewNow(null);
    setStories(loadStories()); // the report just saved this session's stories
    setMode("world");
  };

  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const gentle = settings.intensity === "gentle";

  const lastGuideLine = [...convo.messages].reverse().find((m) => m.from === "guide")?.text;
  const nextItem = gardenItem(garden.grown); // what finishing the next session grows
  const wide = seated && panel === "code";
  const showPanel = seated ? true : panel !== null;
  const tabs: { id: PanelTab; label: string; icon: ReactNode }[] = [
    ...(seated ? [{ id: "chat" as const, label: "Chat", icon: <ChatIcon /> }] : []),
    ...(seated && type === "technical" ? [{ id: "code" as const, label: "Code", icon: <CodeIcon /> }] : []),
    { id: "island", label: "Island", icon: null },
    { id: "stories", label: `Stories${stories.length ? ` (${stories.length})` : ""}`, icon: null },
    { id: "help", label: "Help", icon: null },
  ];
  const goHome = () => {
    if (mode === "seated") standUp();
    setPanel(null);
    setStep("pick");
    setMode("splash");
  };
  const chatProps = {
    messages: convo.messages,
    status: convo.status,
    liveText: convo.liveText,
    notice: convo.notice,
    error: convo.error,
    canTalk: convo.canTalk,
    muted: convo.muted,
    handsFree: convo.handsFree,
    silenceProgress: convo.silenceProgress,
    holding: convo.holding,
    onKeepThinking: convo.keepThinking,
    onHandsFree: (on: boolean) => void convo.setHandsFree(on),
    onTyping: convo.noteActivity,
    onAnswer: convo.answer,
    onTalk: convo.toggleTalk,
    onMute: convo.toggleMute,
    onRetry: convo.retry,
  };

  return (
    <div
      className={`retro-ui fixed inset-0 overflow-hidden bg-[#e9e2da] text-[#3d2a1c] ${uiFont}`}
      // the side panel's width, so the status banner can centre itself in the space left over
      style={{ "--panel-w": seated ? (wide ? "min(680px, 56vw)" : "440px") : "0px" } as CSSProperties}
    >
      <div className="absolute inset-0">
        <WorldScene
          mode={mode}
          mood={mood}
          yourTurn={yourTurn}
          evening={evening}
          aside={seated ? (wide ? 0.32 : 0.16) : 0}
          garden={{ count: viewingIsland ? garden.grown : garden.seen, freshFrom: garden.seen }}
          onPokePip={pokePip}
          onSit={sitDown}
          onArrive={onArrive}
        />
      </div>

      {/* 1. the welcome card: one big way to start, or choose a round. Centred in the space above the dock; on short screens
          it's capped to that space and scrolls inside, so neither end is cut off or hidden behind the dock. */}
      <div
        className={`absolute inset-0 z-10 flex items-center justify-center bg-[#3d2a1c]/10 px-4 pt-3 pb-[4.5rem] transition-opacity duration-500 ${
          mode === "splash" ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <Panel title="" className="max-h-full w-[min(500px,100%)] [&>header]:hidden">
          <div className="retro-scroll min-h-0 overflow-y-auto lowercase">
            <div className="flex gap-4 px-2 pt-2 pb-3">
              <PipLogo size={76} />
              <div className="min-w-0">
                <h1 className="text-[30px] font-bold leading-none tracking-tight text-[#4a3424]">pipterview <span className="text-[22px] font-normal text-[#c49a5a]">⋆⭒˚.⋆</span></h1>
                <p className="mt-1 font-script text-[22px] leading-tight text-[#8a6a4a]">An extra view for your interviews.</p>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[#5a4430]">
                  I&apos;m {GUIDE_NAME}. Starting is the biggest mountain, so let&apos;s climb it together: one practice interview, out
                  loud, at a little table on a floating island. Nothing here is life or death.
                </p>
              </div>
            </div>
            {step !== "pick" ? (
              <div className="mx-1 mb-1 rounded-2xl bg-white/70 normal-case">
                <ResumeStep
                  draft={profileDraft}
                  onChange={setProfileDraft}
                  onBack={() => setStep("pick")}
                  continueLabel={step === "context" ? "Save" : "Continue"}
                  onContinue={() => {
                    if (step === "resume") setMode("world");
                    setStep("pick");
                  }}
                />
              </div>
            ) : (
              <div className="space-y-3 px-1 pb-1">
                <NavButton tone="yellow" onClick={() => choose("behavioral")} className="w-full py-3 text-[16px]">
                  Start practising
                </NavButton>
                <p className="text-center text-[12.5px] text-[#8a6a4a]">
                  {PRESSURE.find((o) => o.value === settings.intensity)?.label} pressure · {LENGTH.find((o) => o.value === settings.length)?.label} ·{" "}
                  <button onClick={() => setCustomizing((v) => !v)} className="font-bold text-[#b0702a] underline underline-offset-2" aria-expanded={customizing}>
                    {customizing ? "Done" : "Customize"}
                  </button>
                </p>
                {customizing && (
                  <div className="space-y-2 rounded-2xl bg-white/70 px-3 py-2.5">
                    <Toggle label="Pressure" value={settings.intensity} options={PRESSURE} onChange={(intensity) => setSettings({ ...settings, intensity })} />
                    <Toggle label="Length" value={settings.length} options={LENGTH} onChange={(length) => setSettings({ ...settings, length })} />
                    <p className="flex items-center gap-2 text-[12.5px] text-[#6b5640]">
                      <span className="w-[70px] shrink-0 font-bold text-[#4a3424]">About you</span>
                      <span>{isTailored(profileDraft) ? "Resume added: questions will fit you." : "Optional."}</span>
                      <button onClick={() => setStep("context")} className="font-bold text-[#b0702a] underline underline-offset-2">
                        {isTailored(profileDraft) ? "Edit" : "Add a resume or job"}
                      </button>
                    </p>
                  </div>
                )}
                <div>
                  <p className="px-1 pb-1 text-[12.5px] font-bold text-[#a08060]">or choose a round</p>
                  <div className="grid gap-1.5 sm:grid-cols-3">
                    {PREP_TYPES.map((t) => (
                      <button
                        key={t}
                        onClick={() => choose(t)}
                        className="flex items-center gap-2.5 rounded-2xl bg-white/80 px-3 py-2.5 text-left ring-1 ring-[#f0dfc2] transition-colors hover:bg-[#fff0d4] sm:flex-col sm:items-start sm:gap-1"
                      >
                        <RoundIcon type={t} size={44} />
                        <span className="min-w-0">
                          <span className="block text-[14px] font-bold text-[#4a3424]">{PREP_LABELS[t]}</span>
                          <span className="block text-[12px] leading-snug text-[#8a6a4a]">{PREP_BLURB[t]}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                {/* what practising unlocks: every finished session grows the next thing on your island */}
                <button onClick={() => toggleTab("island")} className="block w-full rounded-2xl bg-white/80 px-3.5 py-3 text-left ring-1 ring-[#f0dfc2] hover:bg-[#fff6e6]">
                  <span className="flex items-baseline justify-between text-[12.5px]">
                    <span className="font-bold text-[#4a3424]">Your island</span>
                    <span className="text-[#8a6a4a]">
                      {Math.min(garden.grown, GARDEN_ITEMS.length)} of {GARDEN_ITEMS.length} grown{streak > 1 ? ` · ${streak}-day streak` : ""}
                    </span>
                  </span>
                  <span className="mt-2 flex gap-1" aria-hidden>
                    {GARDEN_ITEMS.map((item, i) => (
                      <span
                        key={item.id}
                        className={`h-2 flex-1 rounded-full ${i < garden.grown ? "" : i === garden.grown ? "border border-dashed border-[#d9a85a]" : "bg-[#efe2cc]"}`}
                        style={i < garden.grown ? { background: item.color } : undefined}
                      />
                    ))}
                  </span>
                  <span className="mt-1.5 block text-[12.5px] text-[#6b5640]">
                    Finish a round to grow the next one: <b className="text-[#3d2a1c]">{nextItem.label}</b>
                  </span>
                </button>
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* 2. on the island: one big way to sit down (clicking the table works too) */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center px-4 transition-opacity duration-500 ${
          mode === "world" && arrived === "world" ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className={`flex w-[min(420px,100%)] flex-col items-center gap-2 rounded-[22px] lowercase bg-[#fff8ec]/95 px-5 py-4 shadow-[0_12px_32px_rgba(70,45,20,0.2)] ring-1 ring-[#f0dfc2] ${
            mode === "world" && arrived === "world" ? "pointer-events-auto" : ""
          }`}
        >
          <p className="text-[15px] font-bold text-[#4a3424]">Ready when you are</p>
          <p className="-mt-1 flex items-center gap-1.5 text-[13px] text-[#6b5640]">
            <GardenIcon id={nextItem.id} size={20} />
            Finish this session to grow: <b className="text-[#3d2a1c]">{nextItem.label}</b>
          </p>
          <NavButton tone="yellow" onClick={sitDown} className="w-full py-2.5 text-[16px]">
            Sit down with {GUIDE_NAME}
          </NavButton>
          <p className="flex items-center gap-2 text-[12.5px] text-[#8a6a4a]">
            Drag to look around · scroll to zoom ·
            <button onClick={goHome} className="font-bold text-[#b0702a] underline underline-offset-2">
              Change round
            </button>
          </p>
        </div>
      </div>

      {/* 3. the side panel: chat and code at the table (kept mounted, so switching tabs loses nothing); stories and help any time */}
      {showPanel && (
        <section
          className={`absolute inset-x-3 bottom-20 z-20 flex h-[58vh] flex-col rounded-[22px] bg-[#fff8ec]/95 p-3 shadow-[0_12px_32px_rgba(70,45,20,0.22)] ring-1 ring-[#f0dfc2] backdrop-blur sm:inset-x-auto sm:top-5 sm:right-5 sm:bottom-24 sm:h-auto ${
            wide ? "sm:w-[min(660px,54vw)]" : "sm:w-[400px]"
          }`}
        >
          <header className="mb-2.5 flex items-center gap-2">
            <div role="tablist" className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-full bg-[#f3e6cf] p-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={panel === t.id}
                  onClick={() => (t.id === "island" || t.id === "stories" || t.id === "help" ? toggleTab(t.id) : setPanel(t.id))}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] font-bold transition-colors ${
                    panel === t.id ? "bg-white text-[#3d2a1c] shadow-[0_1px_4px_rgba(90,60,30,0.18)]" : "text-[#8a6a4a] hover:text-[#4a3424]"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
            {!seated && (
              <button onClick={() => setPanel(null)} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[18px] text-[#8a6a4a] hover:bg-[#fff0d4]">
                ×
              </button>
            )}
          </header>

          <div className="flex min-h-0 flex-1 flex-col">
            {seated && (
              <div className={`min-h-0 flex-1 flex-col ${panel === "chat" ? "flex" : "hidden"}`}>
                <ChatPanel {...chatProps} />
              </div>
            )}
            {seated && type === "technical" && (
              <div className={`min-h-0 flex-1 flex-col ${panel === "code" ? "flex" : "hidden"}`}>
                <CodePanel
                  key={convo.question?.id ?? "starter"}
                  question={convo.question}
                  guideLine={lastGuideLine}
                  canAsk={convo.status === "your-turn" || convo.status === "speaking" || convo.status === "listening"}
                  onAskHint={() => void convo.answer("Could I have a small hint?")}
                  onChange={(text, language) => {
                    code.current.text = text;
                    code.current.language = language;
                    convo.noteActivity(); // editing code isn't a pause
                  }}
                  onRun={(summary, ranCode, language) => {
                    code.current.run = { summary, code: ranCode };
                    code.current.text = ranCode;
                    code.current.language = language;
                  }}
                />
              </div>
            )}
            {panel === "island" && <IslandPanel garden={garden} streak={streak} />}
            {panel === "stories" && <StoryBook stories={stories} onChange={() => setStories(loadStories())} />}
            {panel === "help" && (
              <HelpPanel
                onReplayTour={() => {
                  setPanel(seated ? tableTab : null);
                  setTourDone([]);
                  saveTourDone([]);
                }}
              />
            )}
          </div>

          {/* at the table: what finishing grows, and the session's own actions, with Finish as the main one */}
          {seated && (
            <p className="mt-2.5 flex items-center gap-1.5 border-t border-[#f0dfc2] pt-2 text-[12.5px] text-[#6b5640]">
              <GardenIcon id={nextItem.id} size={20} />
              Finish to grow: <b className="text-[#3d2a1c]">{nextItem.label}</b>
            </p>
          )}
          {seated && (
            <footer className="mt-2 flex items-center gap-2">
              <span className="flex items-center gap-1.5 font-mono text-[12px] text-[#8a6a4a]" title="Your plant grows while you practise">
                <Sprout minutes={elapsed / 60} />
                {/* gentle practice promises no clock; otherwise it's hidden until you ask for it */}
                {gentle ? (
                  "Take your time"
                ) : (
                  <button onClick={() => setShowClock((v) => !v)} className="underline-offset-2 hover:underline" aria-pressed={showClock}>
                    {showClock ? clock : "Show timer"}
                  </button>
                )}
              </span>
              <span className="flex-1" />
              <NavButton onClick={standUp}>Take a break</NavButton>
              <NavButton tone="yellow" onClick={() => void convo.finish()} disabled={!convo.canFinish} title={convo.canFinish ? "End here and get feedback" : "Answer at least once to get feedback"}>
                I&apos;m done
              </NavButton>
            </footer>
          )}
        </section>
      )}

      {/* the feedback report, a moment after the sun starts setting; the sunset glows through around it */}
      {/* (hidden, not unmounted, while you watch the sunset: the report records the session once, when it mounts) */}
      {convo.status === "report" && convo.feedback && convo.scored && lingered && (
        // a solid warm page (the blurred sunset behind made it hard to read), with the buttons in a bar that stays put
        <div className={`fixed inset-0 z-30 overflow-y-auto bg-[#f3ead9] ${watchingSunset ? "hidden" : ""}`}>
          <div className="sticky top-0 z-10 flex flex-wrap items-center justify-end gap-2 border-b border-[#ead8b8] bg-[#f3ead9]/95 px-4 py-3 backdrop-blur">
            {grewNow && (
              <span className="mr-auto flex items-center gap-2 rounded-full bg-[#fffdf8] px-3.5 py-1.5 text-[13.5px] font-bold text-[#3d2a1c] ring-1 ring-[#ead8b8]">
                <GardenIcon id={grewNow.id} size={20} />
                New on your island: {grewNow.label}
              </span>
            )}
            <NavButton onClick={() => setWatchingSunset(true)}>Watch the sunset</NavButton>
            <NavButton tone="yellow" onClick={standUp}>
              Back to my island
            </NavButton>
          </div>
          <div className="mx-auto max-w-4xl pb-10">
            <FeedbackReport
              feedback={convo.feedback}
              state={convo.scored.state}
              transcript={convo.scored.transcript}
              work={convo.scored.work}
              embedded
              island={grewNow ? { grew: grewNow, next: nextItem, grown: garden.grown, total: GARDEN_ITEMS.length } : undefined}
            />
          </div>
        </div>
      )}
      {convo.status === "report" && watchingSunset && (
        <div className="absolute inset-x-0 bottom-24 z-20 flex justify-center px-4">
          <div className="flex w-[min(420px,100%)] items-center justify-between gap-3 rounded-[22px] bg-[#fff8ec]/95 px-5 py-4 shadow-[0_12px_32px_rgba(70,45,20,0.2)] ring-1 ring-[#f0dfc2]">
            <p className="text-[14.5px] leading-snug text-[#4a3424]">
              <b>Nice work.</b> {GUIDE_NAME} is proud of you.
              {grewNow && <span className="block text-[12.5px] text-[#8a6a4a]">Your {grewNow.label.toLowerCase()} will be waiting on your island.</span>}
            </p>
            <NavButton tone="yellow" onClick={() => setWatchingSunset(false)}>
              Read your feedback
            </NavButton>
          </div>
        </div>
      )}

      {/* whose turn it is, in big plain words */}
      {seated && !micAsk && convo.status !== "report" && <StatusBanner status={convo.status} handsFree={convo.handsFree} holding={convo.holding} />}

      {micAsk && <MicPrimer onMic={() => void chooseMic()} onType={typeInstead} />}

      {tourStep && (
        <div className={`absolute z-30 ${tourStep === "table" ? "top-20 left-4 sm:left-6" : "bottom-24 left-4 sm:left-6"}`}>
          <TourBubble step={tourStep} onNext={() => finishTourStep(tourStep)} onSkip={skipTour} />
        </div>
      )}

      {/* volume, from the dock */}
      {soundOpen && (
        <div className="absolute inset-x-0 bottom-20 z-30 flex justify-center px-4">
          <Panel title="Sound" icon={<SpeakerIcon />} className="w-[min(360px,100%)]">
            <div className="space-y-2.5 px-1.5 pb-1">
              <label className="flex items-center gap-2 text-[13.5px] font-bold text-[#4a3424]">
                <input type="checkbox" checked={sound.enabled} onChange={(e) => sound.setEnabled(e.target.checked)} className="accent-[#e8a93b]" />
                Music and nature sounds
              </label>
              <Slider label="Music" value={sound.levels.music} disabled={!sound.enabled} onChange={(music) => sound.setLevels({ ...sound.levels, music })} />
              <Slider label="Birds & breeze" value={sound.levels.nature} disabled={!sound.enabled} onChange={(nature) => sound.setLevels({ ...sound.levels, nature })} />
              <Slider label={`${GUIDE_NAME}'s voice`} value={sound.levels.voice} onChange={(voice) => sound.setLevels({ ...sound.levels, voice })} />
              <div className="flex justify-end">
                <NavButton onClick={() => setSoundOpen(false)}>Done</NavButton>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* the dock: home, your stories, help and sound, always in the same place */}
      <nav className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
        <div className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-[#fff8ec]/95 p-1.5 shadow-[0_8px_24px_rgba(70,45,20,0.2)] ring-1 ring-[#f0dfc2] backdrop-blur">
          <DockButton icon={<HomeIcon />} label="Home" active={mode === "splash"} onClick={goHome} title="Back to the start" />
          <DockButton icon={<IslandIcon />} label="Island" active={panel === "island"} onClick={() => toggleTab("island")} title="What you've grown, and what's next" />
          <DockButton icon={<BookIcon />} label={`Stories${stories.length ? ` (${stories.length})` : ""}`} active={panel === "stories"} onClick={() => toggleTab("stories")} />
          <DockButton icon={<HelpIcon />} label="Help" active={panel === "help"} onClick={() => toggleTab("help")} />
          <DockButton
            icon={<SpeakerIcon off={!sound.enabled} />}
            label={sound.enabled ? `Sound ${Math.round(sound.levels.music * 100)}%` : "Sound off"}
            active={soundOpen}
            onClick={() => setSoundOpen((v) => !v)}
            title="Volume"
          />
        </div>
      </nav>
    </div>
  );
}
