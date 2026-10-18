"use client";

import { useState } from "react";
import { ROLES } from "@/lib/interview/catalog";
import { ROLE_IDS, type RoleId } from "@/lib/interview/types";
import { isTailored, type ProfileDraft } from "../ProfileForm";
import { NavButton, sunken } from "./retro";

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const field = "w-full bg-white px-2.5 py-1.5 text-[13.5px] text-[#1b1d22] outline-none placeholder:text-[#8f8d88]";

/**
 * Optional context: a resume and/or job description, so questions are about you. Everything here can be skipped;
 * without it, the guide asks you to walk through any project you choose. Shares the saved profile with the main
 * interview room (stored only in this browser).
 */
export function ResumeStep({
  draft,
  onChange,
  onBack,
  onContinue,
  continueLabel = "Continue",
}: {
  draft: ProfileDraft;
  onChange: (draft: ProfileDraft) => void;
  onBack: () => void;
  onContinue: () => void;
  /** What the button says once something's been added; with nothing added it offers to skip. */
  continueLabel?: string;
}) {
  const [fileError, setFileError] = useState<string | null>(null);

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

  const hasResume = Boolean(draft.resumePdf || draft.resumeText.trim());

  return (
    <div className="space-y-3 px-3 pt-1 pb-3 text-[13.5px] text-[#3c3a36]">
      <p>
        <b>All optional.</b> Add your resume and questions will be about your own projects; add a job posting and they&apos;ll fit
        the role. Skip it and you can talk about any project you like.
      </p>

      <label className="block space-y-1">
        <span className="font-bold text-[#1b1d22]">Target role</span>
        <select value={draft.role} onChange={(e) => onChange({ ...draft, role: e.target.value as RoleId | "" })} className={field} style={sunken}>
          <option value="">Not specified</option>
          {ROLE_IDS.map((id) => (
            <option key={id} value={id}>
              {ROLES[id]}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-1">
        <span className="font-bold text-[#1b1d22]">Resume</span>
        {draft.resumePdf ? (
          <div className="flex items-center justify-between bg-white px-2.5 py-1.5" style={sunken}>
            <span className="truncate">{draft.resumePdf.name}</span>
            <button type="button" className="ml-3 text-[12px] underline" onClick={() => onChange({ ...draft, resumePdf: undefined })}>
              Remove
            </button>
          </div>
        ) : (
          <>
            <input type="file" accept="application/pdf" onChange={(e) => onFile(e.target.files?.[0])} className="block w-full text-[12.5px]" />
            <textarea
              value={draft.resumeText}
              onChange={(e) => onChange({ ...draft, resumeText: e.target.value })}
              rows={3}
              placeholder="…or paste it here"
              className={`retro-scroll ${field}`}
              style={sunken}
            />
          </>
        )}
        {fileError && <p className="text-[12px] text-[#9b2b22]">{fileError}</p>}
      </div>

      <label className="block space-y-1">
        <span className="font-bold text-[#1b1d22]">Job description (optional)</span>
        <textarea
          value={draft.jobDescription}
          onChange={(e) => onChange({ ...draft, jobDescription: e.target.value })}
          rows={2}
          placeholder="Paste the posting you're preparing for"
          className={`retro-scroll ${field}`}
          style={sunken}
        />
      </label>

      <div className="flex items-center justify-between gap-2 pt-1">
        <NavButton onClick={onBack}>Back</NavButton>
        <NavButton tone="yellow" onClick={onContinue}>
          {hasResume || isTailored(draft) ? continueLabel : "Skip for now"}
        </NavButton>
      </div>
    </div>
  );
}
