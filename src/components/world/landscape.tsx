"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// The open field the table sits in: green grass and a big sky in the middle of nowhere, after the reference photos
// (rolling lawn, a curving path, a few buildings far off, a soft pink-and-blue evening sky). Everything is procedural.

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Seeded random, so the field looks the same on every load.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ground height. Flat around the table, rolling hills further out, and a long rise behind like a hilltop park. */
export function heightAt(x: number, z: number) {
  const r = Math.hypot(x, z);
  const hills = Math.sin(x * 0.055) * 2.2 + Math.cos(z * 0.048 + 1) * 2.4 + Math.sin((x + z) * 0.1) * 0.9 + Math.sin(x * 0.21 - z * 0.17) * 0.3;
  const rise = smooth(-20, -70, z) * 5 * smooth(-90, -30, x);
  const near = Math.sin(x * 0.4) * Math.cos(z * 0.35) * 0.05;
  return near + smooth(7, 26, r) * (hills + 2.2 + rise);
}

export const COLORS = {
  horizon: "#f3d9c8",
  fog: "#e7e3dc",
};

function Sky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        uniforms: { sunDir: { value: new THREE.Vector3(-0.55, 0.12, -0.83).normalize() } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform vec3 sunDir; varying vec3 vDir;
          void main(){
            float h = vDir.y;
            vec3 horizon = vec3(0.97, 0.84, 0.76);
            vec3 mid = vec3(0.70, 0.79, 0.93);
            vec3 top = vec3(0.40, 0.57, 0.86);
            vec3 c = mix(horizon, mid, smoothstep(-0.02, 0.2, h));
            c = mix(c, top, smoothstep(0.2, 0.75, h));
            float s = max(dot(vDir, sunDir), 0.0);
            c += vec3(1.0, 0.62, 0.45) * pow(s, 6.0) * 0.28 * (1.0 - smoothstep(0.0, 0.5, h));
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  );
  return (
    <mesh material={material} renderOrder={-1}>
      <sphereGeometry args={[400, 32, 16]} />
    </mesh>
  );
}

function Ground() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(520, 520, 200, 200);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const base = new THREE.Color("#6f9e45");
    const light = new THREE.Color("#a5c25c");
    const dark = new THREE.Color("#4f7d33");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = heightAt(x, z);
      pos.setY(i, y);
      // mottled lawn: lighter on the crests, darker in the dips, with some patchiness
      const n = Math.sin(x * 0.7) * Math.cos(z * 0.6) * 0.5 + Math.sin(x * 0.13 + z * 0.21) * 0.5;
      c.copy(base).lerp(n > 0 ? light : dark, Math.abs(n) * 0.45 + smooth(1, 6, y) * 0.2);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
  );
}

// A paved path curving past the table and up the hill, as a ribbon laid on the ground.
function Path() {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      [
        [7, 16],
        [3.4, 7],
        [3.6, 0],
        [1.5, -9],
        [-5, -20],
        [-9, -34],
        [-20, -60],
      ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
    );
    const N = 240, W = 1.1;
    const verts: number[] = [], idx: number[] = [];
    for (let i = 0; i <= N; i++) {
      const p = curve.getPointAt(i / N), t = curve.getTangentAt(i / N);
      const sx = -t.z, sz = t.x;
      for (const s of [-1, 1]) {
        const x = p.x + (sx * W * s) / 2, z = p.z + (sz * W * s) / 2;
        verts.push(x, heightAt(x, z) + 0.035, z);
      }
      if (i < N) {
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#8a8f95" roughness={0.95} polygonOffset polygonOffsetFactor={-2} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Tufts of grass and little yellow buttercups, as two instanced meshes.
function Grass() {
  const blades = useRef<THREE.InstancedMesh>(null);
  const flowers = useRef<THREE.InstancedMesh>(null);
  const BLADES = 7000, FLOWERS = 500;
  const bladeGeo = useMemo(() => new THREE.ConeGeometry(0.022, 0.18, 3).translate(0, 0.09, 0), []);

  useLayoutEffect(() => {
    const r = rng(7), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const c = new THREE.Color();
    const scatter = (mesh: THREE.InstancedMesh, count: number, min: number, max: number, each: (i: number) => void) => {
      for (let i = 0; i < count; i++) {
        const a = r() * Math.PI * 2, d = min + Math.sqrt(r()) * (max - min);
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        p.set(x, heightAt(x, z), z);
        each(i);
        m.compose(p, q.setFromEuler(e), s);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    if (blades.current) {
      const mesh = blades.current;
      scatter(mesh, BLADES, 1.2, 34, (i) => {
        e.set((r() - 0.5) * 0.5, r() * Math.PI, (r() - 0.5) * 0.5);
        const k = 0.5 + r() * 0.7;
        s.set(k, k * (0.7 + r() * 0.8), k);
        mesh.setColorAt(i, c.setHSL(0.22 + r() * 0.05, 0.4 + r() * 0.15, 0.32 + r() * 0.12));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    if (flowers.current) {
      const mesh = flowers.current;
      scatter(mesh, FLOWERS, 2.5, 28, () => {
        e.set(0, 0, 0);
        p.y += 0.1 + r() * 0.08;
        s.setScalar(0.6 + r() * 0.6);
      });
    }
  }, [BLADES, FLOWERS]);

  return (
    <>
      <instancedMesh ref={blades} args={[bladeGeo, undefined, BLADES]} receiveShadow>
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
      <instancedMesh ref={flowers} args={[undefined, undefined, FLOWERS]}>
        <sphereGeometry args={[0.028, 6, 4]} />
        <meshStandardMaterial color="#f5d43c" emissive="#f5c84c" emissiveIntensity={0.15} roughness={0.8} />
      </instancedMesh>
    </>
  );
}

// Round "lollipop" trees, as in the wireframes.
function Trees() {
  const trees = useMemo(() => {
    const r = rng(42);
    return Array.from({ length: 14 }, () => {
      const a = r() * Math.PI * 2, d = 15 + r() * 30;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      return { x, z, y: heightAt(x, z), s: 0.8 + r() * 0.8, tone: r() };
    }).filter((t) => !(t.z > 4 && Math.abs(t.x) < 12)); // keep the view from the overview camera clear
  }, []);
  return (
    <>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, t.y, t.z]} scale={t.s}>
          <mesh position={[0, 1.1, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.18, 2.2, 8]} />
            <meshStandardMaterial color="#7a5b43" roughness={1} />
          </mesh>
          <mesh position={[0, 3.0, 0]} scale={[1, 1.25, 1]} castShadow>
            <icosahedronGeometry args={[1.4, 2]} />
            <meshStandardMaterial color={t.tone > 0.5 ? "#5f8f45" : "#6f9a4e"} roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}
    </>
  );
}

// A few far-off buildings and an old clock tower, peeking over the hill like the town in the photos.
function Town() {
  const blocks = useMemo(() => {
    const r = rng(11);
    return Array.from({ length: 9 }, (_, i) => ({
      x: -70 + i * 6 + r() * 3,
      z: -95 - r() * 20,
      w: 4 + r() * 4,
      d: 4 + r() * 4,
      h: 6 + r() * 16,
      color: ["#eeeae1", "#a9bccd", "#d8d2c4", "#c8d6e4"][i % 4],
    }));
  }, []);
  const ty = heightAt(-48, -78);
  return (
    <group>
      {blocks.map((b, i) => (
        <mesh key={i} position={[b.x, heightAt(b.x, b.z) - 2 + b.h / 2, b.z]}>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial color={b.color} roughness={0.8} />
        </mesh>
      ))}
      <group position={[-48, ty - 1, -78]}>
        <mesh position={[0, 2, 0]}>
          <boxGeometry args={[6, 4, 4]} />
          <meshStandardMaterial color="#f1ece2" />
        </mesh>
        <mesh position={[0, 5.5, 0]}>
          <boxGeometry args={[2.4, 3, 2.4]} />
          <meshStandardMaterial color="#f4f0e8" />
        </mesh>
        <mesh position={[0, 7.6, 0]}>
          <cylinderGeometry args={[1, 1.1, 1.4, 12]} />
          <meshStandardMaterial color="#f4f0e8" />
        </mesh>
        <mesh position={[0, 8.3, 0]}>
          <sphereGeometry args={[1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#6f9a8a" />
        </mesh>
      </group>
    </group>
  );
}

function cloudTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Soft drifting clouds, some catching the pink of the low sun.
function Clouds() {
  const group = useRef<THREE.Group>(null);
  const map = useMemo(() => cloudTexture(), []);
  const clouds = useMemo(() => {
    const r = rng(3);
    return Array.from({ length: 22 }, () => {
      const a = -Math.PI * 0.95 + r() * Math.PI * 1.3, d = 140 + r() * 120;
      return {
        p: [Math.cos(a) * d, 25 + r() * 55, Math.sin(a) * d] as const,
        s: [50 + r() * 70, 14 + r() * 14] as const,
        color: r() > 0.55 ? "#ffd4c2" : "#ffffff",
        o: 0.35 + r() * 0.4,
      };
    });
  }, []);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.004;
  });
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <sprite key={i} position={[...c.p]} scale={[c.s[0], c.s[1], 1]}>
          <spriteMaterial map={map} color={c.color} opacity={c.o} transparent depthWrite={false} fog={false} />
        </sprite>
      ))}
    </group>
  );
}

export function Landscape() {
  return (
    <>
      <Sky />
      <Clouds />
      <Ground />
      <Path />
      <Grass />
      <Trees />
      <Town />
    </>
  );
}
