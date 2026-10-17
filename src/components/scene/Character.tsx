"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import type { Activity } from "./types";

interface CharacterProps {
  color: string;
  activity: Activity;
  position: [number, number, number];
  /** Radians around Y; characters face each other across the table. */
  rotationY?: number;
}

/**
 * Placeholder character: a box body and box head. To swap in the designed
 * model, keep this component's props and replace the meshes with the GLTF,
 * mapping `activity` to its animation clips (talk, listen, think, idle).
 */
export function Character({ color, activity, position, rotationY = 0 }: CharacterProps) {
  const head = useRef<Mesh>(null);
  const body = useRef<Group>(null);
  const thinkingDot = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (head.current) {
      // Speaking: quick nod. Listening: slight tilt. Otherwise: gentle breathing.
      head.current.rotation.x = activity === "speaking" ? Math.sin(t * 9) * 0.08 : 0;
      head.current.rotation.z = activity === "listening" ? 0.12 : 0;
      const material = head.current.material as MeshStandardMaterial;
      const glow = activity === "speaking" ? 0.35 + Math.sin(t * 12) * 0.15 : activity === "listening" ? 0.25 : 0;
      material.emissiveIntensity = glow;
    }
    if (body.current) {
      body.current.position.y = Math.sin(t * 1.6) * 0.008;
    }
    if (thinkingDot.current) {
      thinkingDot.current.visible = activity === "thinking";
      thinkingDot.current.position.y = 1.95 + Math.sin(t * 4) * 0.04;
      thinkingDot.current.rotation.y = t * 2;
    }
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group ref={body}>
        {/* Seat */}
        <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.55, 0.08, 0.55]} />
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
        {/* Torso */}
        <mesh position={[0, 1.0, 0]} castShadow>
          <boxGeometry args={[0.5, 0.75, 0.3]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
        {/* Head */}
        <mesh ref={head} position={[0, 1.58, 0]} castShadow>
          <boxGeometry args={[0.3, 0.32, 0.3]} />
          <meshStandardMaterial color="#f1d3b3" emissive={color} emissiveIntensity={0} />
        </mesh>
      </group>
      <mesh ref={thinkingDot} position={[0, 1.95, 0]} visible={false}>
        <octahedronGeometry args={[0.07]} />
        <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}
