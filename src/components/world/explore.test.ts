import { describe, expect, it } from "vitest";
import { canStand, DOORS, getUp, nearestDoor, nearestSeat, player, setSeat, sitOn } from "./explore";
import { BRIDGE, DOCK, groundY, POND, surfaceY, walkable, waterNearness } from "./island";
import { CROWNS, slideRoundPlants } from "./landscape";

// The rules for walking about the island as your chick (see explore.ts and player.tsx).

describe("where you can walk", () => {
  it("keeps you out of the table and chairs, the pond and off the edge", () => {
    expect(walkable(0, 0)).toBe(false); // the table
    expect(walkable(0, 1.15)).toBe(false); // your chair
    expect(walkable(POND.x, POND.z)).toBe(false); // the middle of the pond
    expect(walkable(14, 0)).toBe(false); // over the edge
    expect(walkable(0.9, 2.4)).toBe(true); // where you start
  });

  it("lets you walk out along the dock, over the water", () => {
    const along = { x: DOCK.x + Math.sin(DOCK.angle) * 1.2, z: DOCK.z + Math.cos(DOCK.angle) * 1.2 };
    expect(walkable(along.x, along.z)).toBe(true);
    expect(surfaceY(along.x, along.z)).toBeGreaterThan(0); // on the boards, above the water
  });

  it("lets you cross the stream only by the bridge, up and over its arch", () => {
    expect(walkable(BRIDGE.x, BRIDGE.z)).toBe(true);
    expect(surfaceY(BRIDGE.x, BRIDGE.z)).toBeGreaterThan(groundY(BRIDGE.x, BRIDGE.z) + 0.3);
    // a little way upstream of the bridge is water
    const side = { x: BRIDGE.x + Math.cos(BRIDGE.angle) * 2.2, z: BRIDGE.z - Math.sin(BRIDGE.angle) * 2.2 };
    expect(walkable(side.x, side.z)).toBe(false);
  });
});

describe("sliding round trees and bushes", () => {
  it("nudges you out of a tree trunk to just touching it", () => {
    const tree = CROWNS[0];
    const out = slideRoundPlants(tree.x + 0.01, tree.z, 0.22);
    expect(Math.hypot(out.x - tree.x, out.z - tree.z)).toBeGreaterThan(0.22);
  });

  it("leaves you alone in the open", () => {
    expect(slideRoundPlants(0.9, 2.4, 0.22)).toEqual({ x: 0.9, z: 2.4 });
  });
});

describe("benches", () => {
  it("can be sat on, block the way, and put you back on your feet in front", () => {
    setSeat("test", { x: 3, z: 3, y: 0.46, heading: 0 }); // facing +z
    expect(canStand(3, 3)).toBe(false); // inside the bench
    expect(nearestSeat(3, 3.8, 1.3)).toBe("test");
    sitOn("test");
    expect(player.sitting).toBe("test");
    getUp();
    expect(player.sitting).toBeNull();
    expect(player.pos.z).toBeCloseTo(3.75, 2); // just in front of it
    setSeat("test", null);
    expect(nearestSeat(3, 3.8, 1.3)).toBeNull();
  });
});

describe("doors", () => {
  it("can be reached from open ground outside them", () => {
    for (const door of DOORS) {
      // somewhere within reach of the door that you can actually stand on
      const spot = [0.4, 0.6, 0.8, 1.0].flatMap((r) => Array.from({ length: 16 }, (_, i) => ({ x: door.x + Math.cos(i) * r, z: door.z + Math.sin(i) * r }))).find((p) => canStand(p.x, p.z));
      expect(spot, door.id).toBeDefined();
      expect(nearestDoor(spot!.x, spot!.z, 1.2)).toBe(door.id);
    }
  });

  it("aren't offered from across the island", () => {
    expect(nearestDoor(0.9, 2.4, 1.2)).toBeNull();
  });
});

describe("the sound of water", () => {
  it("is loud by the stream, soft at the table, and all but gone across the island", () => {
    const byStream = waterNearness(BRIDGE.x + Math.cos(BRIDGE.angle) * 1.6, BRIDGE.z - Math.sin(BRIDGE.angle) * 1.6);
    const atTable = waterNearness(0.9, 2.4);
    const farAway = waterNearness(9, 6);
    expect(byStream).toBeGreaterThan(0.8);
    expect(atTable).toBeGreaterThan(0.05);
    expect(atTable).toBeLessThan(byStream);
    expect(farAway).toBeLessThan(0.1);
  });
});
