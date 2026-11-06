import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DOCK } from "./island";
import { MODELS } from "./models";

// The GLBs that models.tsx draws, as `npm run models` built them: each part named, each material named after its colour.

interface Gltf {
  nodes: { name?: string; mesh?: number; scale?: number[]; children?: number[]; translation?: number[] }[];
  extensionsRequired?: string[];
  meshes: { primitives: { material?: number }[] }[];
  materials: { name: string }[];
}

function gltf(name: string): Gltf {
  const glb = readFileSync(join(process.cwd(), "public/models", `${name}.glb`));
  expect(glb.toString("ascii", 0, 4)).toBe("glTF");
  const length = glb.readUInt32LE(12);
  return JSON.parse(glb.toString("utf8", 20, 20 + length));
}

// a part is a named node holding a mesh, directly or (after gltfpack) through an unnamed child
const parts = (g: Gltf) =>
  g.nodes
    .filter((n) => n.name && (n.mesh !== undefined || n.children?.some((c) => !g.nodes[c].name && g.nodes[c].mesh !== undefined)))
    .map((n) => n.name!.replace(/[._]\d+$/, ""));

describe("sand3d models", () => {
  it.each(MODELS)("%s: every material carries its colour", (name) => {
    const g = gltf(name);
    for (const m of g.meshes) for (const p of m.primitives) expect(g.materials[p.material!].name).toMatch(/#[0-9a-f]{6}/i);
  });

  it.each(MODELS)("%s: exported in metres", (name) => {
    const scale = gltf(name).nodes.find((n) => n.name === name)?.scale;
    expect(scale).toHaveLength(3);
    for (const s of scale!) expect(s).toBeCloseTo(0.001, 6);
  });

  it.each(MODELS)("%s: meshopt-compressed (built by npm run models)", (name) => {
    expect(gltf(name).extensionsRequired).toContain("EXT_meshopt_compression");
  });

  it("the table has the top that lights up on hover", () => {
    expect(parts(gltf("table"))).toContain("top");
  });

  it("the parts the world draws its own way are there", () => {
    expect(parts(gltf("cottage"))).toEqual(expect.arrayContaining(["walls", "glass", "footing", "bloom", "step"]));
    expect(parts(gltf("windmill"))).toEqual(expect.arrayContaining(["tower", "base", "sack"]));
    expect(parts(gltf("sails"))).toContain("cloth");
    expect(parts(gltf("dock"))).toContain("bucket");
  });

  it("the dock is as long as DOCK, so the lantern sits on its post", () => {
    const post = gltf("dock").nodes.find((n) => n.name === "lantern_post")!.translation!; // mm, in the model's space
    expect(post[0] / 1000).toBeCloseTo(-0.36, 3);
    expect(post[1] / 1000 + 0.5).toBeCloseTo(0.57, 3); // its top, where pond.tsx hangs the lantern
    expect(post[2] / 1000).toBeCloseTo(DOCK.length - 0.06, 3);
  });

  it("the chair has its seat, four legs, two posts and two rails", () => {
    const counts = Object.groupBy(parts(gltf("chair")), (p) => p);
    expect(Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v!.length]))).toEqual({ seat: 1, leg: 4, post: 2, rail: 2 });
  });
});
