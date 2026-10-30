"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { daylight } from "./daylight";
import { groundY, inView, Island, isOpen, nearGardenSlot, rng } from "./island";
import { softDot } from "./textures";
import { gradientMap, toon } from "./toon";

// The sky and the life around the floating island (see island.tsx for the island itself): a hazy pastel sky that
// turns to sunset when you finish, clouds high above and drifting below, swaying grass and wildflowers, pine and
// round trees, butterflies and blossom petals by day, fireflies at dusk.

export const COLORS = {
  fog: "#e6e0dc",
  fogSunset: "#e3aeb0",
};

function Sky() {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        uniforms: { sunDir: { value: new THREE.Vector3(-0.55, 0.12, -0.83).normalize() }, uEvening: { value: 0 } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform vec3 sunDir; uniform float uEvening; varying vec3 vDir;
          void main(){
            float h = vDir.y;
            // golden afternoon: warm cream at the horizon into soft blue; sunset: gold and rose into lavender
            vec3 horizon = mix(vec3(1.0, 0.91, 0.80), vec3(1.0, 0.74, 0.56), uEvening);
            vec3 mid = mix(vec3(0.82, 0.86, 0.95), vec3(0.93, 0.62, 0.70), uEvening);
            vec3 top = mix(vec3(0.56, 0.68, 0.92), vec3(0.47, 0.40, 0.72), uEvening);
            vec3 haze = mix(vec3(0.86, 0.84, 0.88), vec3(0.78, 0.58, 0.66), uEvening);  // the void below the island
            vec3 c = mix(horizon, mid, smoothstep(-0.02, 0.22, h));
            c = mix(c, top, smoothstep(0.22, 0.8, h));
            c = mix(c, haze, smoothstep(-0.02, -0.5, h));
            float s = max(dot(vDir, sunDir), 0.0);
            c += vec3(1.0, 0.62, 0.40) * pow(s, 6.0) * (0.25 + uEvening * 0.5) * (1.0 - smoothstep(0.0, 0.5, h));
            c += vec3(1.0, 0.85, 0.6) * pow(s, 400.0) * uEvening;   // the sun itself, once it's low
            // written as display colours, decoded to the linear light the effects chain expects; kept just under the
            // bloom threshold so the sky itself never glows over the scene
            gl_FragColor = vec4(min(pow(c, vec3(2.2)), vec3(0.97)), 1.0);
          }`,
      }),
    [],
  );
  useFrame(() => {
    const m = mesh.current?.material as THREE.ShaderMaterial | undefined;
    if (!m) return;
    m.uniforms.uEvening.value = daylight.evening;
    // the sun sinks towards the horizon as evening comes
    m.uniforms.sunDir.value.set(-0.55, 0.12 - daylight.evening * 0.1, -0.83).normalize();
  });
  return (
    <mesh ref={mesh} material={material} renderOrder={-1}>
      <sphereGeometry args={[400, 32, 16]} />
    </mesh>
  );
}

// The breeze: one clock shared by the grass shader. Each blade leans by its height, in waves that roll across the field.
const wind = { value: 0 };
const grassMaterial = (() => {
  const m = new THREE.MeshToonMaterial({ gradientMap: gradientMap() });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uWind;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 at = instanceMatrix[3].xz;
        #else
          vec2 at = vec2(0.0);
        #endif
        float sway = sin(uWind * 1.5 + at.x * 0.3 + at.y * 0.2) * 0.6 + sin(uWind * 2.6 + at.x * 0.9) * 0.2;
        transformed.x += sway * position.y * 0.9;
        transformed.z += sway * position.y * 0.35;`,
      );
  };
  return m;
})();

// Tufts of grass and wildflowers (buttercups, pink clover, daisies, a little lavender) over the island's open ground,
// as two instanced meshes.
function Grass() {
  const blades = useRef<THREE.InstancedMesh>(null);
  const flowers = useRef<THREE.InstancedMesh>(null);
  const BLADES = 9000, FLOWERS = 900;
  const bladeGeo = useMemo(() => new THREE.ConeGeometry(0.028, 0.2, 3).translate(0, 0.1, 0), []);

  useLayoutEffect(() => {
    const r = rng(7), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const c = new THREE.Color();
    const scatter = (mesh: THREE.InstancedMesh, count: number, each: (i: number) => void) => {
      for (let i = 0; i < count; i++) {
        let x = 0, z = 0;
        do {
          x = (r() - 0.5) * 28;
          z = (r() - 0.5) * 28;
        } while (!isOpen(x, z));
        p.set(x, groundY(x, z), z);
        each(i);
        m.compose(p, q.setFromEuler(e), s);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    if (blades.current) {
      const mesh = blades.current;
      scatter(mesh, BLADES, (i) => {
        e.set((r() - 0.5) * 0.4, r() * Math.PI, (r() - 0.5) * 0.4);
        const k = 0.5 + r() * 0.7;
        s.set(k, k * (0.7 + r() * 0.8), k);
        mesh.setColorAt(i, c.setHSL(0.23 + r() * 0.04, 0.5 + r() * 0.12, 0.42 + r() * 0.12));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    if (flowers.current) {
      const mesh = flowers.current;
      const petals = ["#ffe066", "#ffe066", "#ffb8cf", "#ffffff", "#cdb8f5"];
      scatter(mesh, FLOWERS, (i) => {
        e.set(0, 0, 0);
        p.y += 0.1 + r() * 0.08;
        s.setScalar(0.6 + r() * 0.6);
        mesh.setColorAt(i, c.set(petals[Math.floor(r() * petals.length)]));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [BLADES, FLOWERS]);

  useFrame(({ clock }) => {
    wind.value = clock.getElapsedTime();
  });

  return (
    <>
      <instancedMesh ref={blades} args={[bladeGeo, grassMaterial, BLADES]} receiveShadow />
      <instancedMesh ref={flowers} args={[undefined, undefined, FLOWERS]}>
        <sphereGeometry args={[0.03, 8, 6]} />
        <meshToonMaterial gradientMap={gradientMap()} emissive="#fff3d0" emissiveIntensity={0.15} />
      </instancedMesh>
    </>
  );
}

// Trees and bushes on the island: slim cel-shaded pines like the reference, a few round puffy trees, and flowering
// bushes, placed on open ground away from the table so the view from your seat stays clear.
function Trees() {
  const { pines, rounds, bushes } = useMemo(() => {
    const r = rng(42);
    const place = <T,>(count: number, minR: number, pad: number, make: (x: number, z: number) => T) => {
      const out: T[] = [];
      for (let tries = 0; out.length < count && tries < count * 60; tries++) {
        const x = (r() - 0.5) * 28, z = (r() - 0.5) * 28;
        if (Math.hypot(x, z) > minR && isOpen(x, z, pad) && !inView(x, z) && !nearGardenSlot(x, z, 1.6)) out.push(make(x, z));
      }
      return out;
    };
    return {
      pines: place(26, 6, 0.6, (x, z) => ({ x, z, s: 0.7 + r() * 0.6, tone: Math.floor(r() * 3) })),
      rounds: place(6, 7, 1.2, (x, z) => ({ x, z, s: 0.55 + r() * 0.3, tone: Math.floor(r() * 3) })),
      bushes: place(14, 3.2, 0.3, (x, z) => ({ x, z, s: 0.4 + r() * 0.35, tone: Math.floor(r() * 3), flowers: r() > 0.5 })),
    };
  }, []);
  const pine = ["#4f9a5c", "#5ca865", "#468e55"], leaves = ["#7cc46a", "#8fd177", "#6db760"];
  return (
    <>
      {pines.map((t, i) => (
        <group key={`p${i}`} position={[t.x, groundY(t.x, t.z), t.z]} scale={t.s}>
          <mesh position={[0, 0.3, 0]} material={toon("#8a6248")} castShadow>
            <cylinderGeometry args={[0.08, 0.11, 0.6, 7]} />
          </mesh>
          <mesh position={[0, 1.05, 0]} material={toon(pine[t.tone])} castShadow>
            <coneGeometry args={[0.55, 1.2, 8]} />
          </mesh>
          <mesh position={[0, 1.6, 0]} material={toon(pine[(t.tone + 1) % 3])} castShadow>
            <coneGeometry args={[0.4, 0.95, 8]} />
          </mesh>
        </group>
      ))}
      {rounds.map((t, i) => (
        <group key={`r${i}`} position={[t.x, groundY(t.x, t.z), t.z]} scale={t.s}>
          <mesh position={[0, 0.9, 0]} material={toon("#a8764f")} castShadow>
            <capsuleGeometry args={[0.2, 1.4, 4, 10]} />
          </mesh>
          {[
            [0, 2.7, 0, 1.4],
            [0.9, 2.3, 0.2, 1.0],
            [-0.8, 2.4, -0.2, 1.05],
            [0.1, 3.4, 0.1, 0.95],
          ].map(([x, y, z, rad], j) => (
            <mesh key={j} position={[x, y, z]} material={toon(leaves[(t.tone + j) % 3])} castShadow>
              <sphereGeometry args={[rad, 24, 16]} />
            </mesh>
          ))}
        </group>
      ))}
      {bushes.map((b, i) => (
        <group key={`b${i}`} position={[b.x, groundY(b.x, b.z), b.z]} scale={b.s}>
          {[
            [0, 0.35, 0, 0.5],
            [0.45, 0.28, 0.1, 0.38],
            [-0.42, 0.26, -0.05, 0.36],
          ].map(([x, y, z, rad], j) => (
            <mesh key={j} position={[x, y, z]} material={toon(leaves[(b.tone + j) % 3])} castShadow>
              <sphereGeometry args={[rad, 20, 14]} />
            </mesh>
          ))}
          {b.flowers &&
            [
              [0.1, 0.8, 0.3],
              [-0.3, 0.62, 0.32],
              [0.5, 0.58, 0.3],
            ].map(([x, y, z], j) => (
              <mesh key={`f${j}`} position={[x, y, z]} material={toon(j % 2 ? "#ffffff" : "#ffb8cf")}>
                <sphereGeometry args={[0.07, 10, 8]} />
              </mesh>
            ))}
        </group>
      ))}
    </>
  );
}

const CLOUD_SUNSET = new THREE.Color("#ffb08e");

// Soft drifting clouds, high in the sky and drifting below the island (it's floating, after all), all of them blushing
// at sunset.
function Clouds() {
  const group = useRef<THREE.Group>(null);
  const map = useMemo(() => softDot(), []);
  const clouds = useMemo(() => {
    const r = rng(3);
    const high = Array.from({ length: 18 }, () => {
      const a = -Math.PI * 0.95 + r() * Math.PI * 1.3, d = 140 + r() * 120;
      return {
        p: [Math.cos(a) * d, 25 + r() * 55, Math.sin(a) * d] as const,
        s: [50 + r() * 70, 14 + r() * 14] as const,
        color: new THREE.Color(r() > 0.55 ? "#ffd9c8" : "#ffffff"),
        o: 0.4 + r() * 0.4,
      };
    });
    const low = Array.from({ length: 16 }, () => {
      const a = r() * Math.PI * 2, d = 22 + r() * 60;
      return {
        p: [Math.cos(a) * d, -9 - r() * 14, Math.sin(a) * d] as const,
        s: [24 + r() * 30, 8 + r() * 6] as const,
        color: new THREE.Color("#ffffff"),
        o: 0.35 + r() * 0.3,
      };
    });
    return [...high, ...low];
  }, []);
  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.rotation.y += dt * 0.004;
    group.current.children.forEach((sprite, i) => {
      ((sprite as THREE.Sprite).material as THREE.SpriteMaterial).color.copy(clouds[i].color).lerp(CLOUD_SUNSET, daylight.evening * 0.8);
    });
  });
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <sprite key={i} position={[...c.p]} scale={[c.s[0], c.s[1], 1]}>
          <spriteMaterial map={map} opacity={c.o} transparent depthWrite={false} fog={false} />
        </sprite>
      ))}
    </group>
  );
}

// A few butterflies looping lazily around the table (they go home at sunset).
function Butterflies() {
  const group = useRef<THREE.Group>(null);
  const flyers = useMemo(() => {
    const r = rng(19);
    return Array.from({ length: 5 }, (_, i) => ({ r: 2.2 + r() * 2.5, speed: 0.15 + r() * 0.12, phase: r() * Math.PI * 2, y: 0.9 + r() * 0.8, color: ["#ffb8cf", "#ffffff", "#ffe066", "#cdb8f5", "#a9d4f5"][i] }));
  }, []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (group.current) group.current.visible = daylight.evening < 0.6;
    group.current?.children.forEach((b, i) => {
      const f = flyers[i];
      const a = t * f.speed + f.phase;
      b.position.set(Math.cos(a) * f.r, f.y + Math.sin(t * 1.3 + f.phase) * 0.25, Math.sin(a * 1.3) * f.r * 0.8);
      b.rotation.y = -a;
      const flap = Math.sin(t * 14 + f.phase) * 0.9;
      b.children[0].rotation.z = flap;
      b.children[1].rotation.z = -flap;
    });
  });
  return (
    <group ref={group}>
      {flyers.map((f, i) => (
        <group key={i}>
          {/* two wings, each hinged at the body and flapping up and down */}
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh position={[side * 0.035, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.07, 0.05]} />
                <meshBasicMaterial color={f.color} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

// Blossom petals drifting down through the air by day.
function Petals() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const COUNT = 40;
  const petals = useMemo(() => {
    const r = rng(23);
    return Array.from({ length: COUNT }, () => ({ x: (r() - 0.5) * 14, z: (r() - 0.5) * 14, y0: r() * 5, speed: 0.15 + r() * 0.15, spin: r() * 6, sway: r() * 6 }));
  }, []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1) }), []);
  useLayoutEffect(() => {
    const colors = ["#ffc4d6", "#ffffff", "#ffd9e4"];
    const c = new THREE.Color();
    petals.forEach((_, i) => mesh.current?.setColorAt(i, c.set(colors[i % 3])));
    if (mesh.current?.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [petals]);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.getElapsedTime();
    m.visible = daylight.evening < 0.9;
    petals.forEach((pt, i) => {
      const y = 5 - ((pt.y0 + t * pt.speed) % 5); // fall from 5 m to the ground, then start again at the top
      tmp.p.set(pt.x + Math.sin(t * 0.7 + pt.sway) * 0.6, y, pt.z + Math.cos(t * 0.5 + pt.sway) * 0.4);
      tmp.e.set(t * 1.3 + pt.spin, t * 0.9 + pt.spin, t * 0.5);
      tmp.m.compose(tmp.p, tmp.q.setFromEuler(tmp.e), tmp.s);
      m.setMatrixAt(i, tmp.m);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <planeGeometry args={[0.05, 0.035]} />
      <meshBasicMaterial side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

// Fireflies, which come out with the sunset: soft glowing dots drifting and twinkling around the table.
function Fireflies() {
  const points = useRef<THREE.Points>(null);
  const COUNT = 60;
  const map = useMemo(() => softDot(), []);
  const flies = useMemo(() => {
    const r = rng(31);
    return Array.from({ length: COUNT }, () => ({ a: r() * Math.PI * 2, d: 1.6 + r() * 6, y: 0.3 + r() * 1.8, speed: 0.05 + r() * 0.1, phase: r() * 10 }));
  }, []);
  const positions = useMemo(() => new Float32Array(COUNT * 3), []);
  useFrame(({ clock }) => {
    const p = points.current;
    if (!p) return;
    const t = clock.getElapsedTime();
    const attr = p.geometry.attributes.position as THREE.BufferAttribute;
    flies.forEach((f, i) => {
      const a = f.a + t * f.speed;
      attr.setXYZ(i, Math.cos(a) * f.d + Math.sin(t * 0.6 + f.phase) * 0.3, f.y + Math.sin(t * 0.9 + f.phase) * 0.25, Math.sin(a) * f.d);
    });
    attr.needsUpdate = true;
    const m = p.material as THREE.PointsMaterial;
    m.opacity = daylight.evening * (0.75 + Math.sin(t * 3) * 0.25);
    p.visible = daylight.evening > 0.02;
  });
  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial map={map} color="#fff1a8" size={0.16} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
    </points>
  );
}

export function Landscape() {
  return (
    <>
      <Sky />
      <Clouds />
      <Island />
      <Grass />
      <Trees />
      <Butterflies />
      <Petals />
      <Fireflies />
    </>
  );
}
