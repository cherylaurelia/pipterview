"use client";

import { useState } from "react";
import { ROLES } from "@/lib/interview/catalog";
import { ROLE_IDS, type RoleId } from "@/lib/interview/types";
import { isTailored, type ProfileDraft } from "../profile";
import { NavButton, sunken } from "./retro";

const MAX_PDF_BYTES = 5 * 1024 * 1024;
// 16px on phones, so iOS doesn't zoom the page when a field is focused
const field = "w-full bg-white px-2.5 py-1.5 text-[16px] sm:text-[13.5px] text-[#1b1d22] outline-none placeholder:text-[#80694f]";

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
    if (file.type !== "application/pdf") return setFileError("Choose a PDF file, or paste your resume as text below.");
    if (file.size > MAX_PDF_BYTES) return setFileError("That PDF is over 5 MB. Choose a smaller one, or paste your resume as text below.");
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result).split(",")[1] ?? "";
      onChange({ ...draft, resumePdf: { name: file.name, data, bytes: file.size }, resumeText: "" });
    };
    reader.onerror = () => setFileError("Couldn't read that file. Try another PDF, or paste your resume as text below.");
    reader.readAsDataURL(file);
  };

  const hasResume = Boolean(draft.resumePdf || draft.resumeText.trim());

  return (
    <div className="space-y-3 px-3 pt-1 pb-3 text-[13.5px] text-[#3c3a36]">
      <p>
        <b>All optional.</b> Add your resume and I&apos;ll ask about your own projects, including the bits that are just kind of{" "}
        <i>there</i>. Add a job posting and the questions will fit the role. Skip it and you can talk about any project you like.
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
            {/* the browser's own file button doesn't match anything here, so it hides inside a friendlier one */}
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-[13.5px] font-bold text-[#4a3424] ring-1 ring-[#ead7b8] transition-colors hover:bg-[#fff4df] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#8a4b00]">
              Upload a PDF
              <span className="font-normal text-[#8a6a4a]">(up to 5 MB)</span>
              <input type="file" accept="application/pdf" onChange={(e) => onFile(e.target.files?.[0])} className="sr-only" />
            </label>
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
