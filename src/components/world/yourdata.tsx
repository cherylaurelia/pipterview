"use client";

import { useRef, useState } from "react";
import { deleteAllData, exportData, importData } from "@/lib/backup";
import { NavButton } from "./retro";

/**
 * Your data, in the Help panel: it all lives in this browser, so you can download it (to keep, or move to another
 * browser), bring it back from a file, or delete it. Restoring or deleting reloads the page so everything picks it up.
 */
export function YourData() {
  const file = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportData()], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipterview-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const restore = async (f: File) => {
    const result = importData(await f.text());
    if (!result.ok) return setMessage(result.error);
    window.location.reload();
  };

  return (
    <section className="mt-3 border-t border-[#f0dfc2] px-1 pt-3">
      <h3 className="text-[13.5px] font-bold text-[#4a3424]">Your data</h3>
      <p className="mt-1 text-[12.5px] leading-snug text-[#6b5640]">
        Your island, stories and progress live only in this browser. Download a copy to keep them safe or move them to another
        browser. <a href="/privacy" className="font-bold text-[#b0702a] underline underline-offset-2">What gets sent where</a>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <NavButton onClick={download}>Download my data</NavButton>
        <NavButton onClick={() => file.current?.click()}>Restore from a file</NavButton>
        {confirming ? (
          <NavButton
            onClick={() => {
              deleteAllData();
              window.location.reload();
            }}
            className="text-[#9b2b22]"
          >
            Yes, delete everything
          </NavButton>
        ) : (
          <NavButton onClick={() => setConfirming(true)}>Delete my data</NavButton>
        )}
      </div>
      {confirming && <p className="mt-1.5 text-[12px] text-[#9b2b22]">This can&apos;t be undone. Download a copy first if you might want it back.</p>}
      {message && <p className="mt-1.5 text-[12px] text-[#9b2b22]">{message}</p>}
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void restore(f);
          e.target.value = "";
        }}
      />
    </section>
  );
}
