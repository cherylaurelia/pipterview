"use client";

import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { toon } from "./toon";

// Furniture written as sand3d programs (models/*.py, built into public/models/*.glb by `npm run models`) rather than
// assembled shape by shape here. The files are meshopt-compressed (about a sixth of the size). Each model comes in as its
// named parts, each part's geometry in the model's own space in metres, and is drawn in the world's soft-shaded look: a
// part's material is named after its colour in the program ("oak #a77a4f"), which becomes the toon material of that colour.

export type ModelName = "table" | "chair";

export interface ModelPart {
  /** The part's name in its program: "top", "leg"… (copies share it). */
  name: string;
  geometry: THREE.BufferGeometry;
  color: string;
}

const url = (name: ModelName) => `/models/${name}.glb`;
const withMeshopt = (loader: GLTFLoader) => void loader.setMeshoptDecoder(MeshoptDecoder);

/** The geometry with its quantized attributes widened to floats, so it can take a transform without clamping. */
function unpacked(geometry: THREE.BufferGeometry) {
  const g = new THREE.BufferGeometry().setIndex(geometry.index);
  for (const [key, a] of Object.entries(geometry.attributes)) {
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
    g.setAttribute(key, new THREE.BufferAttribute(out, a.itemSize));
  }
  return g;
}

/** A mesh's part name: its own, or its nearest named parent's (the compressor hangs meshes under unnamed nodes). */
function partName(o: THREE.Object3D) {
  let n: THREE.Object3D | null = o;
  while (n && !n.name) n = n.parent;
  return (n?.name ?? "").replace(/[._]\d+$/, "");
}

const parts = new WeakMap<GLTF, ModelPart[]>();

function partsOf(gltf: GLTF) {
  let list = parts.get(gltf);
  if (!list) {
    list = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const material = o.material as THREE.Material;
      list!.push({
        name: partName(o),
        geometry: unpacked(o.geometry).applyMatrix4(o.matrixWorld), // the root's mm-to-m scale and each part's placement, baked in
        color: /#[0-9a-f]{6}/i.exec(material.name)?.[0] ?? "#" + (material as THREE.MeshStandardMaterial).color.getHexString(),
      });
    });
    parts.set(gltf, list);
  }
  return list;
}

/** The parts of a sand3d model (suspends while it loads: draw it under a `<Suspense>`). */
export function useModel(name: ModelName) {
  return partsOf(useLoader(GLTFLoader, url(name), withMeshopt));
}

/** Starts fetching the models as soon as the world's code loads, so they're there by the time the scene draws. */
export function preloadModels() {
  for (const name of ["table", "chair"] as const) useLoader.preload(GLTFLoader, url(name), withMeshopt);
}

/** A sand3d model drawn as it is, every part in its toon colour. */
export function Model({ name }: { name: ModelName }) {
  return useModel(name).map((p, i) => <mesh key={i} geometry={p.geometry} material={toon(p.color)} castShadow receiveShadow />);
}
