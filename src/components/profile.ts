"use client";

import { useCallback, useEffect, useState } from "react";
import type { Profile } from "@/lib/interview/tailor";
import type { RoleId } from "@/lib/interview/types";

const STORAGE_KEY = "mock-interviewer:profile";
// Larger PDFs still work for this session; they just aren't remembered.
const MAX_STORED_PDF_BYTES = 1.5 * 1024 * 1024;

export interface ProfileDraft {
  role: RoleId | "";
  resumeText: string;
  resumePdf?: { name: string; data: string; bytes: number };
  jobDescription: string;
}

export const EMPTY_PROFILE: ProfileDraft = { role: "", resumeText: "", jobDescription: "" };

/** Turns the form into the API's profile, or undefined when nothing was filled in. */
export function toProfile(draft: ProfileDraft): Profile | undefined {
  const resumeText = draft.resumeText.trim();
  const jobDescription = draft.jobDescription.trim();
  if (!draft.role && !resumeText && !draft.resumePdf && !jobDescription) return undefined;
  return {
    role: draft.role || "other",
    resumeText: draft.resumePdf ? undefined : resumeText || undefined,
    resumePdf: draft.resumePdf?.data,
    jobDescription: jobDescription || undefined,
  };
}

export function isTailored(draft: ProfileDraft) {
  return Boolean(draft.resumeText.trim() || draft.resumePdf || draft.jobDescription.trim());
}

/** The profile form's state, remembered in this browser between visits. */
export function useSavedProfile() {
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_PROFILE);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from browser storage
      if (saved) setDraft({ ...EMPTY_PROFILE, ...JSON.parse(saved) });
    } catch {
      // Storage unavailable or corrupt; start empty.
    }
  }, []);

  // Saved on edit rather than in an effect, so the empty initial state can
  // never overwrite what's stored before it has been restored.
  const update = useCallback((next: ProfileDraft) => {
    setDraft(next);
    try {
      const toStore = next.resumePdf && next.resumePdf.bytes > MAX_STORED_PDF_BYTES ? { ...next, resumePdf: undefined } : next;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // Quota exceeded or storage blocked; the form still works for this session.
    }
  }, []);

  return [draft, update] as const;
}
