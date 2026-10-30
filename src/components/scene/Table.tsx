"use client";

// Placeholder table. Replace with the designed model (e.g. useGLTF("/models/table.glb")).
const TOP = { width: 2.4, depth: 1.2, height: 0.08, y: 0.76 };
const LEG = 0.07;

export function Table() {
  const legX = TOP.width / 2 - 0.15;
  const legZ = TOP.depth / 2 - 0.12;
  return (
    <group>
      <mesh position={[0, TOP.y, 0]} castShadow receiveShadow>
        <boxGeometry args={[TOP.width, TOP.height, TOP.depth]} />
        <meshStandardMaterial color="#d6c4ad" roughness={0.6} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * legX, TOP.y / 2, sz * legZ]} castShadow>
            <boxGeometry args={[LEG, TOP.y, LEG]} />
            <meshStandardMaterial color="#b49c80" />
          </mesh>
        )),
      )}
    </group>
  );
}
