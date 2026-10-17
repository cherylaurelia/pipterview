"use client";

import { useCallback, useEffect, useState } from "react";
import { ROLES } from "@/lib/interview/catalog";
import type { Profile } from "@/lib/interview/tailor";
import { ROLE_IDS, type RoleId } from "@/lib/interview/types";

const STORAGE_KEY = "mock-interviewer:profile";
const MAX_PDF_BYTES = 5 * 1024 * 1024;
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

export function ProfileForm({ draft, onChange }: { draft: ProfileDraft; onChange: (draft: ProfileDraft) => void }) {
  const [open, setOpen] = useState(() => isTailored(draft));
  const [fileError, setFileError] = useState<string | null>(null);
  const [resumeMode, setResumeMode] = useState<"pdf" | "text">(draft.resumeText && !draft.resumePdf ? "text" : "pdf");

  const onFile = (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (file.type !== "application/pdf") return setFileError("Please choose a PDF.");
    if (file.size > MAX_PDF_BYTES) return setFileError("That PDF is over 5 MB.");
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result).split(",")[1] ?? "";
      onChange({ ...draft, resumePdf: { name: file.name, data, bytes: file.size }, resumeText: "" });
    };
    reader.onerror = () => setFileError("Couldn't read that file.");
    reader.readAsDataURL(file);
  };

  const tailored = isTailored(draft);
  const field =
    "w-full rounded-xl bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <div className="w-full rounded-2xl bg-white ring-1 ring-slate-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm"
        aria-expanded={open}
      >
        <span>
          <span className="font-medium text-slate-800">Tailor questions to your resume</span>
          <span className="ml-2 text-slate-500">{tailored ? "· on" : "· optional"}</span>
        </span>
        <span className="text-lg leading-none text-slate-400">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4 text-sm">
          <label className="block space-y-1.5">
            <span className="font-medium text-slate-700">Target role</span>
            <select value={draft.role} onChange={(e) => onChange({ ...draft, role: e.target.value as RoleId | "" })} className={field}>
              <option value="">Not specified</option>
              {ROLE_IDS.map((id) => (
                <option key={id} value={id}>
                  {ROLES[id]}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-700">Resume</span>
              <div className="flex gap-1 rounded-full bg-slate-100 p-0.5 text-xs">
                {(["pdf", "text"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setResumeMode(mode)}
                    className={`rounded-full px-2.5 py-1 ${resumeMode === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    {mode === "pdf" ? "Upload PDF" : "Paste text"}
                  </button>
                ))}
              </div>
            </div>
            {resumeMode === "pdf" ? (
              draft.resumePdf ? (
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                  <span className="truncate text-slate-700">{draft.resumePdf.name}</span>
                  <button type="button" onClick={() => onChange({ ...draft, resumePdf: undefined })} className="ml-3 text-xs text-slate-500 hover:text-rose-600">
                    Remove
                  </button>
                </div>
              ) : (
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => onFile(e.target.files?.[0])}
                  className="block w-full text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-slate-700 hover:file:bg-slate-200"
                />
              )
            ) : (
              <textarea
                value={draft.resumeText}
                onChange={(e) => onChange({ ...draft, resumeText: e.target.value, resumePdf: undefined })}
                rows={4}
                placeholder="Paste your resume…"
                className={field}
              />
            )}
            {fileError && <p className="text-xs text-rose-600">{fileError}</p>}
          </div>

          <label className="block space-y-1.5">
            <span className="font-medium text-slate-700">Job description</span>
            <textarea
              value={draft.jobDescription}
              onChange={(e) => onChange({ ...draft, jobDescription: e.target.value })}
              rows={3}
              placeholder="Paste the job posting you're preparing for…"
              className={field}
            />
          </label>

          <p className="text-xs text-slate-500">
            Saved only in this browser. Sent to the AI when you start, so it can ask about your own experience.
          </p>
        </div>
      )}
    </div>
  );
}
