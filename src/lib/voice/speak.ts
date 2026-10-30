/**
 * Text-to-speech. Uses a natural ElevenLabs voice when the server has a key
 * (see /api/tts), otherwise the browser's built-in speechSynthesis.
 *
 * Speech is queued sentence by sentence, so a streamed reply starts playing
 * as soon as its first sentence arrives, and stopSpeaking() (the candidate
 * interrupting) cuts it off immediately.
 */

const PREFERRED_VOICES = [/Google US English/i, /Samantha/i, /Aria/i, /Jenny/i, /Natural/i];

let premium: Promise<boolean> | undefined;
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

/** Speaks one sentence; resolves when done or cancelled. */
async function speakOne(text: string, isCancelled: () => boolean, onAudio: (audio: HTMLAudioElement) => void): Promise<void> {
  if (await premiumAvailable()) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const url = URL.createObjectURL(await res.blob());
        if (isCancelled()) return URL.revokeObjectURL(url);
        const audio = new Audio(url);
        onAudio(audio);
        await new Promise<void>((resolve) => {
          const done = () => {
            URL.revokeObjectURL(url);
            resolve();
          };
          audio.onended = done;
          audio.onerror = done;
          audio.onpause = done; // cancel() pauses
          audio.play().catch(done);
        });
        return;
      }
    } catch {
      // Fall back to the browser voice below.
    }
  }
  if (isCancelled() || !("speechSynthesis" in window)) return;
  await new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 1.02;
    // speechSynthesis occasionally never fires "end"; don't hang the interview.
    const watchdog = setTimeout(resolve, 2000 + text.length * 90);
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
  const sentences: string[] = [];
  let playing = false;
  let closed = false;
  let cancelled = false;
  let audio: HTMLAudioElement | null = null;
  let finish!: () => void;
  const done = new Promise<void>((resolve) => (finish = resolve));

  const pump = async () => {
    if (playing) return;
    playing = true;
    while (sentences.length && !cancelled) {
      await speakOne(sentences.shift()!, () => cancelled, (a) => (audio = a));
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
        if (sentence) sentences.push(sentence);
      }
      void pump();
    },
    close() {
      if (closed) return;
      closed = true;
      if (buffer.trim()) sentences.push(buffer.trim());
      buffer = "";
      if (!playing && sentences.length === 0) finish();
      else void pump();
    },
    cancel() {
      cancelled = true;
      sentences.length = 0;
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
