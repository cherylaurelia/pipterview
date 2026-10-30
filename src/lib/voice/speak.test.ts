import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// speak.ts runs in the browser; give it just enough of one: fetch for /api/tts, an Audio that "plays" briefly, and
// blob URLs. No speechSynthesis, so a sentence that falls back to the browser voice is simply skipped (and counted).

type Played = { url: string };

function setup({ busyFirst = 0, latencyMs = 30 } = {}) {
  let inFlight = 0;
  let maxInFlight = 0;
  let posts = 0;
  let busyLeft = busyFirst;
  const played: Played[] = [];
  const texts = new Map<string, string>();

  vi.stubGlobal("window", globalThis);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init || init.method !== "POST") return Response.json({ available: true });
      posts++;
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, latencyMs));
      inFlight--;
      if (busyLeft > 0) {
        busyLeft--;
        return Response.json({ error: "busy" }, { status: 503 });
      }
      const { text } = JSON.parse(String(init.body));
      return new Response(new Blob([text]));
    }),
  );
  let n = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    const url = `blob:${n++}`;
    void (blob as Blob).text().then((t) => texts.set(url, t));
    return url;
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.stubGlobal(
    "Audio",
    class {
      volume = 1;
      onended: (() => void) | null = null;
      onpause: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public url: string) {}
      play() {
        played.push({ url: this.url });
        setTimeout(() => this.onended?.(), 10);
        return Promise.resolve();
      }
      pause() {
        this.onpause?.();
      }
    },
  );
  return { played, texts, stats: () => ({ maxInFlight, posts }) };
}

beforeEach(() => vi.resetModules()); // speak.ts caches "is the premium voice available" per module
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("speech queue", () => {
  it("never has more than two voice requests going at once, and plays sentences in order", async () => {
    const env = setup();
    const { createSpeechQueue } = await import("./speak");
    const queue = createSpeechQueue();
    queue.push("One. Two. Three. Four. Five. Six. ");
    queue.close();
    await queue.done;
    await new Promise((r) => setTimeout(r, 5));
    expect(env.stats().maxInFlight).toBeLessThanOrEqual(2);
    expect(env.played.map((p) => env.texts.get(p.url))).toEqual(["One.", "Two.", "Three.", "Four.", "Five.", "Six."]);
  });

  it("keeps the limit while a reply streams in a few words at a time", async () => {
    const env = setup({ latencyMs: 40 });
    const { createSpeechQueue } = await import("./speak");
    const queue = createSpeechQueue();
    for (const chunk of ["Hi there. ", "Let's ", "start. ", "First, ", "a question. ", "Ready? ", "Go."]) {
      queue.push(chunk);
      await new Promise((r) => setTimeout(r, 8));
    }
    queue.close();
    await queue.done;
    await new Promise((r) => setTimeout(r, 5));
    expect(env.stats().maxInFlight).toBeLessThanOrEqual(2);
    expect(env.played.map((p) => env.texts.get(p.url))).toEqual(["Hi there.", "Let's start.", "First, a question.", "Ready?", "Go."]);
  });

  it("retries once when the voice service is busy, so the sentence still gets the real voice", async () => {
    const env = setup({ busyFirst: 1 });
    const { createSpeechQueue } = await import("./speak");
    const queue = createSpeechQueue();
    queue.push("Only sentence.");
    queue.close();
    await queue.done;
    expect(env.stats().posts).toBe(2);
    expect(env.played).toHaveLength(1);
  });
});
