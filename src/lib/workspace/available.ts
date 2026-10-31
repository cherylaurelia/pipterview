"use client";

import { useEffect, useState } from "react";
import { CODE_LANGUAGES, NATIVE_LANGUAGES, type CodeLanguage } from "./types";

// Python, JavaScript and TypeScript always run (in the browser). Java, C++ and C run on the server, which only does
// that when it's allowed to (see nativeRunnerEnabled), so they're only offered once /api/status says it is.

let nativeRunner: Promise<boolean> | null = null;

/** Whether the server can run Java, C++ and C. False until it's been asked (and if asking fails). */
export function useNativeRunner() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let live = true;
    nativeRunner ??= fetch("/api/status")
      .then((r) => r.json())
      .then((d: { nativeRunner?: boolean }) => d.nativeRunner === true)
      .catch(() => false);
    void nativeRunner.then((v) => live && setOk(v));
    return () => {
      live = false;
    };
  }, []);
  return ok;
}

/** The languages you can actually run, given whether the server runs the compiled ones. */
export const availableLanguages = (native: boolean): CodeLanguage[] => CODE_LANGUAGES.filter((l) => native || !NATIVE_LANGUAGES.includes(l));
