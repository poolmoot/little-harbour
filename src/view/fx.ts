import * as THREE from 'three';
import { glow } from './textures';

/** Shared wind clock used by grass/foliage/flower shaders. */
export const windU = { value: 0 };

/** Inject a wind sway into a standard material. `strength` scales the bend; position.y is the height factor. */
export function addWind(material: THREE.MeshStandardMaterial, key: string, strength: number, heightScale = 1): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = windU;
    shader.vertexShader = 'uniform float uWind;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       #ifdef USE_INSTANCING
         float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.9;
       #else
         float ph = 0.0;
       #endif
       float hh = max(position.y, 0.0) * ${heightScale.toFixed(3)};
       float sw = sin(uWind * 1.7 + ph) * 0.6 + sin(uWind * 3.1 + ph * 1.7) * 0.25 + sin(uWind * 0.6 + ph * 0.3) * 0.5;
       transformed.x += sw * ${strength.toFixed(3)} * hh * hh;
       transformed.z += cos(uWind * 1.3 + ph * 1.3) * ${(strength * 0.6).toFixed(3)} * hh * hh;`,
    );
  };
  material.customProgramCacheKey = () => 'wind-' + key;
}

const SMOKE_V = `
attribute float aSeed; uniform float uTime, uScale; uniform vec3 uBase; uniform vec2 uWind; varying float vA;
void main(){
  float age = fract(uTime * 0.11 + aSeed);
  vec3 p = uBase + vec3(uWind.x * age * age * 5.0 + sin(age * 7.0 + aSeed * 30.0) * 0.18, age * 3.8, uWind.y * age * age * 5.0);
  vA = smoothstep(0.0, 0.08, age) * pow(1.0 - age, 1.4) * 0.5;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (0.7 + age * 2.4) * uScale / -mv.z;
}`;
const SMOKE_F = `
varying float vA; uniform vec3 uCol;
void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vA; if (a < 0.003) discard; gl_FragColor = vec4(uCol, a); }`;

export class Smoke {
  readonly points: THREE.Points;
  private u: Record<string, THREE.IUniform>;
  constructor(scene: THREE.Object3D, base: THREE.Vector3, count = 26) {
    const g = new THREE.BufferGeometry();
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) seed[i] = i / count;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.u = { uTime: { value: 0 }, uScale: { value: 600 }, uBase: { value: base.clone() }, uWind: { value: new THREE.Vector2(0.7, -0.2) }, uCol: { value: new THREE.Color(0xdddddd) } };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: SMOKE_V, fragmentShader: SMOKE_F, uniforms: this.u, transparent: true, depthWrite: false }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  update(t: number, scale: number, light: number): void {
    this.u.uTime.value = t;
    this.u.uScale.value = scale;
    (this.u.uCol.value as THREE.Color).setRGB(0.25 + 0.7 * light, 0.26 + 0.68 * light, 0.32 + 0.6 * light);
  }
}

const FF_V = `
attribute float aSeed; attribute vec3 aCenter; uniform float uTime, uScale, uNight; varying float vA;
void main(){
  float s = aSeed * 40.0;
  vec3 p = aCenter + vec3(sin(uTime * 0.6 + s) * 1.3 + sin(uTime * 1.7 + s * 2.0) * 0.3, 0.7 + sin(uTime * 0.5 + s * 1.3) * 0.45, cos(uTime * 0.55 + s * 0.7) * 1.3);
  float b = 0.5 + 0.5 * sin(uTime * 2.6 + s * 3.0);
  vA = uNight * b * b;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = 0.22 * uScale / -mv.z;
}`;
const FF_F = `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vec3(1.0, 0.95, 0.4) * 2.5, a); }`;

export class Fireflies {
  private u: Record<string, THREE.IUniform>;
  constructor(scene: THREE.Object3D, centers: [number, number, number][], perCenter = 5) {
    const n = centers.length * perCenter;
    const c = new Float32Array(n * 3), s = new Float32Array(n);
    centers.forEach((p, ci) => {
      for (let i = 0; i < perCenter; i++) {
        const k = ci * perCenter + i;
        c.set(p, k * 3);
        s[k] = Math.random();
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aCenter', new THREE.BufferAttribute(c, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
    this.u = { uTime: { value: 0 }, uScale: { value: 600 }, uNight: { value: 0 } };
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: FF_V, fragmentShader: FF_F, uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false;
    scene.add(pts);
  }
  update(t: number, scale: number, night: number): void {
    this.u.uTime.value = t;
    this.u.uScale.value = scale;
    this.u.uNight.value = night;
  }
}

/** Additive halo around a lantern/window. */
export function haloSprite(color: number, size: number): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
  s.scale.setScalar(size);
  return s;
}
