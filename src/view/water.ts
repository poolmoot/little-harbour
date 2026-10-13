import * as THREE from 'three';
import { SEA_Y, WAVE_GLSL, waveAt } from './waves';
import { blob } from './textures';
import type { SkyState } from './scene';

const VERT = `
${WAVE_GLSL}
uniform float uTime;
varying vec3 vWorld; varying vec3 vNrm; varying float vH;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float h; vec2 g; vec2 o;
  waves(wp.xz, uTime, h, g, o);
  wp.xz += o; wp.y += h;
  vWorld = wp.xyz; vH = h;
  vNrm = normalize(vec3(-g.x, 1.0, -g.y));
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = `
precision highp float;
uniform float uTime, uFogNear, uFogFar, uSun, uNight, uLantern;
uniform vec3 uShallow, uMid, uDeep, uFoam, uFog, uSunCol, uSkyCol, uSunDir;
uniform vec4 uBoat[2];
uniform vec4 uRip[3];
uniform vec2 uLamp[6];
varying vec3 vWorld; varying vec3 vNrm; varying float vH;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float sdBox(vec2 p, vec2 c, vec2 hb) { vec2 q = abs(p - c) - hb; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
// Distance to the nearest land: quay, side shores, pier.
float shore(vec2 p) {
  float d = sdBox(p, vec2(0.0, 10.0), vec2(22.0, 10.0));
  d = min(d, sdBox(p, vec2(56.0, 41.0), vec2(34.0, 49.0)));
  d = min(d, sdBox(p, vec2(-56.0, 41.0), vec2(34.0, 49.0)));
  d = min(d, sdBox(p, vec2(0.0, -9.0), vec2(2.05, 9.0)));
  return d;
}
float caustic(vec2 p, float t) {
  vec2 q = p * 0.75;
  float a = sin(q.x * 3.0 + sin(q.y * 2.3 + t * 0.8) * 1.5 + t * 0.6);
  float b = sin(q.y * 3.3 + sin(q.x * 2.1 - t * 0.7) * 1.5 - t * 0.5);
  return pow(clamp(1.0 - abs(a * b) * 1.6, 0.0, 1.0), 5.0);
}

void main() {
  vec2 p = vWorld.xz;
  float t = uTime;
  vec3 V = normalize(cameraPosition - vWorld);
  // Fine ripples on top of the big waves.
  vec2 q1 = p * 0.9 + vec2(t * 0.08, t * 0.05), q2 = p * 1.9 - vec2(t * 0.07, -t * 0.1);
  vec2 dn = vec2(noise(q1 + 13.0) - noise(q1 - 7.0), noise(q2 + 3.0) - noise(q2 - 11.0));
  vec3 N = normalize(vNrm + vec3(dn.x, 0.0, dn.y) * 0.5);

  float d = shore(p);
  vec3 col = mix(uShallow, uMid, smoothstep(0.5, 6.0, d));
  col = mix(col, uDeep, smoothstep(4.0, 34.0, d));
  col *= 1.0 + vH * 1.6;                                   // crests lighter, troughs deeper
  col *= 0.92 + 0.12 * (N.y - 0.9) * 8.0 * 0.25 + 0.04;
  float light = clamp(uSun / 2.4, 0.0, 1.0);
  col += uShallow * caustic(p, t) * 0.2 * (1.0 - smoothstep(0.0, 6.0, d)) * (0.35 + 0.65 * light);

  // Sky colour on grazing angles.
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.5);
  col = mix(col, uSkyCol, fr * 0.6);

  // Sun/moon glints: broad highlight plus little sparkles.
  vec3 R = reflect(-uSunDir, N);
  float spec = pow(max(dot(R, V), 0.0), 70.0);
  float sp = noise(p * 5.5 + vec2(t * 0.9, -t * 0.6)) * noise(p * 9.0 - vec2(t * 0.5, t * 0.8));
  float spark = smoothstep(0.34, 0.48, sp) * smoothstep(-0.05, 0.12, vH + 0.06);
  float sparkAmt = clamp(uSun / 1.6, 0.25, 1.3);
  col += uSunCol * (spec * 1.6 + spark * 0.55) * sparkAmt;

  // Foam: shore + wave crests + hulls + ripples.
  float nz = noise(p * 1.7 + vec2(t * 0.12, 0.0));
  float nz2 = noise(p * 4.5 - vec2(0.0, t * 0.2));
  float foam = 0.0;
  float wob = 0.1 * sin(t * 1.3 + p.x * 0.8 + nz * 6.0);
  foam = max(foam, 1.0 - smoothstep(0.1, 0.55 + 0.4 * nz, d + wob));
  float ring = 0.9 + 0.3 * sin(t * 0.8 + p.x * 0.35 + nz * 3.0);
  foam = max(foam, (1.0 - smoothstep(0.0, 0.14, abs(d - ring))) * smoothstep(0.35, 0.6, nz2) * 0.8 * (1.0 - smoothstep(1.2, 2.0, d)));
  float crest = smoothstep(0.15, 0.23, vH + (nz2 - 0.5) * 0.09) * (0.55 + 0.45 * smoothstep(0.3, 0.7, nz));
  foam = max(foam, crest * 0.8);
  for (int i = 0; i < 2; i++) {
    vec4 b = uBoat[i];
    if (b.w > 0.0) {
      vec2 r = p - b.xy; float c = cos(b.z), s = sin(b.z);
      vec2 l = vec2(r.x * c - r.y * s, r.x * s + r.y * c);
      float e = length(vec2(l.x / (0.82 * b.w), (l.y + 0.2) / (2.05 * b.w)));
      foam = max(foam, (1.0 - smoothstep(1.0, 1.0 + 0.32 + 0.2 * nz2, e)) * smoothstep(0.6, 0.98, e) * 0.95);
    }
  }
  for (int i = 0; i < 3; i++) {
    vec4 rp = uRip[i];
    if (rp.w > 0.0) {
      float dd = length(p - rp.xy);
      float w = 0.07 + rp.z * 0.05;
      foam = max(foam, (1.0 - smoothstep(0.0, w, abs(dd - rp.z))) * rp.w);
    }
  }
  float fm = smoothstep(0.35, 0.6, foam * (0.7 + 0.5 * nz2));    // chunky painterly edge
  col = mix(col, uFoam, fm * 0.92);
  col = mix(col, uShallow * 1.4, (1.0 - fm) * foam * 0.25);

  // Lantern light pools on the water.
  float lamp = 0.0;
  for (int i = 0; i < 6; i++) {
    vec2 dl = p - uLamp[i];
    lamp += exp(-dot(dl * vec2(0.55, 0.38), dl * vec2(0.55, 0.38))) * (0.6 + 0.8 * noise(p * 3.0 + vec2(t * 0.8, t * 0.5)));
  }
  col += vec3(1.0, 0.7, 0.32) * lamp * uLantern * 0.55;

  float fog = smoothstep(uFogNear, uFogFar, length(cameraPosition - vWorld));
  col = mix(col, uFog, fog);
  gl_FragColor = vec4(col, 1.0);
}`;

/** Ocean grid, denser near the middle of the harbour. */
function seaGeometry(): THREE.BufferGeometry {
  const n = 220;
  const R = 260;
  const cx = 0, cz = -50;
  const pos = new Float32Array((n + 1) * (n + 1) * 3);
  const idx: number[] = [];
  const map = (u: number) => R * (0.3 * u + 0.7 * u * u * u);
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const k = (j * (n + 1) + i) * 3;
      pos[k] = cx + map((i / n) * 2 - 1);
      pos[k + 1] = 0;
      pos[k + 2] = cz + map((j / n) * 2 - 1);
    }
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, SEA_Y, cz), R * 1.5);
  return g;
}

export interface BoatFoam { x: number; z: number; heading: number; scale: number }
export interface Ripple { x: number; z: number; radius: number; amp: number }

const LAMPS: [number, number][] = [[-1.85, -4], [1.85, -10.5], [-1.85, -16], [1.85, -4], [-1.85, -10.5], [1.85, -16]];

export class Water {
  readonly mesh: THREE.Mesh;
  private u: Record<string, THREE.IUniform>;

  constructor(scene: THREE.Scene) {
    this.u = {
      uTime: { value: 0 },
      uFogNear: { value: 40 }, uFogFar: { value: 150 },
      uSun: { value: 1 }, uNight: { value: 0 }, uLantern: { value: 0 },
      uShallow: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() },
      uFoam: { value: new THREE.Color() }, uFog: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() },
      uSkyCol: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uBoat: { value: [new THREE.Vector4(), new THREE.Vector4()] },
      uRip: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
      uLamp: { value: LAMPS.map(([x, z]) => new THREE.Vector2(x, z)) },
    };
    const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.u });
    this.mesh = new THREE.Mesh(seaGeometry(), m);
    this.mesh.position.y = SEA_Y;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    scene.add(this.mesh);
  }

  update(t: number, sky: SkyState, fogNear: number, fogFar: number, boats: BoatFoam[], ripples: Ripple[]): void {
    const u = this.u;
    u.uTime.value = t;
    u.uFogNear.value = fogNear; u.uFogFar.value = fogFar;
    (u.uShallow.value as THREE.Color).copy(sky.shallow);
    (u.uMid.value as THREE.Color).copy(sky.mid);
    (u.uDeep.value as THREE.Color).copy(sky.deep);
    (u.uFoam.value as THREE.Color).copy(sky.foam);
    (u.uFog.value as THREE.Color).copy(sky.sky);
    (u.uSunCol.value as THREE.Color).copy(sky.sunColor);
    (u.uSkyCol.value as THREE.Color).copy(sky.sky);
    (u.uSunDir.value as THREE.Vector3).copy(sky.sunDir);
    u.uSun.value = sky.sunI;
    u.uNight.value = sky.night;
    u.uLantern.value = sky.lantern;
    const bv = u.uBoat.value as THREE.Vector4[];
    for (let i = 0; i < 2; i++) {
      const b = boats[i];
      if (b) bv[i].set(b.x, b.z, b.heading, b.scale);
      else bv[i].set(0, 0, 0, 0);
    }
    const rv = u.uRip.value as THREE.Vector4[];
    for (let i = 0; i < 3; i++) {
      const r = ripples[i];
      if (r) rv[i].set(r.x, r.z, r.radius, r.amp);
      else rv[i].set(0, 0, 0, 0);
    }
  }
}

/** Foam puffs trailing behind moving boats. */
export class Wake {
  private mesh: THREE.InstancedMesh;
  private N = 120;
  private pos = new Float32Array(this.N * 3);
  private age = new Float32Array(this.N).fill(99);
  private life = new Float32Array(this.N).fill(1);
  private size = new Float32Array(this.N);
  private rot = new Float32Array(this.N);
  private cursor = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private c = new THREE.Color();
  private ws = { h: 0, sx: 0, sz: 0 };

  constructor(scene: THREE.Scene) {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: blob(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.mesh = new THREE.InstancedMesh(g, mat, this.N);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.N * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
  }

  emit(x: number, z: number, size: number, life: number): void {
    const i = this.cursor++ % this.N;
    this.pos[i * 3] = x; this.pos[i * 3 + 2] = z;
    this.age[i] = 0; this.life[i] = life; this.size[i] = size; this.rot[i] = Math.random() * 6.28;
  }

  update(dt: number, t: number, tint: THREE.Color): void {
    for (let i = 0; i < this.N; i++) {
      this.age[i] += dt;
      const a = this.age[i] / this.life[i];
      if (a >= 1) {
        this.s.set(0, 0, 0);
        this.m.compose(this.p.set(0, -50, 0), this.q.identity(), this.s);
        this.mesh.setMatrixAt(i, this.m);
        continue;
      }
      const x = this.pos[i * 3], z = this.pos[i * 3 + 2];
      waveAt(x, z, t, this.ws);
      const sz = this.size[i] * (1 + a * 1.8);
      this.e.set(0, this.rot[i], 0);
      this.q.setFromEuler(this.e);
      this.m.compose(this.p.set(x, SEA_Y + this.ws.h + 0.04, z), this.q, this.s.set(sz, 1, sz));
      this.mesh.setMatrixAt(i, this.m);
      const k = Math.pow(1 - a, 1.6) * 0.5;
      this.mesh.setColorAt(i, this.c.copy(tint).multiplyScalar(k));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
