"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { daylight } from "./daylight";
import { setSeat } from "./explore";
import { BENCHES, BoxLantern, COTTAGE, COTTAGE_TURN, FIELD, groundY, rng, WINDMILL, WINDMILL_TURN } from "./island";
import { softDot } from "./textures";
import { swayingToon, toon } from "./toon";

// The island's little bits of village: a half-timbered cottage with shuttered windows, flower boxes and a smoking
// chimney; a windmill on a stone base with a balcony, latticed sails and flour sacks at the door; a field of swaying
// wheat inside a rail fence, with hay bales; and benches you can sit on.

const SEAT_HEIGHT = 0.46;

// the cottage's window glass, shared by its windows, glowing brighter as the sun goes down
let cottageGlass: THREE.MeshStandardMaterial | null = null;
const glassMaterial = () => (cottageGlass ??= new THREE.MeshStandardMaterial({ color: "#ffe7b0", emissive: "#ffb34d", emissiveIntensity: 0.1 }));

/**
 * A wooden bench (its seat faces +z) you can sit on: it tells explore.ts where its seat is, in the world, once it's in
 * place. `id` must be unique.
 */
export function Bench({ id }: { id: string }) {
  const ref = useRef<THREE.Group>(null);
  const placed = useRef(false);
  const wood = toon("#b07a4f"), dark = toon("#7a5a40");
  useFrame(() => {
    if (placed.current || !ref.current) return;
    placed.current = true;
    const g = ref.current, at = new THREE.Vector3(0, 0, 0.02), dir = new THREE.Vector3();
    g.updateWorldMatrix(true, false);
    g.localToWorld(at);
    g.getWorldDirection(dir);
    setSeat(id, { x: at.x, z: at.z, y: at.y + SEAT_HEIGHT, heading: Math.atan2(dir.x, dir.z) });
  });
  useEffect(() => () => setSeat(id, null), [id]);
  return (
    <group ref={ref}>
      {/* three slats for the seat, two for the back */}
      {[-0.13, 0, 0.13].map((z) => (
        <mesh key={z} position={[0, 0.42, z]} material={wood} castShadow receiveShadow>
          <boxGeometry args={[1.3, 0.06, 0.11]} />
        </mesh>
      ))}
      {[0.64, 0.82].map((y) => (
        <mesh key={y} position={[0, y, -0.2]} rotation={[-0.15, 0, 0]} material={wood} castShadow>
          <boxGeometry args={[1.3, 0.12, 0.05]} />
        </mesh>
      ))}
      {[-0.55, 0.55].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.2, 0]} material={dark} castShadow>
            <boxGeometry args={[0.08, 0.42, 0.36]} />
          </mesh>
          <mesh position={[x, 0.62, -0.19]} rotation={[-0.15, 0, 0]} material={dark} castShadow>
            <boxGeometry args={[0.07, 0.5, 0.06]} />
          </mesh>
          {/* armrests */}
          <mesh position={[x * 1.05, 0.55, -0.02]} material={dark} castShadow>
            <boxGeometry args={[0.08, 0.05, 0.38]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Benches() {
  return (
    <>
      {BENCHES.map((b) => (
        <group key={b.id} position={[b.x, groundY(b.x, b.z), b.z]} rotation={[0, b.angle, 0]}>
          <Bench id={b.id} />
        </group>
      ))}
    </>
  );
}

/** Soft puffs of smoke rising from a chimney and fading as they go. */
function Smoke({ position }: { position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const map = useMemo(() => softDot(), []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    group.current?.children.forEach((puff, i) => {
      const k = (t * 0.18 + i / 6) % 1;
      puff.position.set(Math.sin(t * 0.7 + i) * 0.15 + k * 0.4, k * 2.2, Math.cos(t * 0.5 + i) * 0.1);
      puff.scale.setScalar(0.25 + k * 0.7);
      ((puff as THREE.Sprite).material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.55;
    });
  });
  return (
    <group ref={group} position={position}>
      {Array.from({ length: 6 }, (_, i) => (
        <sprite key={i}>
          <spriteMaterial map={map} color="#f4efe8" transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}

/** A window: a pale frame with a cross of glazing bars, glass that glows at dusk, shutters, and a box of flowers below. */
function CottageWindow({ position, rotationY = 0, glass }: { position: [number, number, number]; rotationY?: number; glass: THREE.Material }) {
  const frame = toon("#fff6e6", true), shutter = toon("#6f9fb0");
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh material={frame}>
        <boxGeometry args={[0.44, 0.42, 0.05]} />
      </mesh>
      <mesh position={[0, 0, 0.012]} material={glass}>
        <boxGeometry args={[0.36, 0.34, 0.04]} />
      </mesh>
      <mesh position={[0, 0, 0.035]} material={frame}>
        <boxGeometry args={[0.03, 0.34, 0.02]} />
      </mesh>
      <mesh position={[0, 0, 0.035]} material={frame}>
        <boxGeometry args={[0.36, 0.03, 0.02]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.32, 0, 0.01]} rotation={[0, side * -0.25, 0]} material={shutter} castShadow>
          <boxGeometry args={[0.2, 0.44, 0.03]} />
        </mesh>
      ))}
      {/* the flower box */}
      <mesh position={[0, -0.27, 0.08]} material={toon("#8a5a3c")} castShadow>
        <boxGeometry args={[0.48, 0.1, 0.14]} />
      </mesh>
      {[-0.18, -0.09, 0, 0.09, 0.18].map((x, i) => (
        <mesh key={x} position={[x, -0.18, 0.08 + (i % 2) * 0.03]} material={toon(["#ff9fb8", "#ffd84a", "#ffffff", "#ff9fb8", "#c9a8f0"][i], true)}>
          <sphereGeometry args={[0.045, 10, 8]} />
        </mesh>
      ))}
      {[-0.2, 0.2].map((x) => (
        <mesh key={x} position={[x, -0.2, 0.09]} material={toon("#6fb84a")}>
          <sphereGeometry args={[0.04, 8, 6]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The cottage: cream walls with dark timber framing on a stone footing, a deep red roof that overhangs, a chimney with
 * smoke, a front door with a step, knob and lantern, shuttered windows with flower boxes that light up at sunset, and
 * a stack of firewood round the side.
 */
function Cottage() {
  const glass = glassMaterial();
  useFrame(() => {
    glassMaterial().emissiveIntensity = 0.1 + daylight.evening * 1.6;
  });
  const roof = useMemo(() => {
    const shape = new THREE.Shape([new THREE.Vector2(-1.38, 0), new THREE.Vector2(1.38, 0), new THREE.Vector2(0, 1.15)]);
    return new THREE.ExtrudeGeometry(shape, { depth: 2.5, bevelEnabled: false }).translate(0, 0, -1.25);
  }, []);
  const beam = toon("#7d5236");
  return (
    <group position={[COTTAGE.x, groundY(COTTAGE.x, COTTAGE.z), COTTAGE.z]} rotation={[0, COTTAGE_TURN, 0]}>
      <mesh position={[0, 0.08, 0]} material={toon("#c9c0b2", true)} castShadow receiveShadow>
        <boxGeometry args={[2.22, 0.16, 2.12]} />
      </mesh>
      <mesh position={[0, 0.73, 0]} material={toon("#f6ecdc", true)} castShadow receiveShadow>
        <boxGeometry args={[2.1, 1.3, 2.0]} />
      </mesh>
      {/* timber framing: corner posts and a band under the eaves */}
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <mesh key={`${x}${z}`} position={[x * 1.05, 0.73, z * 1.0]} material={beam} castShadow>
            <boxGeometry args={[0.1, 1.32, 0.1]} />
          </mesh>
        )),
      )}
      {[-1, 1].map((z) => (
        <mesh key={z} position={[0, 1.33, z * 1.01]} material={beam}>
          <boxGeometry args={[2.14, 0.09, 0.06]} />
        </mesh>
      ))}
      <mesh position={[0, 1.38, 0]} geometry={roof} material={toon("#c8644c")} castShadow />
      <mesh position={[0, 2.54, 0]} rotation={[Math.PI / 2, 0, 0]} material={toon("#9e4a38")} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 2.56, 8]} />
      </mesh>
      <mesh position={[0.6, 2.1, -0.35]} material={toon("#b6a898")} castShadow>
        <boxGeometry args={[0.3, 0.75, 0.3]} />
      </mesh>
      <mesh position={[0.6, 2.5, -0.35]} material={toon("#8f8378")}>
        <boxGeometry args={[0.36, 0.07, 0.36]} />
      </mesh>
      <Smoke position={[0.6, 2.6, -0.35]} />

      {/* the door: frame, door, knob, a stone step and a lantern beside it */}
      <mesh position={[0, 0.58, 1.01]} material={beam}>
        <boxGeometry args={[0.56, 0.98, 0.04]} />
      </mesh>
      <mesh position={[0, 0.56, 1.03]} material={toon("#8a5a3c")}>
        <boxGeometry args={[0.44, 0.88, 0.04]} />
      </mesh>
      <mesh position={[0.14, 0.55, 1.07]} material={toon("#e8c45a")}>
        <sphereGeometry args={[0.03, 10, 8]} />
      </mesh>
      <mesh position={[0, 0.05, 1.22]} material={toon("#d8d0c4", true)} receiveShadow>
        <boxGeometry args={[0.7, 0.1, 0.35]} />
      </mesh>
      <BoxLantern position={[0.42, 0.95, 1.08]} scale={0.8} />

      <CottageWindow position={[-0.65, 0.82, 1.02]} glass={glass} />
      <CottageWindow position={[0.68, 0.82, 1.02]} glass={glass} />
      <CottageWindow position={[1.06, 0.82, 0]} rotationY={Math.PI / 2} glass={glass} />
      <CottageWindow position={[-1.06, 0.82, 0]} rotationY={-Math.PI / 2} glass={glass} />

      {/* firewood stacked against the side wall */}
      {[0, 1, 2].flatMap((row) =>
        Array.from({ length: 4 - row }, (_, i) => (
          <mesh key={`${row}${i}`} position={[-1.3, 0.1 + row * 0.15, -0.55 + i * 0.16 + row * 0.08]} rotation={[0, 0, Math.PI / 2]} material={toon(i % 2 ? "#a77a4f" : "#b88a5a")} castShadow>
            <cylinderGeometry args={[0.075, 0.075, 0.5, 8]} />
          </mesh>
        )),
      )}
    </group>
  );
}

/**
 * The windmill: a tapering white tower on a stone base, with little windows, a wooden balcony round its middle, a red
 * cap with a finial, latticed sails that turn in the breeze, and sacks of flour and a barrel by the door.
 */
function Windmill() {
  const sails = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (sails.current) sails.current.rotation.z += dt * 0.5;
  });
  const wood = toon("#7a5a40"), stone = toon("#c9c0b2", true);
  return (
    <group position={[WINDMILL.x, groundY(WINDMILL.x, WINDMILL.z), WINDMILL.z]} rotation={[0, WINDMILL_TURN, 0]}>
      <mesh position={[0, 0.17, 0]} material={stone} castShadow receiveShadow>
        <cylinderGeometry args={[0.78, 0.84, 0.34, 12]} />
      </mesh>
      <mesh position={[0, 1.35, 0]} material={toon("#efe6d6", true)} castShadow receiveShadow>
        <cylinderGeometry args={[0.45, 0.68, 2.4, 10]} />
      </mesh>
      <mesh position={[0, 2.9, 0]} material={toon("#c8644c")} castShadow>
        <coneGeometry args={[0.62, 0.8, 10]} />
      </mesh>
      <mesh position={[0, 3.36, 0]} material={toon("#e8c45a")}>
        <sphereGeometry args={[0.07, 10, 8]} />
      </mesh>
      {/* the balcony: a deck ring, and railing posts round it */}
      <mesh position={[0, 1.7, 0]} material={wood} castShadow>
        <cylinderGeometry args={[0.82, 0.82, 0.06, 16]} />
      </mesh>
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.78, 1.86, Math.sin(a) * 0.78]} material={wood}>
            <cylinderGeometry args={[0.018, 0.018, 0.3, 5]} />
          </mesh>
        );
      })}
      <mesh position={[0, 2.0, 0]} rotation={[Math.PI / 2, 0, 0]} material={wood}>
        <torusGeometry args={[0.78, 0.022, 5, 32]} />
      </mesh>
      {/* the door, and two little windows above it */}
      <mesh position={[0, 0.65, 0.63]} rotation={[-0.09, 0, 0]} material={toon("#8a5a3c")}>
        <boxGeometry args={[0.34, 0.62, 0.06]} />
      </mesh>
      {[1.25, 2.3].map((y, i) => (
        <group key={y} position={[0, y, 0.6 - i * 0.1]} rotation={[-0.09, 0, 0]}>
          <mesh material={toon("#fff6e6", true)}>
            <boxGeometry args={[0.24, 0.26, 0.05]} />
          </mesh>
          <mesh position={[0, 0, 0.02]} material={toon("#5e7f96")}>
            <boxGeometry args={[0.17, 0.19, 0.03]} />
          </mesh>
        </group>
      ))}
      {/* sails: a stock and a lattice of bars for each, with cloth over most of it */}
      <group ref={sails} position={[0, 2.4, 0.62]}>
        <mesh material={wood} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.2, 10]} />
        </mesh>
        {[0, 1, 2, 3].map((k) => (
          <group key={k} rotation={[0, 0, (k * Math.PI) / 2]}>
            <mesh position={[0, 0.8, 0]} material={wood}>
              <boxGeometry args={[0.05, 1.6, 0.04]} />
            </mesh>
            {[0.35, 0.6, 0.85, 1.1, 1.35].map((y) => (
              <mesh key={y} position={[0.13, y, 0.01]} material={wood}>
                <boxGeometry args={[0.26, 0.025, 0.025]} />
              </mesh>
            ))}
            <mesh position={[0.25, 0.85, 0.01]} material={wood}>
              <boxGeometry args={[0.025, 1.1, 0.025]} />
            </mesh>
            <mesh position={[0.13, 0.95, 0.02]} material={toon("#f3ede2", true)}>
              <boxGeometry args={[0.22, 0.9, 0.01]} />
            </mesh>
          </group>
        ))}
      </group>
      {/* flour sacks and a barrel by the door */}
      {[
        [0.5, 0.15, 0.75, 0.2],
        [0.72, 0.13, 0.62, -0.4],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, r, 0]} scale={[0.17, 0.15, 0.13]} material={toon("#e8dcc2", true)} castShadow>
          <sphereGeometry args={[1, 12, 10]} />
        </mesh>
      ))}
      <mesh position={[-0.6, 0.22, 0.7]} material={toon("#a26e45")} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.44, 12]} />
      </mesh>
      {[0.08, 0.36].map((y) => (
        <mesh key={y} position={[-0.6, y, 0.7]} rotation={[Math.PI / 2, 0, 0]} material={toon("#5e5650")}>
          <torusGeometry args={[0.162, 0.012, 4, 20]} />
        </mesh>
      ))}
    </group>
  );
}

/** A field of wheat: rows of golden stalks with heavy ears, swaying in the breeze, inside a rail fence, with hay bales. */
function WheatField() {
  const stalks = useRef<THREE.InstancedMesh>(null);
  const COUNT = 1100;
  // a stalk: a thin stem and an ear of grain at the top, coloured in, so one instanced mesh draws them all
  const geometry = useMemo(() => {
    const paint = (g: THREE.BufferGeometry, hex: string) => {
      const c = new THREE.Color(hex), n = g.attributes.position.count;
      g.setAttribute("color", new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [c.r, c.g, c.b]).flat(), 3));
      g.deleteAttribute("uv");
      return g.toNonIndexed();
    };
    const parts = [
      paint(new THREE.CylinderGeometry(0.006, 0.009, 0.8, 4).translate(0, 0.4, 0), "#c9a446"),
      paint(new THREE.CapsuleGeometry(0.022, 0.12, 2, 6).translate(0, 0.86, 0), "#f0c95c"),
      paint(new THREE.ConeGeometry(0.004, 0.1, 3).translate(0.01, 0.98, 0), "#e8c45a"),
    ];
    const merged = new THREE.BufferGeometry();
    for (const name of ["position", "normal", "color"]) {
      const arrays = parts.map((p) => p.attributes[name].array as Float32Array);
      const out = new Float32Array(arrays.reduce((n, a) => n + a.length, 0));
      let at = 0;
      for (const a of arrays) {
        out.set(a, at);
        at += a.length;
      }
      merged.setAttribute(name, new THREE.BufferAttribute(out, 3));
    }
    return merged;
  }, []);
  useLayoutEffect(() => {
    const mesh = stalks.current;
    if (!mesh) return;
    const r = rng(91), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    const rows = 9, w = FIELD.x1 - FIELD.x0, d = FIELD.z1 - FIELD.z0;
    for (let i = 0; i < COUNT; i++) {
      // in rows across the field, a little scattered
      const row = i % rows, x = FIELD.x0 + 0.15 + (r() * (w - 0.3)), z = FIELD.z0 + 0.15 + ((row + 0.5) / rows) * (d - 0.3) + (r() - 0.5) * 0.12;
      p.set(x, groundY(x, z), z);
      e.set((r() - 0.5) * 0.25, r() * Math.PI * 2, (r() - 0.5) * 0.25);
      s.setScalar(0.65 + r() * 0.3);
      m.compose(p, q.setFromEuler(e), s);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.setScalar(0.85 + r() * 0.2));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);
  const rail = toon("#a77a4f"), post = toon("#7d5638");
  // the fence: posts round the field's edge, with two rails between them, and a gap for a gate on the near side
  const posts = useMemo(() => {
    const out: { x: number; z: number }[] = [], pad = 0.2;
    const x0 = FIELD.x0 - pad, x1 = FIELD.x1 + pad, z0 = FIELD.z0 - pad, z1 = FIELD.z1 + pad;
    for (let x = x0; x <= x1 + 1e-6; x += (x1 - x0) / 5) out.push({ x, z: z0 }, { x, z: z1 });
    for (let z = z0 + (z1 - z0) / 3; z < z1 - 1e-6; z += (z1 - z0) / 3) out.push({ x: x0, z }, { x: x1, z });
    return { out, x0, x1, z0, z1 };
  }, []);
  const { x0, x1, z0, z1 } = posts, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  return (
    <group>
      <instancedMesh ref={stalks} args={[geometry, swayingToon(true), COUNT]} castShadow />
      {posts.out.map((p, i) => (
        <mesh key={i} position={[p.x, groundY(p.x, p.z) + 0.25, p.z]} material={post} castShadow>
          <cylinderGeometry args={[0.035, 0.04, 0.5, 6]} />
        </mesh>
      ))}
      {[0.2, 0.38].map((y) => (
        <group key={y}>
          <mesh position={[cx, y, z0]} material={rail} castShadow>
            <boxGeometry args={[x1 - x0, 0.04, 0.03]} />
          </mesh>
          {/* the near side has a gap in the middle, like an open gate */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[cx + side * (x1 - x0) * 0.3, y, z1]} material={rail} castShadow>
              <boxGeometry args={[(x1 - x0) * 0.4, 0.04, 0.03]} />
            </mesh>
          ))}
          {[x0, x1].map((x) => (
            <mesh key={x} position={[x, y, cz]} material={rail} castShadow>
              <boxGeometry args={[0.03, 0.04, z1 - z0]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* round hay bales by the gate */}
      {[
        [cx - 0.9, z1 + 0.55, 0.2],
        [cx - 0.35, z1 + 0.75, -0.3],
      ].map(([x, z, r], i) => (
        <mesh key={i} position={[x, groundY(x, z) + 0.24, z]} rotation={[0, r, Math.PI / 2]} material={toon("#e3bf62")} castShadow receiveShadow>
          <cylinderGeometry args={[0.24, 0.24, 0.42, 16]} />
        </mesh>
      ))}
    </group>
  );
}

export function Village() {
  return (
    <>
      <Cottage />
      <Windmill />
      <WheatField />
      <Benches />
    </>
  );
}
