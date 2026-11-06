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
import { daylight, focus, sun } from "./daylight";
import { measureFrame, quality } from "./quality";
import { NOISE_GLSL } from "./toon";
import { tuning } from "./tuning";

// The "shader pack" look, after cozy Minecraft shaders: soft ambient occlusion where things meet (contact shadows under
// the chairs, in the grass, along the banks), haze and light shafts in the air, soft ink outlines round shapes (like an
// illustration), a gentle bloom on
// anything bright (lanterns, the sun, sparkles), then a
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
      vec3 cool = mix(vec3(0.86, 0.86, 1.03), vec3(0.78, 0.62, 1.08), uEvening); // only a hint of violet by day, so cream stays cream
      vec3 warm = mix(vec3(1.06, 1.0, 0.88), vec3(1.12, 0.92, 0.80), uEvening);
      c *= mix(cool, vec3(1.0), smoothstep(0.0, 0.45, l) * 0.75 + 0.25);
      c *= mix(vec3(1.0), warm, smoothstep(0.45, 1.0, l) * 0.6);
      // a little more colour, and a soft S-curve for depth
      float l2 = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l2), c, 1.12);
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.35);
      // vignette: the edges fall off very gently (the backdrop should stay a clean cream)
      vec2 d = vUv - 0.5;
      c = mix(c * vec3(0.92, 0.89, 0.9), c, 1.0 - smoothstep(0.25, 0.75, dot(d, d) * 1.8));
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

/**
 * Soft outlines, like ink round the shapes in an illustration: drawn where the depth jumps (an object against what's
 * behind it) and, up close, where the surface turns sharply. It reads the depth and normals the AO pass has already
 * rendered, so it costs no extra pass over the scene. The ink is a darker shade of whatever it outlines, not black.
 */
const OutlineShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    tNormal: { value: null },
    uTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
    uNear: { value: 0.05 },
    uFar: { value: 900 },
    uStrength: { value: 0.55 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tDiffuse, tDepth, tNormal;
    uniform vec2 uTexel;
    uniform float uNear, uFar, uStrength;
    varying vec2 vUv;
    float dist(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      float z = dist(vUv);
      vec3 n = texture2D(tNormal, vUv).rgb * 2.0 - 1.0;
      float jump = 0.0, turn = 0.0, sky = 0.0;
      for (int i = 0; i < 4; i++) {
        vec2 o = (i < 2 ? vec2(float(i * 2 - 1), 0.0) : vec2(0.0, float(i * 2 - 5))) * uTexel;
        // only the nearer side of a jump gets the line, so it hugs the object rather than what's behind
        jump = max(jump, (dist(vUv + o) - z) / z);
        sky = max(sky, step(0.99999, texture2D(tDepth, vUv + o).x));
        turn = max(turn, 1.0 - dot(n, texture2D(tNormal, vUv + o).rgb * 2.0 - 1.0));
      }
      // against the plain backdrop a line is hardly needed (and at the AO's half resolution it would look jagged)
      float edge = smoothstep(0.05, 0.16, jump) * (1.0 - sky * 0.75);
      edge = max(edge, smoothstep(0.55, 0.95, turn) * smoothstep(14.0, 5.0, z) * 0.6);
      edge *= smoothstep(120.0, 50.0, z); // the far-off islands and clouds stay soft
      vec3 ink = base.rgb * vec3(0.52, 0.47, 0.5);
      gl_FragColor = vec4(mix(base.rgb, ink, edge * uStrength), base.a);
    }`,
};

/**
 * The air between you and things, as in the painterly games this scene takes after: far things sink into a soft
 * haze (more of it low down, less up high), which turns warm and golden in the direction of the sun, and the sun's
 * light streams in shafts past trees, buildings and Pip wherever the sky shows between them. Both read the depth the
 * AO pass has already rendered; the shafts march from each pixel towards the sun, gathering open sky as they go.
 */
const AtmosphereShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uNear: { value: 0.05 },
    uFar: { value: 900 },
    uInvProj: { value: new THREE.Matrix4() },
    uCamWorld: { value: new THREE.Matrix4() },
    uCamPos: { value: new THREE.Vector3() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunUv: { value: new THREE.Vector2(0.5, 1.2) },
    uHaze: { value: new THREE.Color("#e9dcc8") },
    uSunColor: { value: new THREE.Color("#ffd9a6") },
    uDensity: { value: 0.03 },
    uClouds: { value: 1 },
    uStart: { value: 6 },
    uTime: { value: 0 },
    uRays: { value: 0.3 },
    uFacing: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    #include <packing>
    ${NOISE_GLSL}
    uniform sampler2D tDiffuse, tDepth;
    uniform float uNear, uFar, uDensity, uRays, uFacing, uTime, uStart, uClouds;
    uniform mat4 uInvProj, uCamWorld;
    uniform vec3 uCamPos, uSunDir, uHaze, uSunColor;
    uniform vec2 uSunUv;
    varying vec2 vUv;
    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      float d = texture2D(tDepth, vUv).x;
      float sky = step(0.99999, d);
      vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
      vec3 dir = normalize(mat3(uCamWorld) * (v.xyz / v.w));
      float toSun = max(dot(dir, uSunDir), 0.0);
      // haze: by distance beyond what you're looking at (none up close), thicker low down, golden towards the sun
      float dist = -perspectiveDepthToViewZ(d, uNear, uFar);
      float y = uCamPos.y + dir.y * dist;
      float haze = (1.0 - sky) * (1.0 - exp(-max(dist - uStart, 0.0) * uDensity)) * mix(1.0, 0.4, smoothstep(0.0, 8.0, y));
      vec3 air = mix(uHaze, uSunColor, pow(toSun, 5.0) * 0.75);
      // the shadows of clouds drifting over the island, soft-edged, slowly sliding with the breeze
      vec3 at = uCamPos + dir * dist;
      float cloud = smoothstep(0.52, 0.78, pnNoise(at.xz * 0.07 + vec2(uTime * 0.018, uTime * 0.011)) * 0.7 + pnNoise(at.xz * 0.19 - uTime * 0.01) * 0.3);
      vec3 c = base.rgb * (1.0 - cloud * 0.16 * uClouds * (1.0 - sky) * step(at.y, 3.5) * (1.0 - haze));
      c = mix(c, air, haze * 0.6);
      // light shafts: open sky gathered on the way towards the sun, fading with each step
      vec2 step2 = (uSunUv - vUv) / 28.0 * 0.85;
      vec2 uv = vUv;
      float light = 0.0, fall = 1.0;
      for (int i = 0; i < 28; i++) {
        uv += step2;
        light += step(0.99999, texture2D(tDepth, clamp(uv, 0.001, 0.999)).x) * fall;
        fall *= 0.95;
      }
      light /= 12.0;
      float shafts = light * (1.0 - sky * 0.7) * uRays * uFacing * (0.35 + 0.65 * pow(toSun, 2.0));
      c += uSunColor * shafts;
      gl_FragColor = vec4(c, base.a);
    }`,
};

/** See-through things (sky, clouds, the waterfall, blush) shouldn't cast ambient occlusion. */
const seeThrough = (o: THREE.Object3D) => {
  if (o instanceof THREE.Sprite) return true;
  // nor does the grass (only on layer 1): thousands of thin blades just turn into dark speckle and outline noise
  if ((o.layers.mask & 1) === 0) return true;
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
  air: ShaderPass;
  outline: ShaderPass;
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
  const air = new ShaderPass(AtmosphereShader);
  air.uniforms.tDepth.value = ao.depthTexture;
  composer.addPass(air);
  const outline = new ShaderPass(OutlineShader);
  outline.uniforms.tDepth.value = ao.depthTexture;
  outline.uniforms.tNormal.value = ao.normalTexture;
  if (camera instanceof THREE.PerspectiveCamera) {
    outline.uniforms.uNear.value = air.uniforms.uNear.value = camera.near;
    outline.uniforms.uFar.value = air.uniforms.uFar.value = camera.far;
  }
  composer.addPass(outline);
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.3, 0.4, 1.0); // only true highlights (lanterns, the sun) glow
  composer.addPass(bloom);
  composer.addPass(new OutputPass()); // tone mapping and sRGB, so the grade works on the final colours
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  return { composer, ao, air, outline, bloom, grade };
}

const HAZE = { day: new THREE.Color("#e9dcc8"), dusk: new THREE.Color("#e8b9b0") };
const SUNLIGHT = { day: new THREE.Color("#ffdcaa"), dusk: new THREE.Color("#ffa877") };
const sunDir = new THREE.Vector3(), sunUv = new THREE.Vector3(), forward = new THREE.Vector3();

/** Points the atmosphere at the sun for this frame: where it is on screen, whether you're facing it, and the colours. */
function aim(air: ShaderPass, camera: THREE.Camera, evening: number) {
  const u = air.uniforms;
  sunDir.copy(sun).normalize();
  u.uSunDir.value.copy(sunDir);
  u.uInvProj.value.copy(camera.projectionMatrixInverse);
  u.uCamWorld.value.copy(camera.matrixWorld);
  u.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
  sunUv.copy(u.uCamPos.value).addScaledVector(sunDir, 500).project(camera);
  u.uSunUv.value.set(sunUv.x * 0.5 + 0.5, sunUv.y * 0.5 + 0.5);
  camera.getWorldDirection(forward);
  u.uFacing.value = THREE.MathUtils.smoothstep(forward.dot(sunDir), -0.1, 0.5); // shafts only while you look sunwards
  u.uHaze.value.copy(HAZE.day).lerp(HAZE.dusk, evening);
  u.uSunColor.value.copy(SUNLIGHT.day).lerp(SUNLIGHT.dusk, evening);
  u.uRays.value = (0.22 + evening * 0.3) * tuning.shafts; // stronger as the sun goes down
  u.uDensity.value = 0.03 * tuning.haze;
  u.uClouds.value = tuning.clouds;
  u.uTime.value = performance.now() / 1000;
  u.uStart.value = focus.distance + 2; // clear up to just past what you're looking at
}

/** The exposure dial (tuning.ts), on the renderer's tone mapping. */
function expose(gl: THREE.WebGLRenderer) {
  gl.toneMappingExposure = tuning.exposure;
}

/** Takes over rendering with the post-processing chain. Render it inside the Canvas. */
export function Effects() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
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
    c.composer.setPixelRatio(dpr);
    c.composer.setSize(size.width, size.height); // sizes every pass too
    c.ao.setSize((size.width * dpr) / 2, (size.height * dpr) / 2); // AO at half resolution: soft anyway, and much cheaper
    c.outline.uniforms.uTexel.value.set(2 / (size.width * dpr), 2 / (size.height * dpr)); // one texel of the AO's buffers
  }, [gl, size, dpr, scene, camera]);

  // priority 1: R3F stops rendering on its own and leaves it to us
  const setDpr = useThree((s) => s.setDpr);
  useFrame((_, dt) => {
    measureFrame(dt); // auto quality: steps down if the first seconds run slowly (see quality.ts)
    expose(gl);
    const c = chain.current, level = quality.level;
    if (level === 0 && gl.getPixelRatio() > 1) setDpr(1);
    else if (level > 0) {
      // left lite: back to the Canvas's range (1 to 1.5), for the screen as it is now (zoom or a new display may differ)
      const full = Math.min(1.5, Math.max(1, window.devicePixelRatio));
      if (gl.getPixelRatio() < full) setDpr(full);
    }
    // lite: no post-processing at all (the renderer still tone-maps and converts colour on its own)
    if (!c || level === 0) return gl.render(scene, camera);
    c.outline.enabled = level >= 2;
    aim(c.air, camera, daylight.evening);
    c.grade.uniforms.uEvening.value = daylight.evening;
    c.bloom.strength = (0.3 + daylight.evening * 0.25) * tuning.bloom; // lanterns and fireflies glow more at dusk
    c.composer.render(dt);
  }, 1);
  return null;
}
