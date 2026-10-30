"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { isDrag } from "./controls";
import { takeAction, type CritterKind, type CritterPick } from "./critters";
import { BoxLantern, DOCK, POND, WATER_COMMON, WATER_END, groundY, isOpen, pondEdge, pondRadius, rng, tickWater, waterMaterial } from "./island";
import { lilyPadTexture } from "./textures";
import { NOISE_GLSL, swayingToon, toon } from "./toon";

// The pond, after a little painted diorama of a busy afternoon at a pond: teal water that's darker and cloudier in the
// middle with petals drifting on it, a sandy shore fringed with reeds, cattails, pebbles and mossy rocks, lily pads with
// pink and white lotus, a wooden dock with a bucket and a lantern, and its residents: a frog on a lily pad, two ducks
// paddling about and two more pottering on the grass, three koi, a little school of minnows and two dragonflies. Click one (on the island, not at the table)
// and it shows what it can do (see critters.ts); each action plays out here, with ripples and splashes.

const WATER_Y = -0.11;
const DOCK_DIR = { x: Math.sin(DOCK.angle), z: Math.cos(DOCK.angle) }; // from the shore out over the water
const DOCK_TIP = { x: DOCK.x + DOCK_DIR.x * DOCK.length, z: DOCK.z + DOCK_DIR.z * DOCK.length };

/** Distance from (x, z) to the dock's centre line. */
function dockDist(x: number, z: number) {
  const vx = DOCK_TIP.x - DOCK.x, vz = DOCK_TIP.z - DOCK.z;
  const t = Math.min(1, Math.max(0, ((x - DOCK.x) * vx + (z - DOCK.z) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(x - DOCK.x - vx * t, z - DOCK.z - vz * t);
}

const ease = (t: number) => t * t * (3 - 2 * t);

// ---------------------------------------------------------------------------------------------------------------------
// ripples and splashes, shared by every creature

const RING_POOL = 18, DROP_POOL = 64;
const ripples: { x: number; z: number; t0: number; size: number }[] = [];
const drops: { x: number; z: number; vx: number; vy: number; vz: number; t0: number }[] = [];
let now = 0; // the scene clock, as of this frame

function ripple(x: number, z: number, size = 1) {
  ripples.push({ x, z, t0: now, size });
  if (ripples.length > RING_POOL) ripples.shift();
}

function splash(x: number, z: number, count = 10, power = 1) {
  ripple(x, z, 1.3 * power);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, out = (0.4 + Math.random() * 0.6) * power;
    drops.push({ x, z, vx: Math.cos(a) * out, vy: (1.6 + Math.random() * 1.2) * power, vz: Math.sin(a) * out, t0: now });
  }
  while (drops.length > DROP_POOL) drops.shift();
}

/** Draws the ripples (rings spreading and fading on the water) and the droplets of any splash. */
function Splashes() {
  const rings = useRef<THREE.Group>(null);
  const dropMesh = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    now = clock.getElapsedTime();
    rings.current?.children.forEach((ring, i) => {
      const r = ripples[i], age = r ? now - r.t0 : Infinity;
      ring.visible = age < 1.6;
      if (!r || !ring.visible) return;
      ring.position.set(r.x, WATER_Y + 0.004, r.z);
      ring.scale.setScalar((0.12 + age * 0.42) * r.size);
      ((ring as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - age / 1.6) * 0.6;
    });
    const m = dropMesh.current;
    if (!m) return;
    for (let i = 0; i < DROP_POOL; i++) {
      const d = drops[i], age = d ? now - d.t0 : 0;
      const y = d ? WATER_Y + d.vy * age - 4.9 * age * age : WATER_Y - 1;
      tmp.position.set(d ? d.x + d.vx * age : 0, y, d ? d.z + d.vz * age : 0);
      tmp.scale.setScalar(d && y > WATER_Y ? 1 : 0);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <group ref={rings}>
        {Array.from({ length: RING_POOL }, (_, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <ringGeometry args={[0.84, 1, 48]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <instancedMesh ref={dropMesh} args={[undefined, undefined, DROP_POOL]} frustumCulled={false}>
        <sphereGeometry args={[0.022, 8, 6]} />
        <meshBasicMaterial color="#f4fbff" />
      </instancedMesh>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// the water and its shore

const POND_VERTEX = /* glsl */ `
  #include <fog_pars_vertex>
  uniform mat4 uReflectMatrix;
  attribute float rim;
  attribute float shore;
  varying float vRim;
  varying float vToShore;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec4 vReflect;
  void main() {
    vRim = rim;
    vToShore = shore - length(position.xz); // metres in from the water's edge
    vUv = position.xz;
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    vReflect = uReflectMatrix * vec4(position, 1.0);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const POND_FRAGMENT = /* glsl */ `${WATER_COMMON}
  uniform sampler2D tReflect;
  varying float vRim;
  varying float vToShore;
  varying vec3 vWorld;
  varying vec4 vReflect;
  ${NOISE_GLSL}
  void main() {
    // vUv is the position across the pond in metres; vRim is 0 in the middle and 1 past the shore
    float cloud = pnNoise(vUv * 0.8 + vec2(uTime * 0.03, 0.0)) * 0.6 + pnNoise(vUv * 2.0 - vec2(0.0, uTime * 0.02)) * 0.4;
    float depth = smoothstep(0.98, 0.3, vRim) * (0.4 + 0.6 * cloud);
    vec3 col = mix(uShallow, uDeep, depth);

    // the mirror image of the trees, reeds, ducks and sky, softened and rippled, and stronger at a glancing angle
    vec2 ruv = vReflect.xy / vReflect.w;
    ruv += (vec2(pnNoise(vUv * 3.0 + uTime * 0.4), pnNoise(vUv * 3.0 - uTime * 0.35)) - 0.5) * 0.018;
    vec3 refl = vec3(0.0);
    for (int i = 0; i < 5; i++) {
      vec2 o = vec2(float(i - 2) * 0.0018, float((i * 3) % 5 - 2) * 0.0018);
      refl += texture2D(tReflect, ruv + o).rgb;
    }
    refl /= 5.0;
    float facing = max(dot(normalize(cameraPosition - vWorld), vec3(0.0, 1.0, 0.0)), 0.0);
    float fresnel = 0.14 + 0.4 * pow(1.0 - facing, 4.0);
    col = mix(col, mix(refl * 0.85, col, 0.3), fresnel); // tinted by the water, so the pond stays teal

    // drifting glints: short pale dashes across the surface, like brush strokes
    float lines = smoothstep(0.93, 1.0, sin(vUv.y * 10.0 + pnNoise(vUv * 1.3) * 5.0));
    float dashes = smoothstep(0.55, 0.8, pnNoise(vec2(vUv.x * 1.6 - uTime * 0.12, vUv.y * 7.0)));
    col = mix(col, vec3(1.0), lines * dashes * 0.5);
    // pale shallows where the water laps the sand
    col = mix(col, uShallow * 1.06 + 0.05, smoothstep(0.45, 0.0, vToShore) * 0.5);
    // foam: a broken white line right at the water's edge, and a fainter one that laps in and out
    float wob = (pnNoise(vUv * 4.0 + uTime * 0.3) - 0.5) * 0.06;
    float edge = smoothstep(0.1, 0.02, vToShore + wob) * step(-0.05, vToShore);
    float lap = smoothstep(0.03, 0.0, abs(vToShore - 0.2 - 0.06 * sin(uTime * 1.3) + wob)) * step(0.45, pnNoise(vUv * 6.0));
    col = mix(col, vec3(1.0), clamp(edge * 0.8 + lap * 0.55, 0.0, 0.85));
    gl_FragColor = vec4(col, 1.0);
    ${WATER_END}
  }`;

// the pond's mirror: a second, smaller view of the scene from below the water, rendered once a frame
const REFLECT_SIZE = 512;

/**
 * The pond's water material, with a mirror: `render` (the water mesh's onBeforeRender) draws the scene as seen in the
 * water just before the water itself is drawn, at most once per frame (call `tick` each frame): the camera mirrored in
 * the water's plane, with everything below the surface clipped away (after three.js's Reflector).
 */
function createMirroredWater() {
  const target = new THREE.WebGLRenderTarget(REFLECT_SIZE, REFLECT_SIZE, { type: THREE.HalfFloatType });
  // (waterMaterial clones its uniforms, which can't carry a render target's texture: both are wired in afterwards)
  const material = waterMaterial(POND_FRAGMENT, { tReflect: { value: null }, uReflectMatrix: { value: new THREE.Matrix4() } }, false, POND_VERTEX);
  material.uniforms.tReflect.value = target.texture;
  const matrix: THREE.Matrix4 = material.uniforms.uReflectMatrix.value;
  const cam = new THREE.PerspectiveCamera(), rot = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
  const eye = new THREE.Vector3(), look = new THREE.Vector3(), plane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4();
  let due = true;
  function render(this: THREE.Object3D, renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    if (!due) return;
    due = false;
    eye.setFromMatrixPosition(camera.matrixWorld);
    if (eye.y < WATER_Y) return;
    rot.extractRotation(camera.matrixWorld);
    look.set(0, 0, -1).applyMatrix4(rot).add(eye);
    cam.position.set(eye.x, 2 * WATER_Y - eye.y, eye.z);
    cam.up.set(0, 1, 0).applyMatrix4(rot).reflect(up);
    cam.lookAt(look.x, 2 * WATER_Y - look.y, look.z);
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);
    matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse).multiply(this.matrixWorld);
    // an oblique near plane on the water's surface, so nothing under the water shows in the reflection
    plane.set(up, -WATER_Y).applyMatrix4(cam.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const e = cam.projectionMatrix.elements;
    q.set((Math.sign(clip.x) + e[8]) / e[0], (Math.sign(clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    clip.multiplyScalar(2 / clip.dot(q));
    e[2] = clip.x;
    e[6] = clip.y;
    e[10] = clip.z + 1;
    e[14] = clip.w;

    this.visible = false;
    const previous = renderer.getRenderTarget(), shadows = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(target);
    renderer.state.buffers.depth.setMask(true);
    renderer.clear();
    renderer.render(scene, cam); // the mirror camera only sees layer 0: the grass (GRASS_LAYER) is left out, to save time
    renderer.setRenderTarget(previous);
    renderer.shadowMap.autoUpdate = shadows;
    this.visible = true;
  }
  return {
    material,
    render,
    tick: () => void (due = true),
    dispose: () => {
      target.dispose();
      material.dispose();
    },
  };
}

function Water() {
  const ref = useRef<THREE.Mesh>(null);
  const water = useMemo(() => createMirroredWater(), []);
  useEffect(() => () => water.dispose(), [water]);
  const geometry = useMemo(() => {
    // rings out from the middle to just past the shore (the bank hides the overlap), so vRim can shade the depth
    const RINGS = 14, SEG = 96, verts: number[] = [], rim: number[] = [], shore: number[] = [], idx: number[] = [];
    for (let k = 0; k <= RINGS; k++) {
      for (let j = 0; j < SEG; j++) {
        const theta = (j / SEG) * Math.PI * 2, edge = pondRadius(theta), R = (edge + 0.2) * (k / RINGS);
        verts.push(Math.cos(theta) * R, 0, Math.sin(theta) * R);
        rim.push(k / RINGS);
        shore.push(edge);
      }
    }
    for (let k = 0; k < RINGS; k++) {
      for (let j = 0; j < SEG; j++) {
        const a = k * SEG + j, b = k * SEG + ((j + 1) % SEG), c = a + SEG, d = b + SEG;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute("rim", new THREE.Float32BufferAttribute(rim, 1));
    g.setAttribute("shore", new THREE.Float32BufferAttribute(shore, 1));
    g.setIndex(idx);
    return g;
  }, []);
  useFrame(({ clock }) => {
    tickWater(ref.current, clock.getElapsedTime());
    water.tick();
  });
  return <mesh ref={ref} position={[POND.x, WATER_Y, POND.z]} geometry={geometry} material={water.material} onBeforeRender={water.render} />;
}

/** A point on the shore at angle `theta` round the pond, `offset` metres out from the water's edge. */
const shore = (theta: number, offset: number) => {
  const R = pondRadius(theta) + offset;
  return { x: POND.x + Math.cos(theta) * R, z: POND.z + Math.sin(theta) * R };
};

/** Reeds and cattails in clumps round the shore (leaving the dock clear), and pebbles. */
function Shore() {
  const reeds = useRef<THREE.InstancedMesh>(null);
  const cattails = useRef<THREE.InstancedMesh>(null);
  const REEDS = 560, CATTAILS = 80;
  const reedGeo = useMemo(() => new THREE.ConeGeometry(0.02, 1, 3).translate(0, 0.5, 0), []);
  // a cattail: a thin green stem, a brown velvety head near the top, and a little spike above it
  const cattailGeo = useMemo(() => {
    const paint = (g: THREE.BufferGeometry, hex: string) => {
      const c = new THREE.Color(hex), n = g.attributes.position.count;
      g.setAttribute("color", new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [c.r, c.g, c.b]).flat(), 3));
      return g.toNonIndexed();
    };
    const parts = [
      paint(new THREE.CylinderGeometry(0.007, 0.01, 1, 5).translate(0, 0.5, 0), "#5f9a45"),
      paint(new THREE.CapsuleGeometry(0.03, 0.13, 3, 8).translate(0, 0.86, 0), "#7a4a2c"),
      paint(new THREE.ConeGeometry(0.006, 0.12, 4).translate(0, 1.0, 0), "#6b8f45"),
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

  const pebbles = useMemo(() => {
    const r = rng(61), out: { x: number; z: number; s: number; rot: number; c: string }[] = [];
    for (let k = 0; k < 7; k++) {
      const theta = r() * Math.PI * 2;
      for (let j = 0; j < 2 + Math.floor(r() * 2); j++) {
        const p = shore(theta + (r() - 0.5) * 0.12, 0.1 + r() * 0.3);
        if (dockDist(p.x, p.z) < 0.7) continue;
        out.push({ ...p, s: 0.07 + r() * 0.09, rot: r() * 6, c: ["#d3cdd6", "#bfb8c6", "#e4ded9"][Math.floor(r() * 3)] });
      }
    }
    // and a few bigger mossy rocks out on the grass
    for (let k = 0; k < 4; k++) {
      const theta = 1.9 + k * 1.15 + r() * 0.3;
      for (let j = 0; j < 2 + Math.floor(r() * 2); j++) {
        const p = shore(theta + (r() - 0.5) * 0.18, 0.75 + r() * 0.45);
        if (dockDist(p.x, p.z) < 1 || !isOpen(p.x, p.z)) continue;
        out.push({ ...p, s: j === 0 ? 0.2 + r() * 0.1 : 0.1 + r() * 0.08, rot: r() * 6, c: ["#c9c3cf", "#b5b0bd", "#a9b49a"][Math.floor(r() * 3)] });
      }
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const r = rng(53), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const c = new THREE.Color();
    // clumps: a spot on the shore, then blades scattered round it
    const clumps: { x: number; z: number }[] = [];
    for (let tries = 0; clumps.length < 42 && tries < 500; tries++) {
      const pt = shore(r() * Math.PI * 2, -0.18 + r() * 0.5);
      if (dockDist(pt.x, pt.z) > 0.9) clumps.push(pt);
    }
    const plant = (mesh: THREE.InstancedMesh, count: number, each: (i: number) => void) => {
      for (let i = 0; i < count; i++) {
        const at = clumps[i % clumps.length], a = r() * Math.PI * 2, d = r() * 0.22;
        const x = at.x + Math.cos(a) * d, z = at.z + Math.sin(a) * d;
        p.set(x, Math.max(groundY(x, z), WATER_Y) - 0.02, z);
        each(i);
        m.compose(p, q.setFromEuler(e), s);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    if (reeds.current) {
      const mesh = reeds.current;
      plant(mesh, REEDS, (i) => {
        e.set((r() - 0.5) * 0.5, r() * Math.PI, (r() - 0.5) * 0.5);
        const k = 0.8 + r() * 0.5;
        s.set(k, 0.35 + r() * 0.55, k);
        mesh.setColorAt(i, c.setHSL(0.25 + r() * 0.04, 0.45 + r() * 0.15, 0.33 + r() * 0.12));
      });
    }
    if (cattails.current) {
      const mesh = cattails.current;
      plant(mesh, CATTAILS, (i) => {
        e.set((r() - 0.5) * 0.25, r() * Math.PI, (r() - 0.5) * 0.25);
        s.setScalar(0.65 + r() * 0.45);
        mesh.setColorAt(i, c.setScalar(0.9 + r() * 0.1));
      });
    }
  }, []);

  return (
    <>
      <instancedMesh ref={reeds} args={[reedGeo, swayingToon(), REEDS]} castShadow />
      <instancedMesh ref={cattails} args={[cattailGeo, swayingToon(true), CATTAILS]} castShadow />
      {pebbles.map((p, i) => (
        <mesh key={i} position={[p.x, groundY(p.x, p.z) + p.s * 0.3, p.z]} rotation={[0, p.rot, 0]} scale={[p.s, p.s * 0.6, p.s * 0.85]} material={toon(p.c, true)} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 1]} />
        </mesh>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// lily pads and the dock

interface Pad {
  x: number;
  z: number;
  s: number;
  rot: number;
  lotus: boolean;
}

const PADS: Pad[] = (() => {
  const r = rng(77), out: Pad[] = [];
  for (let tries = 0; out.length < 10 && tries < 2000; tries++) {
    const theta = r() * Math.PI * 2, d = r() * (pondRadius(theta) - 0.6);
    const x = POND.x + Math.cos(theta) * d, z = POND.z + Math.sin(theta) * d, s = 0.26 + r() * 0.2;
    if (pondEdge(x, z) > -0.35 - s || dockDist(x, z) < s + 0.5) continue;
    if (out.some((p) => Math.hypot(p.x - x, p.z - z) < p.s + s + 0.18)) continue;
    out.push({ x, z, s, rot: r() * Math.PI * 2, lotus: r() > 0.45 });
  }
  return out;
})();

// the frog hops between the three pads nearest the end of the dock (and those have no lotus, to leave it room)
const FROG_PADS = PADS.map((p, i) => ({ i, d: Math.hypot(p.x - DOCK_TIP.x, p.z - DOCK_TIP.z) }))
  .sort((a, b) => a.d - b.d)
  .slice(0, 3)
  .map((p) => p.i);
FROG_PADS.forEach((i) => (PADS[i].lotus = false));

/** A lotus (pink, or a white water lily): an outer ring of petals opening out, an inner ring cupped up, and a golden middle. */
function Lotus({ white = false }: { white?: boolean }) {
  return (
    <group>
      {Array.from({ length: 8 }, (_, k) => (
        <group key={k} rotation={[0, (k / 8) * Math.PI * 2, 0]}>
          <mesh position={[0, 0.03, 0.05]} rotation={[-0.75, 0, 0]} scale={[0.032, 0.012, 0.07]} material={toon(white ? "#fbf7f0" : "#f6a2c4", true)}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
        </group>
      ))}
      {Array.from({ length: 5 }, (_, k) => (
        <group key={k} rotation={[0, (k / 5) * Math.PI * 2 + 0.3, 0]}>
          <mesh position={[0, 0.06, 0.025]} rotation={[-0.3, 0, 0]} scale={[0.025, 0.012, 0.055]} material={toon(white ? "#fff3dc" : "#ffd0e2", true)}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.06, 0]} material={toon("#ffd34d")}>
        <sphereGeometry args={[0.022, 10, 8]} />
      </mesh>
    </group>
  );
}

function LilyPads() {
  const material = useMemo(() => new THREE.MeshToonMaterial({ map: lilyPadTexture(), alphaTest: 0.5, side: THREE.DoubleSide }), []);
  return (
    <>
      {PADS.map((p, i) => (
        <group key={i} position={[p.x, WATER_Y + 0.006 + i * 0.0006, p.z]} rotation={[0, p.rot, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} scale={p.s} material={material} receiveShadow>
            <circleGeometry args={[1, 40]} />
          </mesh>
          {p.lotus && (
            <group position={[p.s * 0.25, 0, -p.s * 0.2]}>
              <Lotus white={i % 3 === 0} />
            </group>
          )}
        </group>
      ))}
    </>
  );
}

/** A wooden dock running from the shore out over the water, on posts. */
function Dock() {
  const L = DOCK.length, START = -0.4, PLANKS = 12, TOP = 0.07;
  const step = (L - START) / PLANKS;
  const wood = ["#b47d50", "#a56f45", "#bd895b"];
  return (
    <group position={[DOCK.x, 0, DOCK.z]} rotation={[0, DOCK.angle, 0]}>
      {Array.from({ length: PLANKS }, (_, k) => (
        <mesh key={k} position={[0, TOP, START + step * (k + 0.5)]} rotation={[0, (((k * 7) % 5) - 2) * 0.012, 0]} material={toon(wood[k % 3])} castShadow receiveShadow>
          <boxGeometry args={[0.82, 0.05, step * 0.84]} />
        </mesh>
      ))}
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, TOP - 0.06, (START + L) / 2]} material={toon("#8a5d3b")} castShadow>
          <boxGeometry args={[0.07, 0.07, L - START]} />
        </mesh>
      ))}
      {/* a tin bucket, and a lantern on a post at the end that glows at dusk */}
      <group position={[0.22, TOP + 0.025, L - 0.45]}>
        <mesh position={[0, 0.07, 0]} material={toon("#9fb4c4", true)} castShadow>
          <cylinderGeometry args={[0.085, 0.065, 0.14, 16, 1, true]} />
        </mesh>
        <mesh position={[0, 0.005, 0]} material={toon("#8aa0b0")}>
          <cylinderGeometry args={[0.065, 0.065, 0.01, 16]} />
        </mesh>
        <mesh position={[0, 0.12, 0]} rotation={[0, 0, 0]} material={toon("#6f8090")}>
          <torusGeometry args={[0.085, 0.006, 6, 20, Math.PI]} />
        </mesh>
      </group>
      <mesh position={[-0.36, TOP + 0.25, L - 0.06]} material={toon("#7d5638")} castShadow>
        <cylinderGeometry args={[0.03, 0.035, 0.5, 8]} />
      </mesh>
      <BoxLantern position={[-0.36, TOP + 0.5, L - 0.06]} scale={0.8} />
      {[0.55, 1.25, L - 0.06].flatMap((z) =>
        [-0.38, 0.38].map((x) => (
          <mesh key={`${z}${x}`} position={[x, z > L - 0.1 ? -0.12 : -0.17, z]} material={toon("#7d5638")} castShadow>
            <cylinderGeometry args={[0.045, 0.05, z > L - 0.1 ? 0.55 : 0.45, 8]} />
          </mesh>
        )),
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// the creatures

interface PickProps {
  interactive: boolean;
  picked: CritterPick | null;
  onPick: (pick: CritterPick) => void;
}

const isPicked = (picked: CritterPick | null, kind: CritterKind, index: number) => picked?.kind === kind && picked.index === index;

/** Click, hover and cursor handling for a creature's group. */
function pickHandlers({ interactive, onPick }: PickProps, kind: CritterKind, index: number) {
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (!interactive || isDrag(e.delta)) return;
      e.stopPropagation();
      onPick({ kind, index });
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      if (!interactive) return;
      e.stopPropagation();
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      if (interactive) document.body.style.cursor = "grab";
    },
  };
}

/** A soft white ring on the water under whichever creature is picked, gently pulsing. */
function PickRing({ on, r }: { on: boolean; r: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.visible = on;
    ref.current.scale.setScalar(r * (1 + Math.sin(clock.getElapsedTime() * 4) * 0.06));
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} visible={false}>
      <ringGeometry args={[0.8, 1, 48]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.85} depthWrite={false} />
    </mesh>
  );
}

/** A big invisible ball round a small creature, so it's easy to click. */
function HitArea({ r, y = 0 }: { r: number; y?: number }) {
  return (
    <mesh position={[0, y, 0]}>
      <sphereGeometry args={[r, 8, 6]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

/** Turns `from` towards `to` (radians) by `f`, the short way round. */
const turn = (from: number, to: number, f: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * f;

const FROG_GREEN = "#7cc24c";

/** The frog on its lily pad. Hop: to the next pad. Catch a fly: the fly buzzing round it. Croak: puffs its throat. */
function Frog(props: PickProps) {
  const outer = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const sac = useRef<THREE.Mesh>(null);
  const tongue = useRef<THREE.Mesh>(null);
  const fly = useRef<THREE.Group>(null);
  const tongueGeo = useMemo(() => new THREE.CylinderGeometry(0.011, 0.011, 1, 6).rotateX(Math.PI / 2).translate(0, 0, 0.5), []);
  const state = useRef({
    pad: 0,
    yaw: 0,
    hop: null as null | { from: number; to: number; t0: number },
    croak: -10,
    snap: null as null | { t0: number; at: THREE.Vector3 },
    flyBack: 0,
  });
  const v = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), []);

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime(), s = state.current, g = outer.current;
    if (!g || !body.current) return;
    const action = takeAction("frog", 0);
    if (action === "Hop" && !s.hop) s.hop = { from: s.pad, to: (s.pad + 1) % FROG_PADS.length, t0: t };
    if (action === "Croak") s.croak = t;
    if (action === "Catch a fly" && !s.snap && t > s.flyBack && fly.current) s.snap = { t0: t, at: fly.current.position.clone() };

    const padAt = (k: number) => PADS[FROG_PADS[k]];
    let p = padAt(s.pad), x = p.x, z = p.z, lift = 0, stretch = 1;
    if (s.hop) {
      const k = Math.min(1, (t - s.hop.t0) / 0.65), a = padAt(s.hop.from), b = padAt(s.hop.to), e = ease(k);
      x = a.x + (b.x - a.x) * e;
      z = a.z + (b.z - a.z) * e;
      lift = Math.sin(Math.PI * k) * 0.5;
      stretch = 1 + Math.sin(Math.PI * k) * 0.25;
      s.yaw = turn(s.yaw, Math.atan2(b.x - a.x, b.z - a.z), Math.min(1, dt * 14));
      if (k >= 1) {
        s.pad = s.hop.to;
        s.hop = null;
        p = padAt(s.pad);
        ripple(p.x, p.z, 0.9);
        splash(p.x, p.z, 5, 0.5);
      }
    }
    g.position.set(x, WATER_Y + 0.012 + lift, z);

    // the fly loops round the frog's pad, unless it's just been caught
    const home = padAt(s.pad);
    if (fly.current) {
      fly.current.visible = t > s.flyBack;
      fly.current.position.set(home.x + Math.cos(t * 2.1) * 0.5, WATER_Y + 0.38 + Math.sin(t * 3.3) * 0.08, home.z + Math.sin(t * 1.6) * 0.5);
      fly.current.children.forEach((w, i) => i > 0 && (w.rotation.z = (i === 1 ? 1 : -1) * Math.sin(t * 60) * 0.8));
    }

    // catch a fly: face it, flick the tongue out to it and back with the fly
    if (tongue.current) tongue.current.visible = false;
    if (s.snap) {
      const k = (t - s.snap.t0) / 0.34;
      s.yaw = turn(s.yaw, Math.atan2(s.snap.at.x - g.position.x, s.snap.at.z - g.position.z), Math.min(1, dt * 20));
      if (k > 0.4 && s.flyBack < s.snap.t0) s.flyBack = t + 4; // got it
      if (k >= 1) s.snap = null;
      else if (tongue.current) {
        g.updateMatrixWorld();
        const mouth = g.localToWorld(v.a.set(0, 0.1, 0.15));
        const reach = (k < 0.4 ? k / 0.4 : 1 - (k - 0.4) / 0.6) * mouth.distanceTo(s.snap.at);
        tongue.current.visible = true;
        tongue.current.position.copy(mouth);
        tongue.current.lookAt(s.snap.at);
        tongue.current.scale.set(1, 1, Math.max(0.001, reach));
      }
    } else if (!s.hop) {
      s.yaw = turn(s.yaw, Math.atan2(DOCK.x - g.position.x, DOCK.z - g.position.z), Math.min(1, dt * 0.8)); // idles facing the shore
    }
    g.rotation.y = s.yaw;

    // breathing, and the throat puffing out three times for a croak
    const ck = (t - s.croak) / 1.4;
    const puff = ck >= 0 && ck < 1 ? Math.abs(Math.sin(ck * Math.PI * 3)) : 0;
    body.current.scale.set(1, (1 + Math.sin(t * 2.2) * 0.03 - puff * 0.06) * stretch, 1);
    sac.current?.scale.setScalar(0.35 + puff * 0.95);
  });

  const handlers = pickHandlers(props, "frog", 0);
  const eye = (side: number) => (
    <group key={side} position={[side * 0.055, 0.14, 0.07]}>
      <mesh material={toon(FROG_GREEN)}>
        <sphereGeometry args={[0.038, 14, 10]} />
      </mesh>
      <mesh position={[side * 0.006, 0.012, 0.022]} material={toon("#ffffff", true)}>
        <sphereGeometry args={[0.026, 12, 10]} />
      </mesh>
      <mesh position={[side * 0.008, 0.014, 0.044]} material={toon("#2b2420")}>
        <sphereGeometry args={[0.012, 8, 6]} />
      </mesh>
    </group>
  );
  return (
    <>
      <group ref={outer} {...handlers}>
        <PickRing on={isPicked(props.picked, "frog", 0)} r={0.3} />
        <group ref={body}>
          <mesh position={[0, 0.075, 0]} scale={[0.13, 0.085, 0.15]} material={toon(FROG_GREEN)} castShadow>
            <sphereGeometry args={[1, 20, 14]} />
          </mesh>
          <mesh position={[0, 0.055, 0.05]} scale={[0.1, 0.05, 0.1]} material={toon("#e8f0b4", true)}>
            <sphereGeometry args={[1, 16, 12]} />
          </mesh>
          {eye(-1)}
          {eye(1)}
          {[-1, 1].map((side) => (
            <group key={side}>
              {/* folded back legs and feet, and little front legs */}
              <mesh position={[side * 0.11, 0.04, -0.04]} scale={[0.05, 0.042, 0.09]} material={toon("#68b041")} castShadow>
                <sphereGeometry args={[1, 12, 10]} />
              </mesh>
              <mesh position={[side * 0.14, 0.008, 0.04]} scale={[0.04, 0.01, 0.05]} material={toon("#68b041")}>
                <sphereGeometry args={[1, 10, 8]} />
              </mesh>
              <mesh position={[side * 0.075, 0.02, 0.11]} scale={[0.022, 0.03, 0.022]} material={toon("#68b041")}>
                <sphereGeometry args={[1, 8, 8]} />
              </mesh>
              <mesh position={[side * 0.085, 0.1, 0.12]} material={toon("#ff9fb4", true)}>
                <sphereGeometry args={[0.014, 8, 6]} />
              </mesh>
            </group>
          ))}
          <mesh ref={sac} position={[0, 0.05, 0.13]} scale={0.35} material={toon("#f2f0c4", true)}>
            <sphereGeometry args={[0.05, 14, 10]} />
          </mesh>
        </group>
        <HitArea r={0.22} y={0.08} />
      </group>
      <mesh ref={tongue} geometry={tongueGeo} material={toon("#ff7f9e")} visible={false} />
      <group ref={fly}>
        <mesh material={toon("#3a3330")}>
          <sphereGeometry args={[0.016, 8, 6]} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.016, 0.006, 0]}>
            <planeGeometry args={[0.026, 0.014]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.7} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </>
  );
}

const DUCK_PATHS = [
  { rx: 1.2, rz: 0.95, ox: -0.85, oz: -0.75, dir: 1, phase: 0 },
  { rx: 0.85, rz: 0.7, ox: 0.45, oz: -1, dir: -1, phase: 2.4 },
];

/** Where duck `i` is paddling at time `t`: a slow loop round its own part of the pond, clear of the dock. */
export function duckPath(i: number, t: number) {
  const d = DUCK_PATHS[i], a = d.dir * t * 0.11 + d.phase;
  const x = POND.x + d.ox + Math.cos(a) * d.rx, z = POND.z + d.oz + Math.sin(a) * d.rz;
  // heading: along the loop
  const heading = Math.atan2(-Math.sin(a) * d.rx * d.dir, Math.cos(a) * d.rz * d.dir);
  return { x, z, heading };
}


/** A duck (facing +z): cream body, brown back and wings, a dark brown head that can bob, and feet if it's on land. */
function DuckModel({ body, head, wings, feet = false }: { body: React.Ref<THREE.Group>; head: React.Ref<THREE.Group>; wings: React.Ref<THREE.Group>; feet?: boolean }) {
  return (
    <group ref={body}>
      <mesh position={[0, 0.05, 0]} scale={[0.15, 0.11, 0.21]} material={toon("#f4ede0", true)} castShadow>
        <sphereGeometry args={[1, 20, 14]} />
      </mesh>
      <mesh position={[0, 0.1, -0.03]} scale={[0.12, 0.06, 0.15]} material={toon("#9a6a46")} castShadow>
        <sphereGeometry args={[1, 16, 12]} />
      </mesh>
      <mesh position={[0, 0.11, -0.2]} rotation={[-2.3, 0, 0]} scale={[1, 1, 0.5]} material={toon("#7a5236")}>
        <coneGeometry args={[0.05, 0.12, 8]} />
      </mesh>
      <group ref={wings}>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.12, 0.1, -0.02]}>
            <mesh position={[side * 0.02, 0, 0]} scale={[0.035, 0.06, 0.13]} material={toon("#8d6040")} castShadow>
              <sphereGeometry args={[1, 12, 10]} />
            </mesh>
          </group>
        ))}
      </group>
      <group ref={head} position={[0, 0.13, 0.13]}>
        <mesh position={[0, 0.03, 0.01]} material={toon("#f4ede0", true)}>
          <cylinderGeometry args={[0.045, 0.055, 0.1, 12]} />
        </mesh>
        <mesh position={[0, 0.1, 0.03]} material={toon("#6e4630")} castShadow>
          <sphereGeometry args={[0.075, 16, 12]} />
        </mesh>
        <mesh position={[0, 0.09, 0.11]} scale={[0.036, 0.016, 0.05]} material={toon("#f2a144")}>
          <sphereGeometry args={[1, 12, 8]} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.052, 0.12, 0.07]} material={toon("#1f1a17")}>
            <sphereGeometry args={[0.011, 8, 6]} />
          </mesh>
        ))}
      </group>
      {feet &&
        [-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.06, -0.045, 0.04]} scale={[0.035, 0.01, 0.05]} material={toon("#f2a144")}>
            <sphereGeometry args={[1, 10, 6]} />
          </mesh>
        ))}
    </group>
  );
}

/** A duck paddling round the pond. Quack: bobs its head. Dive: tips up, tail in the air. Flap: rises and flaps. */
function Duck({ index, ...props }: PickProps & { index: number }) {
  const outer = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const wings = useRef<THREE.Group>(null);
  const state = useRef({ quack: -10, dive: -10, flap: -10, nextRipple: 0 });
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime(), s = state.current, g = outer.current;
    if (!g || !body.current) return;
    const action = takeAction("duck", index);
    if (action === "Quack") s.quack = t;
    if (action === "Dive" && t - s.dive > 1.8) s.dive = t;
    if (action === "Flap" && t - s.flap > 1.3) s.flap = t;
    const p = duckPath(index, t);
    g.position.set(p.x, WATER_Y - 0.02, p.z);
    g.rotation.y = p.heading;
    if (t > s.nextRipple) {
      ripple(p.x, p.z, 0.55);
      s.nextRipple = t + 1.5;
    }

    const dk = (t - s.dive) / 1.8, dive = dk >= 0 && dk < 1 ? Math.sin(Math.PI * Math.min(1, dk * 1.6)) * (dk < 0.62 ? 1 : 1 - (dk - 0.62) / 0.38) : 0;
    const fk = (t - s.flap) / 1.3, flap = fk >= 0 && fk < 1 ? Math.sin(Math.PI * fk) : 0;
    if (dk >= 0 && dk < 1 && dk * 1.8 < 0.05) splash(p.x, p.z, 6, 0.5);
    if (fk >= 0 && fk < 1 && fk * 1.3 < 0.05) splash(p.x, p.z, 8, 0.6);
    body.current.rotation.x = dive * 1.6;
    body.current.position.y = Math.sin(t * 2 + index) * 0.008 - dive * 0.05 + flap * 0.1;
    const qk = (t - s.quack) / 0.7;
    if (head.current) head.current.rotation.x = qk >= 0 && qk < 1 ? Math.sin(qk * Math.PI * 4) * 0.4 * (1 - qk) : 0;
    wings.current?.children.forEach((w, i) => (w.rotation.z = (i === 0 ? 1 : -1) * flap * (0.6 + Math.sin(t * 30) * 0.7)));
  });

  const handlers = pickHandlers(props, "duck", index);
  return (
    <group ref={outer} {...handlers}>
      <PickRing on={isPicked(props.picked, "duck", index)} r={0.36} />
      <DuckModel body={body} head={head} wings={wings} />
      <HitArea r={0.26} y={0.1} />
    </group>
  );
}

/** Where the ducks on the grass potter about: a few spots in a band of grass round the pond, clear of the dock. */
const GRASS_SPOTS = (() => {
  const r = rng(88), out: { x: number; z: number }[] = [];
  for (let tries = 0; out.length < 14 && tries < 600; tries++) {
    const p = shore(1.6 + r() * 3.6, 0.6 + r() * 0.6);
    if (dockDist(p.x, p.z) > 1.2 && isOpen(p.x, p.z)) out.push(p);
  }
  return out;
})();

/**
 * A duck out on the grass by the pond. It pecks at the ground and waddles to a new spot now and then on its own.
 * Quack: bobs its head. Peck: pecks the ground. Waddle: wanders off to somewhere new.
 */
function GrassDuck({ index, ...props }: PickProps & { index: number }) {
  const outer = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const wings = useRef<THREE.Group>(null);
  const state = useRef({
    spot: index * 7,
    from: { x: 0, z: 0 },
    walk: -10,
    walkFor: 1,
    peck: -10,
    quack: -10,
    heading: index * 2,
    nextIdle: 3 + index * 2.5,
  });
  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime(), s = state.current, g = outer.current;
    if (!g || !body.current || GRASS_SPOTS.length < 2) return;
    const here = GRASS_SPOTS[s.spot % GRASS_SPOTS.length];
    const walking = t - s.walk < s.walkFor;
    const waddle = () => {
      if (walking) return;
      const cur = g.position;
      s.from = { x: cur.x, z: cur.z };
      s.spot = (s.spot + 1 + Math.floor(Math.random() * 3)) % GRASS_SPOTS.length;
      const to = GRASS_SPOTS[s.spot];
      s.walkFor = Math.max(1, Math.hypot(to.x - cur.x, to.z - cur.z) / 0.3); // a slow 0.3 m/s
      s.walk = t;
    };
    const action = takeAction("grassDuck", index);
    if (action === "Quack") s.quack = t;
    if (action === "Peck") s.peck = t;
    if (action === "Waddle") waddle();
    if (t > s.nextIdle) {
      // left to itself: mostly pecking, sometimes a little walk
      if (Math.random() < 0.35) waddle();
      else s.peck = t;
      s.nextIdle = t + 4 + Math.random() * 5;
    }

    let x = here.x, z = here.z;
    if (t - s.walk < s.walkFor) {
      const k = (t - s.walk) / s.walkFor;
      x = s.from.x + (here.x - s.from.x) * k;
      z = s.from.z + (here.z - s.from.z) * k;
      s.heading = turn(s.heading, Math.atan2(here.x - s.from.x, here.z - s.from.z), Math.min(1, dt * 8));
    } else if (s.walk < 0) {
      s.from = { x, z };
    }
    const stepping = t - s.walk < s.walkFor;
    g.position.set(x, groundY(x, z) + 0.045, z);
    g.rotation.y = s.heading;
    body.current.rotation.z = stepping ? Math.sin(t * 11) * 0.14 : 0; // the waddle
    const pk = (t - s.peck) / 0.9;
    body.current.rotation.x = pk >= 0 && pk < 1 ? Math.abs(Math.sin(pk * Math.PI * 2)) * 0.75 : 0;
    body.current.position.y = stepping ? Math.abs(Math.sin(t * 11)) * 0.02 : 0;
    const qk = (t - s.quack) / 0.7;
    if (head.current) head.current.rotation.x = qk >= 0 && qk < 1 ? Math.sin(qk * Math.PI * 4) * 0.4 * (1 - qk) : 0;
  });

  return (
    <group ref={outer} {...pickHandlers(props, "grassDuck", index)}>
      <PickRing on={isPicked(props.picked, "grassDuck", index)} r={0.36} />
      <DuckModel body={body} head={head} wings={wings} feet />
      <HitArea r={0.26} y={0.1} />
    </group>
  );
}

/** A little school of minnows darting about together just under the surface. */
function Minnows() {
  const group = useRef<THREE.Group>(null);
  const COUNT = 7;
  const offsets = useMemo(() => {
    const r = rng(29);
    return Array.from({ length: COUNT }, () => ({ a: r() * Math.PI * 2, d: 0.08 + r() * 0.18, speed: 0.8 + r() * 0.8 }));
  }, []);
  const schoolRef = useRef({ x: POND.x, z: POND.z, heading: 0, goal: { x: POND.x, z: POND.z }, next: 0 });
  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime(), school = schoolRef.current;
    if (t > school.next) {
      // every couple of seconds the school darts off somewhere new in the open water
      for (let tries = 0; tries < 20; tries++) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * 1.6;
        const x = POND.x + Math.cos(a) * d, z = POND.z + Math.sin(a) * d;
        if (pondEdge(x, z) < -0.5 && dockDist(x, z) > 0.6) {
          school.goal = { x, z };
          break;
        }
      }
      school.next = t + 1.5 + Math.random() * 2.5;
    }
    const px = school.x, pz = school.z, f = Math.min(1, dt * 1.8);
    school.x += (school.goal.x - school.x) * f;
    school.z += (school.goal.z - school.z) * f;
    if (Math.hypot(school.x - px, school.z - pz) > 1e-4) school.heading = turn(school.heading, Math.atan2(school.x - px, school.z - pz), Math.min(1, dt * 6));
    group.current?.children.forEach((fish, i) => {
      const o = offsets[i], a = o.a + Math.sin(t * o.speed + i) * 0.5;
      fish.position.set(school.x + Math.cos(a) * o.d, WATER_Y - 0.012, school.z + Math.sin(a) * o.d);
      fish.rotation.y = school.heading + Math.sin(t * 9 + i) * 0.15;
    });
  });
  return (
    <group ref={group}>
      {offsets.map((_, i) => (
        <mesh key={i} scale={[0.022, 0.016, 0.065]} material={toon("#c9d4da", true)}>
          <sphereGeometry args={[1, 10, 8]} />
        </mesh>
      ))}
    </group>
  );
}

/** Two dragonflies, hovering over the water and darting from spot to spot. */
function Dragonflies() {
  const group = useRef<THREE.Group>(null);
  const fliesRef = useRef(
    [0, 1].map((i) => ({ pos: new THREE.Vector3(POND.x + i - 0.5, 0.4, POND.z), goal: new THREE.Vector3(POND.x, 0.4, POND.z), heading: 0, next: i * 1.3 })),
  );
  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime(), flies = fliesRef.current;
    flies.forEach((f, i) => {
      if (t > f.next) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * (POND.r + 0.3);
        f.goal.set(POND.x + Math.cos(a) * d, 0.25 + Math.random() * 0.45, POND.z + Math.sin(a) * d);
        f.next = t + 1.2 + Math.random() * 2.2;
      }
      const px = f.pos.x, pz = f.pos.z;
      f.pos.lerp(f.goal, Math.min(1, dt * 3.5));
      if (Math.hypot(f.pos.x - px, f.pos.z - pz) > 1e-3) f.heading = turn(f.heading, Math.atan2(f.pos.x - px, f.pos.z - pz), Math.min(1, dt * 10));
      const fly = group.current?.children[i];
      if (!fly) return;
      fly.position.set(f.pos.x, f.pos.y + Math.sin(t * 7 + i) * 0.01, f.pos.z);
      fly.rotation.y = f.heading;
      // the wings shimmer
      fly.children.forEach((w, j) => j > 1 && (w.rotation.z = (j % 2 ? 1 : -1) * (0.15 + Math.sin(t * 70 + j) * 0.25)));
    });
  });
  const wing = useMemo(() => new THREE.MeshBasicMaterial({ color: "#eaf6ff", transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }), []);
  return (
    <group ref={group}>
      {[0, 1].map((i) => (
        <group key={i}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={toon(i ? "#3fa7c9" : "#5b8fd8")}>
            <capsuleGeometry args={[0.009, 0.13, 3, 6]} />
          </mesh>
          <mesh position={[0, 0, 0.08]} material={toon("#2c5f86")}>
            <sphereGeometry args={[0.016, 8, 6]} />
          </mesh>
          {[0.035, 0.005].flatMap((z) =>
            [-1, 1].map((side) => (
              <mesh key={`${z}${side}`} position={[side * 0.045, 0.006, z]} rotation={[-Math.PI / 2, 0, 0]} material={wing}>
                <planeGeometry args={[0.08, 0.018]} />
              </mesh>
            )),
          )}
        </group>
      ))}
    </group>
  );
}

/** Blossom petals and tiny flowers that have fallen on the water, drifting slowly round the pond. */
function FloatingPetals() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const COUNT = 30;
  const petals = useMemo(() => {
    const r = rng(47);
    return Array.from({ length: COUNT }, () => {
      const theta = r() * Math.PI * 2;
      return { theta, d: (0.2 + r() * 0.75) * (pondRadius(theta) - 0.35), speed: (0.01 + r() * 0.02) * (r() > 0.5 ? 1 : -1), spin: r() * 6, s: 0.7 + r() * 0.6 };
    });
  }, []);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const colors = ["#ffc4d6", "#ffffff", "#ffd9e4", "#ffe680"];
    const c = new THREE.Color();
    petals.forEach((_, i) => mesh.current?.setColorAt(i, c.set(colors[i % colors.length])));
    if (mesh.current?.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [petals]);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.getElapsedTime();
    petals.forEach((p, i) => {
      const a = p.theta + t * p.speed;
      tmp.position.set(POND.x + Math.cos(a) * p.d, WATER_Y + 0.003, POND.z + Math.sin(a) * p.d);
      tmp.rotation.set(-Math.PI / 2, 0, p.spin + t * p.speed * 4);
      tmp.scale.setScalar(p.s);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <circleGeometry args={[0.028, 8]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}

const KOI = [
  { body: "#fbf6ee", patch: "#f07a2e", fin: "#f8d2b4", r: 1.3 },
  { body: "#f08a3c", patch: "#fbf6ee", fin: "#f6b07a", r: 1.0 },
  { body: "#f29a4a", patch: "#e2662a", fin: "#f8c08e", r: 1.5 },
];

/** Where koi `i` would be at its own time `t`: a lazy figure of eight, each tilted its own way. */
function koiPath(i: number, t: number) {
  const a = t * 0.35 + i * 2.1, R = KOI[i].r, lx = Math.cos(a) * R, lz = Math.sin(2 * a) * 0.5 * R, tilt = i * 1.1;
  return { x: POND.x - 0.3 + lx * Math.cos(tilt) - lz * Math.sin(tilt), z: POND.z - 0.2 + lx * Math.sin(tilt) + lz * Math.cos(tilt) };
}

/** Three koi gliding just under the surface. Jump: leaps out with a splash. Feed: they all gather. Swim: a dash. */
function Koi(props: PickProps) {
  const outers = useRef<(THREE.Group | null)[]>([]);
  const inners = useRef<(THREE.Group | null)[]>([]);
  const tails = useRef<(THREE.Group | null)[]>([]);
  const pellets = useRef<THREE.Group>(null);
  const fish = useMemo(
    () => KOI.map((_, i) => ({ pos: new THREE.Vector3(koiPath(i, 0).x, 0, koiPath(i, 0).z), heading: 0, clock: 0, dash: -10, jump: -10, landed: true, nextRipple: 2 + i * 1.7 })),
    [],
  );
  const feed = useRef({ t0: -100, x: 0, z: 0 });
  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime(), f = feed.current;
    const feeding = t - f.t0 < 7;
    fish.forEach((k, i) => {
      const action = takeAction("koi", i);
      if (action === "Jump" && t - k.jump > 1.1) {
        k.jump = t;
        k.landed = false;
        splash(k.pos.x, k.pos.z, 8, 0.6);
      }
      if (action === "Swim") k.dash = t;
      if (action === "Feed") {
        // a pinch of food just ahead of the koi you picked, kept in the water
        const ax = k.pos.x + Math.sin(k.heading) * 0.4, az = k.pos.z + Math.cos(k.heading) * 0.4;
        const pull = pondEdge(ax, az) > -0.6 ? 0.5 : 0;
        f.t0 = t;
        f.x = ax + (POND.x - ax) * pull;
        f.z = az + (POND.z - az) * pull;
        ripple(f.x, f.z, 0.8);
      }
      const dashing = t - k.dash < 2.2;
      k.clock += dt * (dashing ? 3.2 : 1);
      const goal = feeding ? { x: f.x + Math.cos(i * 2.1 + t) * 0.2, z: f.z + Math.sin(i * 2.1 + t) * 0.2 } : koiPath(i, k.clock);
      const prevX = k.pos.x, prevZ = k.pos.z;
      const follow = Math.min(1, dt * (feeding ? 1.4 : dashing ? 4 : 2));
      k.pos.x += (goal.x - k.pos.x) * follow;
      k.pos.z += (goal.z - k.pos.z) * follow;
      const vx = k.pos.x - prevX, vz = k.pos.z - prevZ;
      if (Math.hypot(vx, vz) > 1e-4) k.heading = turn(k.heading, Math.atan2(vx, vz), Math.min(1, dt * 6));

      const jk = (t - k.jump) / 1.0;
      const jumping = jk >= 0 && jk < 1;
      if (t > k.nextRipple) {
        // now and then a koi noses the surface
        if (!jumping) ripple(k.pos.x + Math.sin(k.heading) * 0.15, k.pos.z + Math.cos(k.heading) * 0.15, 0.45);
        k.nextRipple = t + 3 + Math.random() * 4;
      }
      if (!jumping && !k.landed) {
        k.landed = true;
        splash(k.pos.x, k.pos.z, 10, 0.7);
      }
      const outer = outers.current[i], inner = inners.current[i];
      if (outer) {
        outer.position.set(k.pos.x, WATER_Y, k.pos.z);
        outer.rotation.y = k.heading;
      }
      if (inner) {
        inner.position.y = -0.035 + (jumping ? Math.sin(Math.PI * jk) * 0.75 : 0);
        inner.rotation.x = jumping ? -(1 - 2 * jk) * 1.1 : 0;
      }
      const tail = tails.current[i];
      if (tail) tail.rotation.y = Math.sin(t * (dashing ? 16 : 7) + i) * 0.45;
    });
    // the food bobs on the surface, and gets eaten over a few seconds
    pellets.current?.children.forEach((p, j) => {
      const age = t - f.t0, left = age < 7 ? 1 - Math.max(0, age - 1.5) / 5.5 : 0;
      p.visible = left > j / 8;
      p.position.set(f.x + Math.cos(j * 2.4) * 0.12 * (1 + (j % 3) * 0.4), WATER_Y + 0.008 + Math.sin(t * 3 + j) * 0.004, f.z + Math.sin(j * 2.4) * 0.12 * (1 + (j % 3) * 0.4));
    });
  });

  return (
    <>
      {KOI.map((k, i) => (
        <group key={i} ref={(g) => void (outers.current[i] = g)} {...pickHandlers(props, "koi", i)}>
          <PickRing on={isPicked(props.picked, "koi", i)} r={0.42} />
          <group ref={(g) => void (inners.current[i] = g)} scale={1.5}>
            <mesh scale={[0.065, 0.048, 0.17]} material={toon(k.body, true)} castShadow>
              <sphereGeometry args={[1, 16, 12]} />
            </mesh>
            <mesh position={[0.012, 0.036, 0.05]} scale={[0.042, 0.014, 0.06]} material={toon(k.patch, true)}>
              <sphereGeometry args={[1, 12, 8]} />
            </mesh>
            <mesh position={[-0.014, 0.034, -0.06]} scale={[0.035, 0.013, 0.05]} material={toon(k.patch, true)}>
              <sphereGeometry args={[1, 12, 8]} />
            </mesh>
            <group ref={(g) => void (tails.current[i] = g)} position={[0, 0, -0.15]}>
              <mesh position={[0, 0, -0.07]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.2]} material={toon(k.fin, true)}>
                <coneGeometry args={[0.075, 0.14, 3]} />
              </mesh>
            </group>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.06, -0.01, 0.06]} rotation={[0, side * 0.6, side * 0.4]} scale={[0.04, 0.006, 0.03]} material={toon(k.fin, true)}>
                <sphereGeometry args={[1, 8, 6]} />
              </mesh>
            ))}
            <HitArea r={0.2} />
          </group>
        </group>
      ))}
      <group ref={pellets}>
        {Array.from({ length: 8 }, (_, j) => (
          <mesh key={j} material={toon("#c98a4a")} visible={false}>
            <sphereGeometry args={[0.014, 6, 5]} />
          </mesh>
        ))}
      </group>
    </>
  );
}

/** The whole pond: water, shore, lily pads, the dock and everyone who lives there. */
export function Pond(props: PickProps) {
  return (
    <>
      <Splashes />
      <Water />
      <Shore />
      <LilyPads />
      <Dock />
      <Frog {...props} />
      {DUCK_PATHS.map((_, i) => (
        <Duck key={i} index={i} {...props} />
      ))}
      <Koi {...props} />
      {[0, 1].map((i) => (
        <GrassDuck key={i} index={i} {...props} />
      ))}
      <Minnows />
      <Dragonflies />
      <FloatingPetals />
    </>
  );
}
