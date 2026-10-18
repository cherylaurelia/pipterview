import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { CodingSpec } from "../workspace/types";
import { CPP_PRELUDE, C_PRELUDE, JAVA_TREE_NODE, RESULT_MARKER, cDriver, cppDriver, javaDriver } from "./drivers";

/**
 * Compiles and runs Java, C++, and C on this machine. This executes arbitrary
 * code with the server's permissions, so it's only enabled in development
 * (or with LOCAL_CODE_RUNNER=1). For a public deployment, replace runNative
 * with a call to a sandboxed service such as Judge0 that returns the same shape.
 */
export function nativeRunnerEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.LOCAL_CODE_RUNNER === "1";
}

export interface NativeResult {
  results: { ok: boolean; value?: unknown; error?: string }[];
  stdout: string;
  error?: string;
  timeout?: boolean;
}

const COMPILE_MS = 30_000;
const RUN_MS = 5_000;
const OUTPUT_LIMIT = 256 * 1024;
const MAX_CONCURRENT = 2;

let running = 0;
const queue: (() => void)[] = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) await new Promise<void>((resolve) => queue.push(resolve));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    queue.shift()?.();
  }
}

interface Exec {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function exec(command: string, args: string[], cwd: string, timeoutMs: number): Promise<Exec> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, LANG: "en_US.UTF-8" } });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (d) => {
      if (stdout.length < OUTPUT_LIMIT) stdout += d;
    });
    child.stderr.on("data", (d) => {
      if (stderr.length < OUTPUT_LIMIT) stderr += d;
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: -1, signal: null, stdout, stderr: String(err), timedOut });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr, timedOut });
    });
  });
}

// ---------- Toolchains ----------

let javaBin: string | null | undefined;
let cppCompiler: string | null | undefined;
let cCompiler: string | null | undefined;

/** Finds a working JDK without needing it on PATH (macOS ships stub `java` commands that only print an error). */
async function findJava(): Promise<string | null> {
  if (javaBin !== undefined) return javaBin;
  // Missing locations just fail to spawn, so there's no need to check they exist first.
  const candidates = [
    process.env.JAVA_HOME ? `${process.env.JAVA_HOME}/bin` : null,
    "/opt/homebrew/opt/openjdk@21/bin",
    "/opt/homebrew/opt/openjdk/bin",
    "/usr/local/opt/openjdk@21/bin",
    "/usr/local/opt/openjdk/bin",
    "", // PATH
  ].filter((c): c is string => c !== null);
  for (const dir of candidates) {
    const javac = dir ? path.join(dir, "javac") : "javac";
    const check = await exec(javac, ["-version"], tmpdir(), 10_000);
    if (check.code === 0) return (javaBin = dir);
  }
  return (javaBin = null);
}

async function findCpp(): Promise<string | null> {
  if (cppCompiler !== undefined) return cppCompiler;
  for (const cxx of [process.env.CXX, "clang++", "g++"].filter(Boolean) as string[]) {
    const check = await exec(cxx, ["--version"], tmpdir(), 10_000);
    if (check.code === 0) return (cppCompiler = cxx);
  }
  return (cppCompiler = null);
}

async function findC(): Promise<string | null> {
  if (cCompiler !== undefined) return cCompiler;
  for (const cc of [process.env.CC, "cc", "clang", "gcc"].filter(Boolean) as string[]) {
    const check = await exec(cc, ["--version"], tmpdir(), 10_000);
    if (check.code === 0) return (cCompiler = cc);
  }
  return (cCompiler = null);
}

// ---------- Output parsing ----------

function parseRun(out: Exec, spec: CodingSpec | undefined, language: "java" | "cpp" | "c"): NativeResult {
  const results: NativeResult["results"] = [];
  const userLines: string[] = [];
  for (const line of out.stdout.split("\n")) {
    if (line.startsWith(RESULT_MARKER)) {
      try {
        results.push(JSON.parse(line.slice(RESULT_MARKER.length)));
      } catch {
        results.push({ ok: false, error: "Couldn't read this test's result" });
      }
    } else {
      userLines.push(line);
    }
  }
  const stdout = userLines.join("\n").replace(/\n+$/, "").replace(/^\n+/, "").slice(-4000);

  if (out.timedOut) return { results, stdout, timeout: true, error: `Time limit exceeded (${RUN_MS / 1000}s). Check for an infinite loop.` };

  const crashed = out.code !== 0 || out.signal;
  if (spec && crashed && results.length < spec.tests.length) {
    // A crash (e.g. a segfault or stack overflow) ends every remaining test.
    const reason = out.signal ? `Program crashed (${out.signal})` : `Program exited with code ${out.code}`;
    const detail = language === "java" ? out.stderr.split("\n").slice(0, 3).join("\n") : out.stderr.slice(0, 500);
    while (results.length < spec.tests.length) results.push({ ok: false, error: detail ? `${reason}: ${detail}` : reason });
  }
  if (!spec && crashed) {
    return { results, stdout, error: `${out.signal ? `Crashed (${out.signal})` : `Exited with code ${out.code}`}\n${out.stderr.slice(0, 2000)}` };
  }
  return { results, stdout: [stdout, spec ? "" : out.stderr.slice(0, 1000)].filter(Boolean).join("\n") };
}

/** Compiler output, trimmed and pointing at the candidate's own line numbers. */
function cleanCompileErrors(stderr: string, file: string, lineOffset: number) {
  return stderr
    .replaceAll(/[^\s:]*\/(?=[^/\s:]+:\d+)/g, "") // drop temp directory paths
    .replaceAll(new RegExp(`${file.replace(".", "\\.")}:(\\d+)`, "g"), (_, n) => `line ${Math.max(1, Number(n) - lineOffset)}`)
    .split("\n")
    .slice(0, 40)
    .join("\n")
    .trim();
}

// ---------- Runners ----------

/**
 * Each run gets a folder under .runs/ in the project (gitignored, deleted
 * after the run). Keeping paths under one fixed folder lets the bundler see
 * that only that folder is touched.
 */
const runFile = (run: string, name: string) => path.join(process.cwd(), ".runs", run, name);

async function runJava(run: string, code: string, spec?: CodingSpec): Promise<NativeResult> {
  const dir = runFile(run, "");
  const bin = await findJava();
  if (bin === null) {
    return { results: [], stdout: "", error: "Java isn't installed on the server. Install a JDK (for example `brew install openjdk@21`) and restart the dev server." };
  }
  const javac = bin ? path.join(bin, "javac") : "javac";
  const java = bin ? path.join(bin, "java") : "java";

  // The candidate's file gets java.util imported for them, as on LeetCode.
  const userFile = spec ? `${spec.mode === "class" ? spec.entry.java : "Solution"}.java` : "Main.java";
  await writeFile(runFile(run, userFile), `import java.util.*;\n${code}`);
  const files = [userFile];
  if (spec) {
    await writeFile(runFile(run, "TreeNode.java"), JAVA_TREE_NODE);
    await writeFile(runFile(run, "Main.java"), javaDriver(spec));
    files.push("TreeNode.java", "Main.java");
  }

  const compiled = await exec(javac, ["-encoding", "UTF-8", "-d", "out", ...files], dir, COMPILE_MS);
  if (compiled.timedOut) return { results: [], stdout: "", error: "Compiling took too long." };
  if (compiled.code !== 0) {
    return { results: [], stdout: "", error: `Compile error:\n${cleanCompileErrors(compiled.stderr, userFile, 1)}` };
  }
  const ran = await exec(java, ["-Xss64m", "-Xmx512m", "-cp", "out", "Main"], dir, RUN_MS);
  return parseRun(ran, spec, "java");
}

async function runCpp(run: string, code: string, spec?: CodingSpec): Promise<NativeResult> {
  const dir = runFile(run, "");
  const cxx = await findCpp();
  if (!cxx) return { results: [], stdout: "", error: "No C++ compiler on the server. Install clang (xcode-select --install) or g++." };

  let sources: string[];
  let userFile: string;
  if (spec) {
    // The candidate's code is its own file, so compiler errors use their line numbers.
    userFile = "solution.hpp";
    await writeFile(runFile(run, userFile), code);
    await writeFile(runFile(run, "main.cpp"), `${CPP_PRELUDE}\n#include "solution.hpp"\n${cppDriver(spec)}`);
    sources = ["main.cpp"];
  } else {
    userFile = "main.cpp";
    await writeFile(runFile(run, userFile), code);
    sources = [userFile];
  }

  const compiled = await exec(cxx, ["-std=c++17", "-O2", "-o", "main", ...sources], dir, COMPILE_MS);
  if (compiled.timedOut) return { results: [], stdout: "", error: "Compiling took too long." };
  if (compiled.code !== 0) {
    return { results: [], stdout: "", error: `Compile error:\n${cleanCompileErrors(compiled.stderr, userFile, 0)}` };
  }
  const ran = await exec(runFile(run, "main"), [], dir, RUN_MS);
  return parseRun(ran, spec, "cpp");
}

async function runC(run: string, code: string, spec?: CodingSpec): Promise<NativeResult> {
  const dir = runFile(run, "");
  const cc = await findC();
  if (!cc) return { results: [], stdout: "", error: "No C compiler on the server. Install clang (xcode-select --install) or gcc." };

  let userFile: string;
  if (spec) {
    // The candidate's code is its own file, so compiler errors use their line numbers.
    userFile = "solution.h";
    await writeFile(runFile(run, userFile), code);
    await writeFile(runFile(run, "main.c"), `${C_PRELUDE}\n#include "solution.h"\n${cDriver(spec)}`);
  } else {
    userFile = "main.c";
    await writeFile(runFile(run, userFile), code);
  }

  const compiled = await exec(cc, ["-std=c11", "-O2", "-o", "main", "main.c", "-lm"], dir, COMPILE_MS);
  if (compiled.timedOut) return { results: [], stdout: "", error: "Compiling took too long." };
  if (compiled.code !== 0) {
    return { results: [], stdout: "", error: `Compile error:\n${cleanCompileErrors(compiled.stderr, userFile, 0)}` };
  }
  const ran = await exec(runFile(run, "main"), [], dir, RUN_MS);
  return parseRun(ran, spec, "c");
}

export async function runNative(language: "java" | "cpp" | "c", code: string, spec?: CodingSpec): Promise<NativeResult> {
  return withSlot(async () => {
    const run = randomUUID();
    await mkdir(runFile(run, ""), { recursive: true });
    try {
      if (language === "java") return await runJava(run, code, spec);
      return language === "cpp" ? await runCpp(run, code, spec) : await runC(run, code, spec);
    } catch (err) {
      return { results: [], stdout: "", error: err instanceof Error ? err.message : String(err) };
    } finally {
      await rm(runFile(run, ""), { recursive: true, force: true });
    }
  });
}
