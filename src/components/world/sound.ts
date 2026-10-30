// The world's soundscape, with Web Audio: a lo-fi beat (soft swung drums, warm electric-piano chords, a mellow bass,
// vinyl crackle, everything through a warm low-pass), a gentle breeze, birdsong by day and crickets at dusk, and small
// cues (a chime when it's your turn, a pop when the guide speaks, a chirp when you poke Pip).
//
// Drop a royalty-free track at public/audio/lofi.mp3 and it plays (looped) instead of the synthesised beat.
//
// Everything ducks while the mic is listening, to keep it out of your answer, but stays audible: with headphones the
// mic hardly hears it anyway.

export interface SoundState {
  /** The mic is open: the music and nature step well back. */
  listening: boolean;
  /** The guide is talking: the music steps back a little. */
  speaking: boolean;
  /** Sunset: crickets instead of birds. */
  evening: boolean;
}

/** Your volume choices, 0 to 1 each. */
export interface Volumes {
  music: number;
  nature: number;
}

export interface Ambience {
  setEnabled(on: boolean): void;
  setVolumes(volumes: Volumes): void;
  setState(state: SoundState): void;
  /** It's your turn. */
  chime(): void;
  /** The guide said something. */
  pop(): void;
  /** You poked Pip. */
  chirp(): void;
  dispose(): void;
}

const TRACK_URL = "/audio/lofi.mp3";
const BPM = 72;
const EIGHTH = 60 / BPM / 2;
const SWING = 0.18; // off-beat eighths land a little late

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
// a four-bar loop of jazzy seventh/ninth chords (Fmaj9, Em7, Dm9, Cmaj7), voiced low and close like a Rhodes
const CHORDS = [
  { bass: 41, notes: [57, 60, 64, 67] },
  { bass: 40, notes: [55, 59, 62, 67] },
  { bass: 38, notes: [53, 57, 60, 64] },
  { bass: 36, notes: [55, 59, 64, 67] },
];
const MELODY = [72, 74, 76, 79, 81, 84]; // C major pentatonic, for the occasional music-box note

const LEVELS = { master: 0.6, music: 0.5, nature: 0.3, fx: 0.45 };
const DUCK = { listening: { music: 0.35, nature: 0.4 }, speaking: { music: 0.6, nature: 1 } };

export function createAmbience(): Ambience {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const bus = (level: number, out: AudioNode = master) => {
    const g = ctx.createGain();
    g.gain.value = level;
    g.connect(out);
    return g;
  };
  // the music runs through a warm low-pass, like it's coming off an old tape
  const warmth = ctx.createBiquadFilter();
  warmth.type = "lowpass";
  warmth.frequency.value = 3200;
  warmth.Q.value = 0.4;
  warmth.connect(master);
  const music = bus(LEVELS.music, warmth), nature = bus(LEVELS.nature), fx = bus(LEVELS.fx);

  // a soft room: a convolver fed with decaying stereo noise
  const reverb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 2.4);
  const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  reverb.buffer = impulse;
  const wet = ctx.createGain();
  wet.gain.value = 0.25;
  reverb.connect(wet).connect(master);
  const send = (node: AudioNode, amount: number) => {
    const g = ctx.createGain();
    g.gain.value = amount;
    node.connect(g).connect(reverb);
  };
  send(music, 0.35);
  send(fx, 0.5);

  const noiseBuffer = (seconds: number, brown = false) => {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * white) / 1.02; // brown noise: a soft rumble rather than a hiss
        d[i] = last * 3.5;
      } else d[i] = white;
    }
    return buf;
  };
  const white = noiseBuffer(1);

  // the breeze: quiet now, a soft bed under everything
  const wind = ctx.createBufferSource();
  wind.buffer = noiseBuffer(4, true);
  wind.loop = true;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = "lowpass";
  windFilter.frequency.value = 380;
  const windGain = ctx.createGain();
  windGain.gain.value = 0.22;
  const swell = ctx.createOscillator();
  swell.frequency.value = 0.06;
  const swellDepth = ctx.createGain();
  swellDepth.gain.value = 0.1;
  swell.connect(swellDepth).connect(windGain.gain);
  wind.connect(windFilter).connect(windGain).connect(nature);
  wind.start();
  swell.start();

  // vinyl crackle: sparse clicks and a faint hiss, looped
  const crackleBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const cd = crackleBuf.getChannelData(0);
  for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * 0.015 + (Math.random() < 0.0004 ? (Math.random() - 0.5) * 0.9 : 0);
  const crackle = ctx.createBufferSource();
  crackle.buffer = crackleBuf;
  crackle.loop = true;
  const crackleTone = ctx.createBiquadFilter();
  crackleTone.type = "highpass";
  crackleTone.frequency.value = 1200;
  const crackleGain = ctx.createGain();
  crackleGain.gain.value = 0.18;
  crackle.connect(crackleTone).connect(crackleGain).connect(music);
  crackle.start();

  let state: SoundState = { listening: false, speaking: false, evening: false };
  let volumes: Volumes = { music: 0.7, nature: 0.7 };
  let enabled = false;
  let track: HTMLAudioElement | null = null; // a real lo-fi track, if one's been added
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  /** One enveloped tone: attack, then an exponential fade. */
  const tone = (out: AudioNode, freq: number, at: number, opts: { type?: OscillatorType; peak: number; attack?: number; decay: number; glide?: number; pan?: number; tremolo?: number }) => {
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(freq, at);
    if (opts.glide) osc.frequency.exponentialRampToValueAtTime(freq * opts.glide, at + opts.decay * 0.6);
    const g = ctx.createGain();
    const attack = opts.attack ?? 0.008;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(opts.peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + opts.decay);
    let node: AudioNode = osc.connect(g);
    if (opts.tremolo) {
      // the electric piano's gentle wobble
      const trem = ctx.createGain();
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = opts.tremolo;
      depth.gain.value = 0.25;
      trem.gain.value = 0.75;
      lfo.connect(depth).connect(trem.gain);
      lfo.start(at);
      lfo.stop(at + attack + opts.decay + 0.05);
      node = node.connect(trem);
    }
    if (opts.pan !== undefined) {
      const p = ctx.createStereoPanner();
      p.pan.value = opts.pan;
      node = node.connect(p);
    }
    node.connect(out);
    osc.start(at);
    osc.stop(at + attack + opts.decay + 0.05);
  };

  /** A burst of filtered noise, for snares and hats. */
  const hit = (at: number, opts: { type: BiquadFilterType; freq: number; peak: number; decay: number }) => {
    const src = ctx.createBufferSource();
    src.buffer = white;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.type;
    filter.frequency.value = opts.freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.peak, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + opts.decay);
    src.connect(filter).connect(g).connect(music);
    src.start(at);
    src.stop(at + opts.decay + 0.05);
  };

  const kick = (at: number) => {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(110, at);
    osc.frequency.exponentialRampToValueAtTime(42, at + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.55, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.38);
    osc.connect(g).connect(music);
    osc.start(at);
    osc.stop(at + 0.42);
  };

  // birds by day: a short phrase of chirps from somewhere in the field, every few seconds
  const birds = () => {
    later(birds, 3500 + Math.random() * 6000);
    if (!enabled || state.evening) return;
    const at = ctx.currentTime + 0.05, base = 2400 + Math.random() * 1800, pan = Math.random() * 1.6 - 0.8;
    const notes = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < notes; i++) {
      tone(nature, base * (1 + (Math.random() - 0.3) * 0.25), at + i * (0.09 + Math.random() * 0.06), { peak: 0.04, decay: 0.07 + Math.random() * 0.05, glide: 1.25 + Math.random() * 0.3, pan });
    }
  };
  // crickets at dusk: trains of quick high pulses
  const crickets = () => {
    later(crickets, 900 + Math.random() * 1500);
    if (!enabled || !state.evening) return;
    const at = ctx.currentTime + 0.05, pan = Math.random() * 1.4 - 0.7;
    for (let i = 0; i < 3; i++) tone(nature, 4300 + Math.random() * 200, at + i * 0.045, { peak: 0.015, attack: 0.004, decay: 0.03, pan });
  };

  // the beat, scheduled an eighth note at a time, a little ahead of the clock
  let nextStep = ctx.currentTime + 0.3, step = 0;
  const scheduler = setInterval(() => {
    while (nextStep < ctx.currentTime + 0.3) {
      const at = nextStep + (step % 2 ? SWING * EIGHTH : 0);
      const beatInBar = step % 8; // 8 eighths to a bar
      const bar = Math.floor(step / 8);
      if (enabled && !track) {
        const chord = CHORDS[bar % CHORDS.length];
        // drums: kick on 1 and the "and" of 3, snare on 2 and 4, soft hats on every eighth
        if (beatInBar === 0 || beatInBar === 5) kick(at);
        if (beatInBar === 2 || beatInBar === 6) hit(at, { type: "bandpass", freq: 1800, peak: 0.16, decay: 0.16 });
        hit(at, { type: "highpass", freq: 7000, peak: beatInBar % 2 ? 0.025 : 0.04, decay: 0.035 });
        // keys: the chord on the downbeat, a softer stab on the "and" of 2
        if (beatInBar === 0 || beatInBar === 3) {
          chord.notes.forEach((n, i) => {
            tone(music, midi(n), at + i * 0.012, { type: "sine", peak: beatInBar === 0 ? 0.05 : 0.03, attack: 0.012, decay: beatInBar === 0 ? 2.6 : 1.2, tremolo: 4.5 });
            tone(music, midi(n) * 2, at + i * 0.012, { type: "sine", peak: 0.008, decay: 0.6 }); // the bell-like attack of a Rhodes
          });
        }
        // bass: the root on 1, a fifth on the "and" of 3
        if (beatInBar === 0) tone(music, midi(chord.bass), at, { type: "triangle", peak: 0.16, attack: 0.02, decay: 1.4 });
        if (beatInBar === 5) tone(music, midi(chord.bass + 7), at, { type: "triangle", peak: 0.1, attack: 0.02, decay: 0.7 });
        // now and then, a music-box note on top
        if (beatInBar % 2 === 0 && Math.random() < 0.18) tone(music, midi(MELODY[Math.floor(Math.random() * MELODY.length)]), at, { type: "triangle", peak: 0.035, decay: 1.2 });
      }
      nextStep += EIGHTH;
      step++;
    }
  }, 100);
  birds();
  crickets();

  // a real track, if one has been added to public/audio
  fetch(TRACK_URL, { method: "HEAD" })
    .then((res) => {
      if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("audio")) return;
      track = new Audio(TRACK_URL);
      track.loop = true;
      ctx.createMediaElementSource(track).connect(music);
      if (enabled) void track.play().catch(() => {});
    })
    .catch(() => {});

  const ramp = (param: AudioParam, value: number, seconds = 0.4) => param.setTargetAtTime(value, ctx.currentTime, seconds / 3);
  const mix = () => {
    const duck = state.listening ? DUCK.listening : state.speaking ? DUCK.speaking : { music: 1, nature: 1 };
    // your volume scales each bus; 0.7 is the designed mix
    ramp(music.gain, LEVELS.music * duck.music * (volumes.music / 0.7));
    ramp(nature.gain, LEVELS.nature * duck.nature * (volumes.nature / 0.7));
  };

  return {
    setEnabled(on) {
      enabled = on;
      if (on) {
        void ctx.resume();
        if (track) void track.play().catch(() => {});
      } else track?.pause();
      ramp(master.gain, on ? LEVELS.master : 0, 0.8);
    },
    setState(next) {
      state = next;
      mix();
    },
    setVolumes(next) {
      volumes = next;
      mix();
    },
    chime() {
      if (!enabled) return;
      const at = ctx.currentTime + 0.02;
      tone(fx, 1318.51, at, { peak: 0.06, decay: 1.2 });
      tone(fx, 1975.53, at + 0.12, { peak: 0.045, decay: 1.4 });
    },
    pop() {
      if (!enabled) return;
      tone(fx, 620, ctx.currentTime + 0.01, { peak: 0.05, attack: 0.005, decay: 0.09, glide: 1.5 });
    },
    chirp() {
      if (!enabled) return;
      const at = ctx.currentTime + 0.01;
      tone(fx, 1900, at, { peak: 0.07, attack: 0.004, decay: 0.08, glide: 1.4 });
      tone(fx, 2300, at + 0.11, { peak: 0.06, attack: 0.004, decay: 0.1, glide: 1.35 });
    },
    dispose() {
      clearInterval(scheduler);
      timers.forEach(clearTimeout);
      timers.clear();
      track?.pause();
      void ctx.close();
    },
  };
}
