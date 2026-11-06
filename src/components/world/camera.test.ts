import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { Avoidance, blockedAt, BOXES, clearView, MAX_LIFT, orbit } from "./camera";
import { COTTAGE, COTTAGE_TURN } from "./island";

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe("blockedAt", () => {
  it("sees the cottage between you and a camera on its far side", () => {
    const cos = Math.cos(COTTAGE_TURN), sin = Math.sin(COTTAGE_TURN);
    const front = v(COTTAGE.x + sin * 3, 0.8, COTTAGE.z + cos * 3), behind = v(COTTAGE.x - sin * 4, 1.5, COTTAGE.z - cos * 4);
    expect(blockedAt(front, behind)).toBeLessThan(1);
  });

  it("ignores a box or sphere you're standing inside the padding of", () => {
    const b = BOXES[0];
    expect(blockedAt(v(b.x, b.y, b.z), v(b.x + 20, b.y + 5, b.z))).toBe(1);
    expect(blockedAt(v(0, 0.6, 0), v(0, 6, 6), [{ x: 0, y: 0.6, z: 0, r: 1.3 }], [])).toBe(1);
  });

  it("is clear when nothing's in the way", () => {
    expect(blockedAt(v(0, 1, 0), v(0, 5, 5), [{ x: 10, y: 1, z: 10, r: 1 }], [])).toBe(1);
  });
});

describe("clearView", () => {
  const ball = [{ x: 0, y: 1, z: 2, r: 0.8 }];

  it("rises just enough to see over something, and no more", () => {
    const look = v(0, 0.7, 0);
    const { lift, reach } = clearView(look, 0, 0.3, 6, ball, []);
    expect(reach).toBe(1);
    expect(lift).toBeGreaterThan(0);
    expect(blockedAt(look, orbit(new THREE.Vector3(), look, 0, 0.3, 6, lift), ball, [])).toBe(1);
    expect(blockedAt(look, orbit(new THREE.Vector3(), look, 0, 0.3, 6, lift - 0.06), ball, [])).toBeLessThan(1);
  });

  it("changes smoothly as you walk past, never jumping between fixed heights", () => {
    let last = clearView(v(-3, 0.7, 0), 0, 0.3, 6, ball, []).lift, worst = 0;
    for (let x = -3; x <= 3; x += 0.05) {
      const { lift } = clearView(v(x, 0.7, 0), 0, 0.3, 6, ball, []);
      worst = Math.max(worst, Math.abs(lift - last));
      last = lift;
    }
    expect(worst).toBeLessThan(0.08);
  });

  it("comes in closer only when even the full rise isn't enough", () => {
    const wall = [{ x: 0, y: 3, z: 2, r: 2.5 }];
    const { lift, reach } = clearView(v(0, 0.7, -0.5), 0, 0.3, 6, wall, []);
    expect(lift).toBe(MAX_LIFT);
    expect(reach).toBeLessThan(1);
  });
});

describe("Avoidance", () => {
  it("never snaps: a frame moves it only a little, even when the goal jumps", () => {
    const a = new Avoidance();
    a.update({ lift: MAX_LIFT, reach: 0.4 }, 1 / 60);
    expect(a.lift).toBeLessThan(0.06);
    expect(a.reach).toBeGreaterThan(0.95);
  });

  it("gets out of the way faster than it settles back", () => {
    const up = new Avoidance().update({ lift: 0.5, reach: 1 }, 0.2).lift;
    const settled = new Avoidance();
    settled.lift = 0.5;
    const down = 0.5 - settled.update({ lift: 0, reach: 1 }, 0.2).lift;
    expect(up).toBeGreaterThan(down * 2);
  });
});
