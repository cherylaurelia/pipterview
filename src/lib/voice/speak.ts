/**
 * Text-to-speech. Uses a natural ElevenLabs voice when the server has a key
 * (see /api/tts), otherwise the browser's built-in speechSynthesis.
 *
 * Speech is queued sentence by sentence, so a streamed reply starts playing
 * as soon as its first sentence arrives; each sentence's audio is fetched as
 * soon as it's complete, so the next one is ready when the current one ends.
 * stopSpeaking() (the candidate interrupting) cuts it off immediately.
 */

const PREFERRED_VOICES = [/Google US English/i, /Samantha/i, /Aria/i, /Jenny/i, /Natural/i];

let premium: Promise<boolean> | undefined;
let voiceVolume = 1;

/** How loud the interviewer's voice plays, 0 to 1. */
export function setVoiceVolume(volume: number) {
  voiceVolume = Math.min(1, Math.max(0, volume));
}
let active: SpeechQueue | null = null;

/** Whether the server offers the premium voice. Checked once. */
function premiumAvailable() {
  premium ??= fetch("/api/tts")
    .then((res) => (res.ok ? res.json() : { available: false }))
    .then((data) => Boolean(data.available))
    .catch(() => false);
  return premium;
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  for (const pattern of PREFERRED_VOICES) {
    const match = voices.find((v) => pattern.test(v.name));
    if (match) return match;
  }
  return voices.find((v) => v.lang === "en-US") ?? voices[0];
}

/** Voices load asynchronously in some browsers; call once early to warm them up. */
export function warmUpVoices() {
  if (typeof window === "undefined") return;
  if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
  void premiumAvailable();
}

export function stopSpeaking() {
  active?.cancel();
  active = null;
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** A sentence ready to play: premium audio, or text for the browser voice. */
type Prepared = { kind: "audio"; url: string } | { kind: "browser"; text: string };

/**
 * Starts getting a sentence's audio. Called as soon as the sentence is complete, so the next sentence is usually ready
 * by the time the current one finishes (no gap between sentences). Falls back to the browser voice on any failure.
 */
async function prepare(text: string, previousText: string | undefined, signal: AbortSignal): Promise<Prepared> {
  if (await premiumAvailable()) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, previousText }),
        signal,
      });
      if (res.ok) return { kind: "audio", url: URL.createObjectURL(await res.blob()) };
    } catch {
      // Fall back to the browser voice below.
    }
  }
  return { kind: "browser", text };
}

/** Plays a prepared sentence; resolves when done or cancelled. */
async function play(item: Prepared, isCancelled: () => boolean, onAudio: (audio: HTMLAudioElement) => void): Promise<void> {
  if (item.kind === "audio") {
    if (isCancelled()) return URL.revokeObjectURL(item.url);
    const audio = new Audio(item.url);
    audio.volume = voiceVolume;
    onAudio(audio);
    await new Promise<void>((resolve) => {
      const done = () => {
        URL.revokeObjectURL(item.url);
        resolve();
      };
      audio.onended = done;
      audio.onerror = done;
      audio.onpause = done; // cancel() pauses
      audio.play().catch(done);
    });
    return;
  }
  if (isCancelled() || !("speechSynthesis" in window)) return;
  await new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(item.text);
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 1.02;
    utterance.volume = voiceVolume;
    // speechSynthesis occasionally never fires "end"; don't hang the interview.
    const watchdog = setTimeout(resolve, 2000 + item.text.length * 90);
    utterance.onend = utterance.onerror = () => {
      clearTimeout(watchdog);
      resolve();
    };
    window.speechSynthesis.speak(utterance);
  });
}

export interface SpeechQueue {
  /** Adds streamed text; complete sentences start playing right away. */
  push(text: string): void;
  /** No more text is coming; speaks whatever is left. */
  close(): void;
  cancel(): void;
  /** Resolves when everything has been spoken, or the queue was cancelled. */
  done: Promise<void>;
}

export function createSpeechQueue(): SpeechQueue {
  stopSpeaking();
  let buffer = "";
  let lastSentence: string | undefined;
  // each sentence starts fetching its audio the moment it's queued; playback takes them in order
  const sentences: Promise<Prepared>[] = [];
  const abort = new AbortController();
  let playing = false;
  let closed = false;
  let cancelled = false;
  let audio: HTMLAudioElement | null = null;
  let finish!: () => void;
  const done = new Promise<void>((resolve) => (finish = resolve));

  const enqueue = (sentence: string) => {
    sentences.push(prepare(sentence, lastSentence, abort.signal));
    lastSentence = sentence;
  };

  const pump = async () => {
    if (playing) return;
    playing = true;
    while (sentences.length && !cancelled) {
      const item = await sentences.shift()!;
      await play(item, () => cancelled, (a) => (audio = a));
      audio = null;
    }
    playing = false;
    if (cancelled || (closed && sentences.length === 0)) finish();
  };

  const queue: SpeechQueue = {
    push(text) {
      if (cancelled || closed) return;
      buffer += text;
      // A sentence is complete once its end punctuation is followed by whitespace.
      let match: RegExpExecArray | null;
      while ((match = /^[\s\S]*?[.!?]+["')\]]?\s+/.exec(buffer))) {
        const sentence = match[0].trim();
        buffer = buffer.slice(match[0].length);
        if (sentence) enqueue(sentence);
      }
      void pump();
    },
    close() {
      if (closed) return;
      closed = true;
      if (buffer.trim()) enqueue(buffer.trim());
      buffer = "";
      if (!playing && sentences.length === 0) finish();
      else void pump();
    },
    cancel() {
      cancelled = true;
      abort.abort(); // stop fetching audio for sentences that will never play
      for (const pending of sentences.splice(0)) void pending.then((p) => p.kind === "audio" && URL.revokeObjectURL(p.url));
      audio?.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      finish();
    },
    done,
  };
  active = queue;
  return queue;
}

/** Speaks a whole line (e.g. a replay). Resolves when finished or interrupted. */
export function speak(text: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const queue = createSpeechQueue();
  queue.push(text);
  queue.close();
  return queue.done;
}
