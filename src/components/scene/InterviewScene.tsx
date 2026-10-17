"use client";

import { Canvas } from "@react-three/fiber";
import { Character } from "./Character";
import { Table } from "./Table";
import type { SceneState } from "./types";

/**
 * The interview room. Over-the-shoulder view from behind the candidate, looking
 * across the table at the interviewer. Load this with next/dynamic and
 * ssr: false; three.js needs the browser.
 */
const BACKGROUND = "#f1f5f9";

export default function InterviewScene({ state, compact = false }: { state: SceneState; compact?: boolean }) {
  // Narrow panels (beside the editor or whiteboard) need a wider, more centered shot.
  const camera = compact ? { position: [1.3, 2.5, 4.9] as const, fov: 46 } : { position: [1.8, 2.3, 3.7] as const, fov: 42 };
  return (
    <Canvas shadows="percentage" camera={{ position: [...camera.position], fov: camera.fov }} onCreated={({ camera: c }) => c.lookAt(-0.15, 1.1, -0.5)}>
      <color attach="background" args={[BACKGROUND]} />
      {/* Fade the floor into the background so there's no hard horizon edge. */}
      <fog attach="fog" args={[BACKGROUND, 6, 14]} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[3, 5, 2]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 2.4, -1.6]} intensity={2} color="#ccfbf1" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#e6ebf1" />
      </mesh>

      <Table />
      <Character color="#6366f1" activity={state.interviewer} position={[0, 0, -1.0]} />
      <Character color="#14b8a6" activity={state.candidate} position={[-0.5, 0, 1.0]} rotationY={Math.PI} />
    </Canvas>
  );
}
