"use client";

import { useState } from "react";
import { STAR_PARTS, missingParts, removeStory, type SavedStory } from "@/lib/stories";
import { NavButton, sunken } from "./retro";
import { GUIDE_NAME } from "./script";

/**
 * Your story bank: every story you've told, which STAR parts it's missing, and how to improve it. `onPractise`, when
 * given (not mid-session), lets an empty bank start a behavioral round.
 */
export function StoryBook({ stories, onChange, onPractise }: { stories: SavedStory[]; onChange: () => void; onPractise?: () => void }) {
  const [removing, setRemoving] = useState<string | null>(null); // asked to remove, waiting for "yes"
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="px-1 pb-2 text-[13px] leading-snug text-[#6b5640]">
        Five or six good stories answer most behavioral questions. If you freeze, {GUIDE_NAME} can remind you of one.
      </p>
      <div className="retro-scroll min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#fbf8f2] px-3 py-3" style={sunken}>
        {stories.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-[13.5px] text-[#55534e]">No stories yet. Do a behavioral or resume round, and the stories you tell will land here.</p>
            {onPractise && (
              <NavButton tone="yellow" onClick={onPractise}>
                Tell {GUIDE_NAME} a story
              </NavButton>
            )}
          </div>
        )}
        {[...stories]
          .sort((a, b) => b.lastTold.localeCompare(a.lastTold))
          .map((story) => {
            const missing = missingParts(story);
            return (
              <article key={story.id} className="border-b border-[#e3e0d8] pb-3 last:border-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[14px] font-bold text-[#3d2a1c]">{story.title}</h3>
                  <span className="flex shrink-0 gap-0.5" aria-label={missing.length ? `Missing: ${missing.join(", ")}` : "All four STAR parts"}>
                    {STAR_PARTS.map((part) => (
                      <span
                        key={part}
                        title={part}
                        className={`grid h-[18px] w-[18px] place-items-center rounded-[5px] text-[10px] font-bold ${missing.includes(part) ? "text-[#8f8d88]" : "bg-[#ffc95c] text-[#3d2a14]"}`}
                        style={missing.includes(part) ? sunken : undefined}
                      >
                        {part[0].toUpperCase()}
                      </span>
                    ))}
                  </span>
                </div>
                {story.question && <p className="mt-0.5 text-[11.5px] italic text-[#8f8d88]">For: {story.question}</p>}
                <dl className="mt-1.5 space-y-0.5 text-[13px] leading-snug text-[#1b1d22]">
                  {STAR_PARTS.filter((p) => story[p].trim()).map((part) => (
                    <div key={part} className="flex gap-2">
                      <dt className="w-[62px] shrink-0 text-[11px] font-bold uppercase text-[#8f8d88]">{part}</dt>
                      <dd>{story[part]}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-1.5 text-[12.5px] text-[#8a4b00]">
                  {missing.length ? `Add the ${missing.join(" and ")}. ` : ""}
                  {story.tip}
                </p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-[11.5px] text-[#8f8d88]">
                    {story.skills.join(" · ")}
                    {story.timesTold > 1 ? ` · told ${story.timesTold} times` : ""}
                  </span>
                  {/* removing can't be undone, so it asks first */}
                  {removing === story.id ? (
                    <span className="flex shrink-0 gap-2 text-[11.5px]">
                      <button
                        className="font-bold text-[#9b2b22] underline underline-offset-2"
                        onClick={() => {
                          removeStory(story.id);
                          setRemoving(null);
                          onChange();
                        }}
                      >
                        Remove it
                      </button>
                      {/* focus comes here, since the Remove button it replaced has gone */}
                      <button className="text-[#6b5640] underline underline-offset-2" onClick={() => setRemoving(null)} autoFocus>
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button className="shrink-0 text-[11.5px] text-[#8f8d88] underline underline-offset-2 hover:text-[#9b2b22]" onClick={() => setRemoving(story.id)}>
                      Remove
                    </button>
                  )}
                </div>
              </article>
            );
          })}
      </div>
    </div>
  );
}
