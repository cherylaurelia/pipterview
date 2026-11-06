"use client";

/**
 * The microphone with background noise taken out by RNNoise (a small neural noise suppressor, run in an AudioWorklet),
 * as a track speech recognition can listen to instead of the raw mic: fans, keyboards, a café behind you. Only where
 * recognition takes a track (Chromium); everywhere else, and if any step fails, `openDenoisedMic` gives null and
 * recognition listens to the mic itself, as it always has. The files are copies of the package's, in public/voice/; the
 * package itself loads on the first turn (it can't even be imported outside a browser).
 */

export interface DenoisedMic {
  track: MediaStreamTrack;
  close(): void;
}

const BASE = "/voice/";

/** Whether to try at all: Chromium (which has userAgentData) is where recognition can take a track. */
export function canDenoise(nav: Navigator = navigator, win: typeof globalThis = globalThis) {
  return "userAgentData" in nav && typeof win.AudioWorkletNode === "function" && Boolean(nav.mediaDevices?.getUserMedia);
}

type Suppressor = typeof import("@sapphi-red/web-noise-suppressor");
let engine: Promise<{ ctx: AudioContext; wasm: ArrayBuffer; lib: Suppressor }> | null = null;

/** The audio context with the RNNoise worklet in it, set up once and kept for every turn after. */
function loadEngine() {
  engine ??= (async () => {
    const lib = await import("@sapphi-red/web-noise-suppressor");
    const ctx = new AudioContext({ sampleRate: 48000 }); // RNNoise works on 48 kHz audio
    try {
      const [wasm] = await Promise.all([
        lib.loadRnnoise({ url: `${BASE}rnnoise.wasm`, simdUrl: `${BASE}rnnoise_simd.wasm` }),
        ctx.audioWorklet.addModule(`${BASE}rnnoiseWorklet.js`),
      ]);
      return { ctx, wasm, lib };
    } catch (err) {
      void ctx.close();
      throw err;
    }
  })().catch((err) => {
    engine = null; // try again next turn
    throw err;
  });
  return engine;
}

/**
 * Loads RNNoise ahead of the first turn (call it on a click or key press, when an audio context may start), so opening
 * the mic is quick when you press Talk.
 */
export function warmDenoiser() {
  if (canDenoise()) loadEngine().catch(() => {});
}

/** Resolves false if `p` hasn't settled in `ms` (an audio context can wait forever for a click to resume it). */
const within = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p.then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), ms))]);

/** Opens the mic through RNNoise, or null if that isn't possible here; `close()` it when the turn ends. */
export async function openDenoisedMic(): Promise<DenoisedMic | null> {
  if (!canDenoise()) return null;
  let stream: MediaStream | null = null;
  try {
    const { ctx, wasm, lib } = await loadEngine();
    // a suspended context would hand recognition silence, so it has to be running before we use it
    if (ctx.state !== "running" && !((await within(ctx.resume(), 500)) && (ctx.state as AudioContextState) === "running")) return null;
    // the browser's own suppression off (RNNoise does that, better), its echo cancellation kept (so Pip isn't heard)
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: true } });
    const source = ctx.createMediaStreamSource(stream);
    const rnnoise = new lib.RnnoiseWorkletNode(ctx, { wasmBinary: wasm, maxChannels: 1 });
    const out = ctx.createMediaStreamDestination();
    source.connect(rnnoise).connect(out);
    const mic = stream;
    return {
      track: out.stream.getAudioTracks()[0],
      close() {
        source.disconnect();
        rnnoise.disconnect();
        rnnoise.destroy();
        mic.getTracks().forEach((t) => t.stop());
        out.stream.getTracks().forEach((t) => t.stop());
      },
    };
  } catch {
    stream?.getTracks().forEach((t) => t.stop());
    return null;
  }
}
