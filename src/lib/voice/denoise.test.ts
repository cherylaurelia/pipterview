import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canDenoise } from "./denoise";

const mic = { mediaDevices: { getUserMedia: () => Promise.resolve() } };

describe("canDenoise", () => {
  it("tries in Chromium, where recognition can listen to a track", () => {
    expect(canDenoise({ userAgentData: {}, ...mic } as unknown as Navigator, { AudioWorkletNode: class {} } as unknown as typeof globalThis)).toBe(true);
  });

  it("leaves Safari and Firefox on the plain mic", () => {
    expect(canDenoise({ ...mic } as unknown as Navigator, { AudioWorkletNode: class {} } as unknown as typeof globalThis)).toBe(false);
  });

  it("needs AudioWorklet and a microphone", () => {
    expect(canDenoise({ userAgentData: {}, ...mic } as unknown as Navigator, {} as typeof globalThis)).toBe(false);
    expect(canDenoise({ userAgentData: {} } as unknown as Navigator, { AudioWorkletNode: class {} } as unknown as typeof globalThis)).toBe(false);
  });
});

describe("the RNNoise files in public/voice", () => {
  const pkg = join(process.cwd(), "node_modules/@sapphi-red/web-noise-suppressor/dist");
  it.each([
    ["rnnoise.wasm", "rnnoise.wasm"],
    ["rnnoise_simd.wasm", "rnnoise_simd.wasm"],
    ["rnnoiseWorklet.js", "rnnoise/workletProcessor.js"],
  ])("%s is the installed package's (copy it again after upgrading it)", (served, original) => {
    expect(readFileSync(join(process.cwd(), "public/voice", served)).equals(readFileSync(join(pkg, original)))).toBe(true);
  });
});
