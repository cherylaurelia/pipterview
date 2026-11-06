"use client";

import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { daylight } from "./daylight";
import { setSeat } from "./explore";
import { BENCHES, BoxLantern, COTTAGE, COTTAGE_TURN, FIELD, groundY, rng, WINDMILL, WINDMILL_TURN } from "./island";
import { Model, pale } from "./models";
import { softDot } from "./textures";
import { paintedToon, swayingToon, toon } from "./toon";

// The island's little bits of village: a half-timbered cottage with shuttered windows, flower boxes and a smoking
// chimney; a windmill on a stone base with a balcony, latticed sails and flour sacks at the door; a field of swaying
// wheat inside a rail fence, with hay bales; and benches you can sit on.

const SEAT_HEIGHT = 0.46;

// the cottage's window glass, shared by its windows, glowing brighter as the sun goes down
let cottageGlass: THREE.MeshStandardMaterial | null = null;
const glassMaterial = () => (cottageGlass ??= new THREE.MeshStandardMaterial({ color: "#ffe7b0", emissive: "#ffb34d", emissiveIntensity: 0.1 }));

/**
 * A wooden bench (models/bench.py; its seat faces +z) you can sit on: it tells explore.ts where its seat is, in the world, once it's in
 * place. `id` must be unique.
 */
export function Bench({ id }: { id: string }) {
  const ref = useRef<THREE.Group>(null);
  const placed = useRef(false);
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
      <Suspense fallback={null}>
        <Model name="bench" />
      </Suspense>
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

/**
 * The cottage (models/cottage.py): cream walls with dark timber framing on a stone footing, a deep red shingled roof, a
 * chimney with smoke, a front door with a step, knob and lantern, shuttered windows with flower boxes that light up at
 * sunset, and a stack of firewood round the side.
 */
function Cottage() {
  const glass = glassMaterial();
  useFrame(() => {
    glassMaterial().emissiveIntensity = 0.1 + daylight.evening * 1.6;
  });
  const others = pale("footing", "window_frame", "glazing_bar", "bloom", "step");
  return (
    <group position={[COTTAGE.x, groundY(COTTAGE.x, COTTAGE.z), COTTAGE.z]} rotation={[0, COTTAGE_TURN, 0]}>
      <Suspense fallback={null}>
        <Model name="cottage" material={(p) => (p.name === "walls" ? paintedToon(p.color, true) : p.name === "glass" ? glass : others(p))} />
      </Suspense>
      <Smoke position={[0.6, 2.6, -0.35]} />
      <BoxLantern position={[0.42, 0.95, 1.08]} scale={0.8} />
    </group>
  );
}

/**
 * The windmill (models/windmill.py): a tapering white tower on a stone base, with a little window, a wooden balcony
 * round its middle, a red cap with a finial, latticed sails (models/sails.py) that turn in the breeze, and sacks of
 * flour and a barrel by the door.
 */
function Windmill() {
  const sails = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (sails.current) sails.current.rotation.z += dt * 0.5;
  });
  const others = pale("base", "window_frame", "sack");
  return (
    <group position={[WINDMILL.x, groundY(WINDMILL.x, WINDMILL.z), WINDMILL.z]} rotation={[0, WINDMILL_TURN, 0]}>
      <Suspense fallback={null}>
        <Model name="windmill" material={(p) => (p.name === "tower" ? paintedToon(p.color, true) : others(p))} />
        <group ref={sails} position={[0, 2.72, 1.0]}>
          <Model name="sails" material={pale("cloth")} />
        </group>
      </Suspense>
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
      paint(new THREE.CylinderGeometry(0.006, 0.009, 0.8, 4).translate(0, 0.4, 0), "#e4c862"),
      paint(new THREE.CapsuleGeometry(0.024, 0.13, 2, 6).translate(0, 0.86, 0), "#ffdc72"),
      paint(new THREE.ConeGeometry(0.004, 0.1, 3).translate(0.01, 0.98, 0), "#fbe39a"),
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
      mesh.setColorAt(i, c.setScalar(0.95 + r() * 0.12));
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
      <instancedMesh ref={stalks} args={[geometry, swayingToon(true, true), COUNT]} castShadow />
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
