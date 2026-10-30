"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";
import * as THREE from "three";
import { gardenItem, type GardenItemId } from "@/lib/garden";
import { BoxLantern, GARDEN_SLOTS, POND, groundY } from "./island";
import { toon } from "./toon";

// The things your island grows as you practise (one per finished session; see lib/garden.ts). Each is a little toy
// placed at its slot. New ones pop in with a bouncy grow and a burst of sparkles the first time you see them.

type V3 = [number, number, number];

/** Grows its children in with an overshoot, plus sparkles, when `fresh`; otherwise just shows them. */
function Grow({ fresh, delay = 0, children }: { fresh: boolean; delay?: number; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const sparkles = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    if (!fresh) {
      group.current.scale.setScalar(1);
      if (sparkles.current) sparkles.current.visible = false;
      return;
    }
    start.current ??= clock.getElapsedTime() + delay;
    const t = Math.max(0, clock.getElapsedTime() - start.current);
    // an elastic ease-out: shoots past full size, wobbles, settles
    const k = t <= 0 ? 0 : t >= 1.4 ? 1 : 1 - Math.exp(-6 * t) * Math.cos(t * 11);
    group.current.scale.setScalar(Math.max(0.001, k));
    if (sparkles.current) {
      sparkles.current.visible = t > 0 && t < 1.6;
      sparkles.current.children.forEach((s, i) => {
        const a = (i / sparkles.current!.children.length) * Math.PI * 2;
        const d = 0.3 + t * 1.6;
        s.position.set(Math.cos(a) * d, 0.4 + t * 1.2 - t * t * 0.6, Math.sin(a) * d);
        ((s as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - t / 1.6);
      });
    }
  });
  return (
    <>
      <group ref={group}>{children}</group>
      {fresh && (
        <group ref={sparkles}>
          {Array.from({ length: 10 }, (_, i) => (
            <mesh key={i}>
              <octahedronGeometry args={[0.06, 0]} />
              <meshBasicMaterial color={i % 2 ? "#fff3a8" : "#ffd1e3"} transparent toneMapped={false} />
            </mesh>
          ))}
        </group>
      )}
    </>
  );
}

const Stem = ({ position, height, color }: { position: V3; height: number; color: string }) => (
  <group position={position}>
    <mesh position={[0, height / 2, 0]} material={toon("#5f9e4a")}>
      <cylinderGeometry args={[0.012, 0.014, height, 5]} />
    </mesh>
    <mesh position={[0, height, 0]} material={toon(color)}>
      <sphereGeometry args={[0.06, 10, 8]} />
    </mesh>
  </group>
);

function FlowerBed() {
  const colors = ["#ff9cc8", "#ffe066", "#ffffff", "#c9b6f2", "#ff8f7a", "#ffb8cf", "#ffe066"];
  return (
    <group>
      <mesh position={[0, 0.03, 0]} scale={[1, 0.25, 0.8]} material={toon("#9a6b45")}>
        <sphereGeometry args={[0.65, 20, 10]} />
      </mesh>
      {colors.map((c, i) => {
        const a = (i / colors.length) * Math.PI * 2;
        return <Stem key={i} position={[Math.cos(a) * 0.38, 0.06, Math.sin(a) * 0.3]} height={0.22 + (i % 3) * 0.06} color={c} />;
      })}
      <Stem position={[0, 0.08, 0]} height={0.32} color="#ff7aa8" />
    </group>
  );
}

function Sunflowers() {
  return (
    <group>
      {[[-0.25, 0, 0.9], [0.1, 0.1, 1.15], [0.35, -0.1, 0.8]].map(([x, z, h], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, h / 2, 0]} material={toon("#5f9e4a")}>
            <cylinderGeometry args={[0.025, 0.03, h, 6]} />
          </mesh>
          <group position={[0, h, 0.02]} rotation={[0.35, 0, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={toon("#ffd23f")}>
              <cylinderGeometry args={[0.2, 0.2, 0.03, 14]} />
            </mesh>
            <mesh position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]} material={toon("#7a4a2a")}>
              <cylinderGeometry args={[0.1, 0.1, 0.04, 12]} />
            </mesh>
          </group>
          <mesh position={[0.08, h * 0.45, 0]} rotation={[0, 0, -0.8]} scale={[1, 0.3, 0.6]} material={toon("#6fae5a")}>
            <sphereGeometry args={[0.1, 10, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function LanternPost() {
  return (
    <group>
      <mesh position={[0, 0.6, 0]} material={toon("#7a5a40")} castShadow>
        <boxGeometry args={[0.1, 1.2, 0.1]} />
      </mesh>
      <mesh position={[0.15, 1.18, 0]} material={toon("#7a5a40")}>
        <boxGeometry args={[0.36, 0.06, 0.06]} />
      </mesh>
      <BoxLantern position={[0.28, 0.9, 0]} />
    </group>
  );
}

function BlossomTree({ blossom, fruit }: { blossom: string[]; fruit?: string }) {
  return (
    <group scale={0.85}>
      <mesh position={[0, 0.8, 0]} material={toon("#9a6b4f")} castShadow>
        <capsuleGeometry args={[0.16, 1.2, 4, 10]} />
      </mesh>
      {[
        [0, 2.1, 0, 0.95],
        [0.65, 1.8, 0.15, 0.7],
        [-0.6, 1.85, -0.1, 0.72],
        [0.1, 2.65, 0.05, 0.65],
      ].map(([x, y, z, rad], j) => (
        <mesh key={j} position={[x, y, z]} material={toon(blossom[j % blossom.length])} castShadow>
          <sphereGeometry args={[rad, 22, 16]} />
        </mesh>
      ))}
      {fruit &&
        [[0.5, 1.7, 0.6], [-0.4, 2.0, 0.6], [0.2, 2.4, 0.6], [-0.7, 1.6, 0.3]].map(([x, y, z], k) => (
          <mesh key={k} position={[x, y, z]} material={toon(fruit)}>
            <sphereGeometry args={[0.1, 10, 8]} />
          </mesh>
        ))}
    </group>
  );
}

function Bench() {
  const wood = toon("#b07a4f"), dark = toon("#7a5a40");
  return (
    <group>
      <mesh position={[0, 0.42, 0]} material={wood} castShadow>
        <boxGeometry args={[1.3, 0.07, 0.4]} />
      </mesh>
      <mesh position={[0, 0.72, -0.18]} rotation={[-0.15, 0, 0]} material={wood} castShadow>
        <boxGeometry args={[1.3, 0.3, 0.06]} />
      </mesh>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.2, 0]} material={dark}>
          <boxGeometry args={[0.08, 0.42, 0.36]} />
        </mesh>
      ))}
    </group>
  );
}

function Beehive() {
  const bees = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    bees.current?.children.forEach((b, i) => {
      const a = t * (1.6 + i * 0.4) + i * 2;
      b.position.set(Math.cos(a) * (0.55 + i * 0.1), 0.7 + Math.sin(t * 3 + i) * 0.15, Math.sin(a) * (0.55 + i * 0.1));
    });
  });
  return (
    <group>
      <mesh position={[0, 0.2, 0]} material={toon("#7a5a40")}>
        <cylinderGeometry args={[0.08, 0.1, 0.4, 8]} />
      </mesh>
      {[0.48, 0.66, 0.82, 0.94].map((y, i) => (
        <mesh key={y} position={[0, y, 0]} scale={[1, 0.55, 1]} material={toon(i % 2 ? "#e2b04a" : "#d49a3a")}>
          <sphereGeometry args={[0.3 - i * 0.06, 16, 10]} />
        </mesh>
      ))}
      <mesh position={[0, 0.55, 0.27]} material={toon("#4a3424")}>
        <circleGeometry args={[0.06, 12]} />
      </mesh>
      <group ref={bees}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} material={toon("#ffd23f")}>
            <sphereGeometry args={[0.035, 8, 6]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Three ducks paddling slow circles on the pond. Placed relative to the pond, not a slot. */
function Ducks() {
  const ducks = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    ducks.current?.children.forEach((d, i) => {
      const a = t * 0.18 + (i * Math.PI * 2) / 3;
      d.position.set(Math.cos(a) * (0.9 + i * 0.12), -0.07 + Math.sin(t * 2 + i) * 0.01, Math.sin(a) * (0.9 + i * 0.12));
      d.rotation.y = -a; // facing along the circle
    });
  });
  return (
    <group ref={ducks}>
      {[0, 1, 2].map((i) => (
        <group key={i} scale={i === 2 ? 0.7 : 1}>
          <mesh scale={[0.7, 0.55, 1]} material={toon(i === 0 ? "#ffffff" : "#f4efe4")}>
            <sphereGeometry args={[0.16, 14, 10]} />
          </mesh>
          <mesh position={[0, 0.12, 0.12]} material={toon(i === 0 ? "#ffffff" : "#f4efe4")}>
            <sphereGeometry args={[0.08, 12, 10]} />
          </mesh>
          <mesh position={[0, 0.11, 0.21]} rotation={[Math.PI / 2, 0, 0]} scale={[1.3, 1, 0.6]} material={toon("#f4a35f")}>
            <coneGeometry args={[0.03, 0.06, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Mushrooms() {
  return (
    <group>
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2, s = 0.7 + (i % 3) * 0.2;
        return (
          <group key={i} position={[Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55]} scale={s}>
            <mesh position={[0, 0.1, 0]} material={toon("#f6efe2")}>
              <cylinderGeometry args={[0.04, 0.05, 0.2, 8]} />
            </mesh>
            <mesh position={[0, 0.2, 0]} scale={[1, 0.6, 1]} material={toon("#e0574a")}>
              <sphereGeometry args={[0.12, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
            <mesh position={[0.04, 0.27, 0.05]} material={toon("#ffffff")}>
              <sphereGeometry args={[0.018, 6, 5]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Birdhouse() {
  return (
    <group>
      <mesh position={[0, 0.55, 0]} material={toon("#7a5a40")}>
        <boxGeometry args={[0.08, 1.1, 0.08]} />
      </mesh>
      <mesh position={[0, 1.25, 0]} material={toon("#9ad0e8")} castShadow>
        <boxGeometry args={[0.36, 0.34, 0.32]} />
      </mesh>
      <mesh position={[0, 1.5, 0]} rotation={[0, Math.PI / 4, 0]} material={toon("#e0574a")} castShadow>
        <coneGeometry args={[0.32, 0.24, 4]} />
      </mesh>
      <mesh position={[0, 1.27, 0.17]} material={toon("#3a2a20")}>
        <circleGeometry args={[0.06, 12]} />
      </mesh>
    </group>
  );
}

function Scarecrow() {
  return (
    <group>
      <mesh position={[0, 0.7, 0]} material={toon("#8a6248")}>
        <boxGeometry args={[0.08, 1.4, 0.08]} />
      </mesh>
      <mesh position={[0, 1.05, 0]} material={toon("#8a6248")}>
        <boxGeometry args={[0.9, 0.07, 0.07]} />
      </mesh>
      <mesh position={[0, 0.95, 0]} material={toon("#6f9fd8")} castShadow>
        <boxGeometry args={[0.5, 0.45, 0.2]} />
      </mesh>
      <mesh position={[0, 1.38, 0]} material={toon("#f3d9a0")}>
        <sphereGeometry args={[0.17, 14, 10]} />
      </mesh>
      <mesh position={[0, 1.52, 0]} material={toon("#d9b25a")}>
        <cylinderGeometry args={[0.32, 0.32, 0.03, 18]} />
      </mesh>
      <mesh position={[0, 1.6, 0]} material={toon("#d9b25a")}>
        <cylinderGeometry args={[0.13, 0.16, 0.16, 14]} />
      </mesh>
    </group>
  );
}

/** A hot-air balloon drifting above the island. Not tied to a slot. */
function Balloon() {
  const balloon = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (balloon.current) balloon.current.position.set(-6 + Math.sin(t * 0.07) * 2, 7.5 + Math.sin(t * 0.5) * 0.3, -5 + Math.cos(t * 0.07) * 2);
  });
  return (
    <group ref={balloon}>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} rotation={[0, (i / 8) * Math.PI * 2, 0]} material={toon(i % 2 ? "#ffe9c7" : "#ef7a66")}>
          <sphereGeometry args={[1.3, 6, 20, 0, Math.PI / 4, 0, Math.PI * 0.8]} />
        </mesh>
      ))}
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <mesh key={`${x}${z}`} position={[x * 0.25, -1.5, z * 0.25]} material={toon("#7a5a40")}>
            <cylinderGeometry args={[0.012, 0.012, 0.9, 4]} />
          </mesh>
        )),
      )}
      <mesh position={[0, -2.05, 0]} material={toon("#a8764f")} castShadow>
        <boxGeometry args={[0.6, 0.4, 0.6]} />
      </mesh>
    </group>
  );
}

const MODELS: Record<GardenItemId, () => ReactNode> = {
  flowerbed: () => <FlowerBed />,
  sunflowers: () => <Sunflowers />,
  lanternpost: () => <LanternPost />,
  cherry: () => <BlossomTree blossom={["#ffc4d8", "#ffb0cb", "#ffd6e4"]} />,
  bench: () => <Bench />,
  beehive: () => <Beehive />,
  ducks: () => <Ducks />,
  mushrooms: () => <Mushrooms />,
  birdhouse: () => <Birdhouse />,
  scarecrow: () => <Scarecrow />,
  balloon: () => <Balloon />,
  apple: () => <BlossomTree blossom={["#7cc46a", "#8fd177", "#6db760"]} fruit="#e0574a" />,
};

/**
 * Everything you've grown, `count` items in all. Items from `freshFrom` on are new since you last looked and pop in.
 */
export function Garden({ count, freshFrom }: { count: number; freshFrom: number }) {
  const shown = Math.min(count, GARDEN_SLOTS.length);
  return (
    <>
      {Array.from({ length: shown }, (_, i) => {
        const item = gardenItem(i);
        const fresh = i >= freshFrom;
        const delay = (i - freshFrom) * 0.6; // several new things grow one after another
        if (item.id === "ducks") {
          return (
            <group key={i} position={[POND.x, 0, POND.z]}>
              <Grow fresh={fresh} delay={delay}>
                {MODELS.ducks()}
              </Grow>
            </group>
          );
        }
        if (item.id === "balloon") {
          return (
            <Grow key={i} fresh={fresh} delay={delay}>
              {MODELS.balloon()}
            </Grow>
          );
        }
        const slot = GARDEN_SLOTS[i];
        return (
          <group key={i} position={[slot.x, groundY(slot.x, slot.z), slot.z]} rotation={[0, slot.angle, 0]}>
            <Grow fresh={fresh} delay={delay}>
              {MODELS[item.id]()}
            </Grow>
          </group>
        );
      })}
    </>
  );
}
