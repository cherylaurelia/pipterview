import { beforeEach, describe, expect, it, vi } from "vitest";

// fresh module state for each test (quality keeps what it has measured)
async function load() {
  vi.resetModules();
  return import("./quality");
}

describe("auto quality", () => {
  beforeEach(() => vi.resetModules());

  it("stays at full quality on a fast machine", async () => {
    const { quality, measureFrame } = await load();
    for (let i = 0; i < 60 * 10; i++) measureFrame(1 / 60);
    expect(quality.level).toBe(2);
  });

  it("steps down one level at a time when frames are slow, and never below lite", async () => {
    const { quality, measureFrame } = await load();
    const run = (seconds: number, fps: number) => {
      for (let i = 0; i < seconds * fps; i++) measureFrame(1 / fps);
    };
    run(6, 20); // 1.5 s settling, then 4 s at 20 fps
    expect(quality.level).toBe(1);
    run(6, 20);
    expect(quality.level).toBe(0);
    run(12, 20);
    expect(quality.level).toBe(0);
  });

  it("ignores slow frames while shaders compile at the start", async () => {
    const { quality, measureFrame } = await load();
    measureFrame(1.2); // one long first frame
    for (let i = 0; i < 60 * 6; i++) measureFrame(1 / 60);
    expect(quality.level).toBe(2);
  });

  it("lets a chosen setting override what auto measured", async () => {
    const { quality, measureFrame } = await load();
    for (let i = 0; i < 20 * 6; i++) measureFrame(1 / 20);
    expect(quality.level).toBe(1);
    quality.setting = "full";
    expect(quality.level).toBe(2);
    quality.setting = "lite";
    expect(quality.level).toBe(0);
  });
});
