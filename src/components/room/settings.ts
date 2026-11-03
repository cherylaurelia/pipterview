"use client";

import { useCallback, useEffect, useState } from "react";
import { loadHistory } from "@/lib/history";
import { DEFAULT_SETTINGS } from "@/lib/interview/flow";
import type { Intensity, SessionSettings } from "@/lib/interview/types";

const SETTINGS_KEY = "mock-interviewer:settings";

export const INTENSITY_OPTIONS: { value: Intensity; label: string; description: string }[] = [
  { value: "gentle", label: "Gentle", description: "Warm interviewer, extra hints, no clock" },
  { value: "standard", label: "Standard", description: "Friendly and fair, like a good real interview" },
  { value: "realistic", label: "Realistic", description: "Neutral, probing, on the clock" },
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
      // A link like /?length=quick picks the length.
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

