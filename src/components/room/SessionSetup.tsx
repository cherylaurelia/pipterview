"use client";

import { useCallback, useEffect, useState } from "react";
import { loadHistory } from "@/lib/history";
import { getInterviewType } from "@/lib/interview/catalog";
import { DEFAULT_SETTINGS } from "@/lib/interview/flow";
import type { CompanyStyle, Intensity, InterviewTypeId, SessionLength, SessionSettings } from "@/lib/interview/types";
import { ProfileForm, isTailored, type ProfileDraft } from "../ProfileForm";
import { Button, Choice } from "../ui";
import { NervousnessScale } from "./NervousnessScale";

const SETTINGS_KEY = "mock-interviewer:settings";

/** Typical length of each round, for the timer and the start screen. */
export const ROUND_MINUTES: Record<SessionLength, Record<InterviewTypeId, number>> = {
  quick: { behavioral: 5, technical: 15, "system-design": 20 },
  full: { behavioral: 25, technical: 35, "system-design": 45 },
};

export type VoiceMode = "hands-free" | "push" | "quiet";

export const INTENSITY_OPTIONS: { value: Intensity; label: string; description: string }[] = [
  { value: "gentle", label: "Gentle", description: "Warm interviewer, extra hints, no clock" },
  { value: "standard", label: "Standard", description: "Friendly and fair, like a good real interview" },
  { value: "realistic", label: "Realistic", description: "Neutral, probing, on the clock" },
];

const STYLE_OPTIONS: { value: CompanyStyle; label: string; description: string }[] = [
  { value: "big_tech", label: "Big tech", description: "Structured, fundamentals-focused" },
  { value: "startup", label: "Startup", description: "Conversational, ownership and speed" },
];

const VOICE_OPTIONS: { value: VoiceMode; label: string; description: string }[] = [
  { value: "hands-free", label: "Hands-free", description: "Just talk; a pause sends" },
  { value: "push", label: "Push-to-talk", description: "Hold or click to talk" },
  { value: "quiet", label: "Quiet", description: "Type answers, Alex in captions" },
];

/**
 * Session settings, remembered in this browser. First-timers start with a
 * gentle quick rep: the lowest-stakes way in.
 */
export function useSessionSettings() {
  const [settings, setSettings] = useState<SessionSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SETTINGS_KEY);
      const firstTime = !saved && loadHistory().length === 0;
      const restored = saved
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
        : firstTime
          ? { ...DEFAULT_SETTINGS, intensity: "gentle" as const, length: "quick" as const }
          : DEFAULT_SETTINGS;
      // A link like /interview/technical?length=quick picks the length.
      const fromUrl = new URLSearchParams(window.location.search).get("length");
      if (fromUrl === "quick" || fromUrl === "full") restored.length = fromUrl;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore saved settings once
      setSettings(restored);
    } catch {
      // Storage blocked; use defaults.
    }
  }, []);
  const update = useCallback((next: SessionSettings) => {
    setSettings(next);
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // Not remembered; fine.
    }
  }, []);
  return [settings, update] as const;
}

/** Everything before the interview starts. One big Start; the rest is optional. */
export function SessionSetup({
  typeId,
  settings,
  onSettings,
  voiceMode,
  onVoiceMode,
  voiceSupported,
  nervousness,
  onNervousness,
  profile,
  onProfile,
  onBreathe,
  onStart,
  starting,
  error,
}: {
  typeId: InterviewTypeId;
  settings: SessionSettings;
  onSettings: (settings: SessionSettings) => void;
  voiceMode: VoiceMode;
  onVoiceMode: (mode: VoiceMode) => void;
  voiceSupported: boolean;
  nervousness?: number;
  onNervousness: (value: number) => void;
  profile: ProfileDraft;
  onProfile: (draft: ProfileDraft) => void;
  onBreathe: () => void;
  onStart: () => void;
  starting: boolean;
  error?: string | null;
}) {
  const [customizing, setCustomizing] = useState(false);
  const nervous = (nervousness ?? 0) >= 3;
  const veryNervous = (nervousness ?? 0) >= 4;
  const full = getInterviewType(typeId).questionsPerSession;

  const summary = [
    INTENSITY_OPTIONS.find((o) => o.value === settings.intensity)?.label,
    STYLE_OPTIONS.find((o) => o.value === settings.style)?.label,
    VOICE_OPTIONS.find((o) => o.value === (voiceSupported ? voiceMode : "quiet"))?.label,
    isTailored(profile) ? "Tailored" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="w-full space-y-5">
      <Choice
        columns={2}
        value={settings.length}
        onChange={(length) => onSettings({ ...settings, length })}
        options={[
          { value: "quick", label: "Quick rep", description: `1 question · about ${ROUND_MINUTES.quick[typeId]} min` },
          {
            value: "full",
            label: "Full interview",
            description: `${full === 1 ? "1 deep question" : `${full} questions`} · about ${ROUND_MINUTES.full[typeId]} min`,
          },
        ]}
      />

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" className="min-w-40" onClick={onStart} disabled={starting}>
          {starting ? "Starting…" : "Start"}
        </Button>
        {(nervous || settings.intensity === "gentle") && (
          <Button variant="ghost" onClick={onBreathe}>
            Breathe first (1 min)
          </Button>
        )}
      </div>

      <p className="text-sm text-slate-500">
        {summary}.{" "}
        <button type="button" onClick={() => setCustomizing((v) => !v)} className="font-medium text-teal-700 hover:text-teal-900" aria-expanded={customizing}>
          {customizing ? "Done" : "Customize"}
        </button>
      </p>

      <NervousnessScale label="Optional check-in: how are you feeling about this?" value={nervousness} onChange={onNervousness} />

      {veryNervous && (
        <div className="rounded-2xl bg-teal-50 px-4 py-3 text-sm leading-relaxed text-teal-900 ring-1 ring-teal-100">
          That&apos;s normal, and it&apos;s what practice is for.{" "}
          {settings.intensity !== "gentle" || settings.length !== "quick" ? (
            <button
              type="button"
              className="font-medium underline underline-offset-2"
              onClick={() => onSettings({ ...settings, intensity: "gentle", length: "quick" })}
            >
              Switch to a gentle quick rep
            </button>
          ) : (
            "A gentle quick rep is a good place to start."
          )}
        </div>
      )}

      {customizing && (
        <div className="space-y-5 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">Pressure level</p>
            <Choice value={settings.intensity} options={INTENSITY_OPTIONS} onChange={(intensity) => onSettings({ ...settings, intensity })} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">Interviewer style</p>
            <Choice columns={2} value={settings.style} options={STYLE_OPTIONS} onChange={(style) => onSettings({ ...settings, style })} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">Voice</p>
            {voiceSupported ? (
              <Choice value={voiceMode} options={VOICE_OPTIONS} onChange={onVoiceMode} />
            ) : (
              <p className="text-sm text-slate-500">Voice needs Chrome or Edge, so you&apos;ll type your answers here.</p>
            )}
          </div>
          <ProfileForm draft={profile} onChange={onProfile} />
        </div>
      )}
    </div>
  );
}
