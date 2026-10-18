"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { daylight } from "./daylight";

// The "shader pack" look, after cozy Minecraft shaders: soft ambient occlusion where things meet (contact shadows under
// the chairs, in the grass, along the banks), a gentle bloom on anything bright (lanterns, the sun, sparkles), then a
// colour grade in the final image: split toning (cool violet shadows, warm golden highlights, so light and shade always
// harmonise), a soft S-curve, a touch more saturation, and a vignette.

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uEvening: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uEvening; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      // split toning: shadows lean violet-blue, highlights lean gold (rosier at sunset)
      vec3 cool = mix(vec3(0.70, 0.74, 1.12), vec3(0.78, 0.62, 1.08), uEvening);
      vec3 warm = mix(vec3(1.06, 1.0, 0.88), vec3(1.12, 0.92, 0.80), uEvening);
      c *= mix(cool, vec3(1.0), smoothstep(0.0, 0.45, l) * 0.75 + 0.25);
      c *= mix(vec3(1.0), warm, smoothstep(0.45, 1.0, l) * 0.6);
      // a little more colour, and a soft S-curve for depth
      float l2 = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l2), c, 1.12);
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.35);
      // vignette: the edges fall off gently towards a warm dark
      vec2 d = vUv - 0.5;
      c = mix(c * vec3(0.78, 0.72, 0.8), c, 1.0 - smoothstep(0.25, 0.75, dot(d, d) * 1.8));
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

/** See-through things (sky, clouds, the waterfall, blush) shouldn't cast ambient occlusion. */
const seeThrough = (o: THREE.Object3D) => {
  if (o instanceof THREE.Sprite) return true;
  const m = (o as THREE.Mesh).material as THREE.Material | undefined;
  return !!m && !Array.isArray(m) && (m.transparent || !m.depthWrite);
};

/** GTAO over solid geometry only: see-through objects are hidden while it renders its depth and normals. */
class SolidAOPass extends GTAOPass {
  override render(...args: Parameters<GTAOPass["render"]>) {
    const hidden: THREE.Object3D[] = [];
    this.scene.traverseVisible((o) => {
      if (seeThrough(o)) hidden.push(o);
    });
    hidden.forEach((o) => (o.visible = false));
    super.render(...args);
    hidden.forEach((o) => (o.visible = true));
  }
}

interface Chain {
  composer: EffectComposer;
  ao: GTAOPass;
  bloom: UnrealBloomPass;
  grade: ShaderPass;
}

function buildChain(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): Chain {
  const composer = new EffectComposer(gl);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new SolidAOPass(scene, camera, 512, 512);
  ao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12 });
  ao.blendIntensity = 0.85;
  composer.addPass(ao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.3, 0.4, 1.0); // only true highlights (lanterns, the sun) glow
  composer.addPass(bloom);
  composer.addPass(new OutputPass()); // tone mapping and sRGB, so the grade works on the final colours
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  return { composer, ao, bloom, grade };
}

/** Takes over rendering with the post-processing chain. Render it inside the Canvas. */
export function Effects() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const chain = useRef<Chain | null>(null);

  useEffect(() => {
    const built = buildChain(gl, scene, camera);
    chain.current = built;
    return () => {
      built.composer.dispose();
      chain.current = null;
    };
  }, [gl, scene, camera]);

  useEffect(() => {
    const c = chain.current;
    if (!c) return;
    const dpr = gl.getPixelRatio();
    c.composer.setPixelRatio(dpr);
    c.composer.setSize(size.width, size.height); // sizes every pass too
    c.ao.setSize((size.width * dpr) / 2, (size.height * dpr) / 2); // AO at half resolution: soft anyway, and much cheaper
  }, [gl, size, scene, camera]);

  // priority 1: R3F stops rendering on its own and leaves it to us
  useFrame((_, dt) => {
    const c = chain.current;
    if (!c) return gl.render(scene, camera);
    c.grade.uniforms.uEvening.value = daylight.evening;
    c.bloom.strength = 0.3 + daylight.evening * 0.25; // lanterns and fireflies glow more at dusk
    c.composer.render(dt);
  }, 1);
  return null;
}
