import * as THREE from 'three';
import { SEA_Y, WAVE_GLSL, waveAt } from './waves';
import { blob } from './textures';
import type { SkyState } from './scene';
import { LAYOUT } from '../sim/config';

/** Half-width of the quay as a GLSL number, so the shoreline foam follows the real quay edge. */
const QUAY_SIDE = LAYOUT.quayMaxX.toFixed(1);

/** Lantern positions along the pier (x, z); each casts a light pool on the water. */
const LAMPS: [number, number][] = [[-1.85, -4], [1.85, -10.5], [-1.85, -16], [1.85, -4], [-1.85, -10.5], [1.85, -16]];
/** How many boats get hull foam and how many ripple rings are drawn (the shader's array sizes). */
const MAX_BOATS = 4;
const MAX_RIPPLES = 3;

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
uniform vec4 uBoat[${MAX_BOATS}];
uniform vec4 uRip[${MAX_RIPPLES}];
uniform vec2 uLamp[${LAMPS.length}];
varying vec3 vWorld; varying vec3 vNrm; varying float vH;

// Depth bands: distance from land (m) where each colour step starts, and how soft the step is.
const vec4 BAND_AT = vec4(1.7, 4.2, 8.5, 16.0);
const float BAND_SOFT = 0.07;
// Foam lines: a solid line hugging an edge, then thin rings that drift outwards and fade.
const float FOAM_EDGE = 0.17;        // width of the solid line (m)
const float FOAM_RING_GAP = 0.62;    // distance between drifting rings (m)
const float FOAM_RING_SPEED = 0.2;   // how fast the rings drift out (m/s)
const float QUAY_FOAM_OUT = 0.5;     // the quay wall hides about this much water, so its foam starts here
const float QUAY_FOAM_REACH = 1.5;   // rings fade out this far from the quay (m)
const float SMALL_FOAM_REACH = 0.55;  // ... and this far from posts and hulls
const float NIGHT_FOAM = 0.4;        // how much of the foam's own brightness is left at night
// Wave-top highlight lines: drawn where the wave height crosses this level.
const float CREST_H = 0.13;
const float CREST_W = 0.008;
// Lantern pools: warm patches lying on the water just outside the pier, stretched towards the camera like a reflection.
const vec3 LANTERN_COL = vec3(1.0, 0.45, 0.1);
const float SHALLOW_RICH = 1.35;      // extra colour strength for the shallows, which tone mapping would otherwise wash out
const vec2 LANTERN_SHIFT = vec2(0.9, 0.7);    // pool centre, measured out from the lamp (m)
const vec2 LANTERN_SIZE = vec2(1.05, 1.55);   // pool radius across and along the pier (m)

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float sdBox(vec2 p, vec2 c, vec2 hb) { vec2 q = abs(p - c) - hb; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
// Distance to the solid land: quay and side shores.
float landDist(vec2 p) {
  float d = sdBox(p, vec2(0.0, 10.0), vec2(${QUAY_SIDE}, 10.0));
  d = min(d, sdBox(p, vec2(${QUAY_SIDE} + 34.0, 41.0), vec2(34.0, 49.0)));
  return min(d, sdBox(p, vec2(-${QUAY_SIDE} - 34.0, 41.0), vec2(34.0, 49.0)));
}
// Distance to the nearest post along the pier edges (the pier stands on posts; water runs under it).
float postDist(vec2 p) {
  if (p.y > -0.4 || p.y < -17.0) return 9.0;
  return length(vec2(abs(p.x) - 1.95, mod(-p.y + 0.5, 3.0) - 1.5)) - 0.2;
}
// Distance in metres to a boat's waterline (b = x, z, heading, scale).
float hullDist(vec2 p, vec4 b) {
  vec2 r = p - b.xy; float c = cos(b.z), s = sin(b.z);
  vec2 l = vec2(r.x * c - r.y * s, r.x * s + r.y * c);
  vec2 ab = vec2(0.82, 2.05) * b.w;                         // half width, half length at the waterline
  vec2 e = vec2(l.x, l.y + 0.2 * b.w) / ab;                 // the hull's middle sits a little ahead of the boat's origin
  float k = length(e);
  return k * (k - 1.0) / max(length(e / ab), 1e-4);         // first-order distance to the ellipse
}
// Web of light on the sea bed, seen through the shallows.
float caustic(vec2 p, float t) {
  vec2 q = p * 0.75;
  float a = sin(q.x * 3.0 + sin(q.y * 2.3 + t * 0.8) * 1.5 + t * 0.6);
  float b = sin(q.y * 3.3 + sin(q.x * 2.1 - t * 0.7) * 1.5 - t * 0.5);
  return smoothstep(0.72, 0.8, 1.0 - abs(a * b) * 1.6);
}
// Cartoon foam around something d metres away: a solid wobbly line at the edge plus broken rings drifting outwards.
float foamLines(float d, float reach, float t, float nz, float nz2) {
  float edge = FOAM_EDGE * (0.75 + 0.5 * nz) + 0.04 * sin(t * 1.2 + nz2 * 6.0);
  float solid = 1.0 - smoothstep(edge - 0.03, edge + 0.03, d);
  float ph = (d - t * FOAM_RING_SPEED) / FOAM_RING_GAP + nz * 0.9;
  float ring = 1.0 - smoothstep(0.1, 0.16, abs(fract(ph) - 0.5));
  float fade = smoothstep(edge, edge + 0.1, d) * (1.0 - smoothstep(reach * 0.35, reach, d));
  return max(solid, ring * fade * smoothstep(0.35, 0.5, nz2 + fade * 0.25));
}
// Four-point star glints, one per grid cell, each twinkling on its own clock. amount 0..1 = share of cells lit.
float glints(vec2 p, float t, float amount) {
  vec2 g = p * 1.5, id = floor(g);
  float r = hash(id);
  vec2 q = abs(fract(g) - 0.5 - (vec2(hash(id + 7.3), hash(id + 3.1)) - 0.5) * 0.5);
  float tw = max(sin(t * (1.6 + r * 2.4) + r * 40.0), 0.0);
  float star = 1.0 - smoothstep(0.0, 0.42 * tw + 0.001, sqrt(q.x) + sqrt(q.y));
  return star * step(fract(r * 17.0), amount);
}

void main() {
  vec2 p = vWorld.xz;
  float t = uTime;
  vec3 V = normalize(cameraPosition - vWorld);
  float camDist = length(cameraPosition - vWorld);
  float nLow = noise(p * 0.3 + vec2(t * 0.04, -t * 0.03));    // slow and wide: wobbles the depth bands
  float nz = noise(p * 1.7 + vec2(t * 0.12, 0.0));            // these two break up foam and crest lines
  float nz2 = noise(p * 4.5 - vec2(0.0, t * 0.2));
  // Fine ripples on top of the big waves.
  vec3 N = normalize(vNrm + vec3(nz - 0.5, 0.0, nz2 - 0.5) * 0.3);
  float light = clamp(uSun / 2.4, 0.0, 1.0);
  float day = 1.0 - uNight;

  // Depth colour in clean steps: bright shallows by the quay and pier, out to deep blue.
  float dLand = landDist(p);
  float d = min(dLand, sdBox(p, vec2(0.0, -9.0), vec2(2.05, 9.0)));
  float dw = d + (nLow - 0.5) * min(0.25 + 0.12 * d, 2.5) + vH * 1.5;   // edges wander a little and breathe with the swell
  vec4 band = smoothstep(BAND_AT * (1.0 - BAND_SOFT), BAND_AT * (1.0 + BAND_SOFT), vec4(dw));
  vec3 shallow = mix(vec3(dot(uShallow, vec3(0.3, 0.6, 0.1))), uShallow, SHALLOW_RICH) * 0.9;
  vec3 col = mix(shallow, uMid, 0.35 * uNight);              // the brightest step is held back at night
  col = mix(col, mix(shallow, uMid, 0.55), band.x);
  col = mix(col, uMid, band.y);
  col = mix(col, mix(uMid, uDeep, 0.55), band.z);
  col = mix(col, uDeep, band.w);
  // Swells in flat tones: lit tops, shaded dips.
  col *= 1.0 + 0.09 * smoothstep(0.05, 0.08, vH) - 0.08 * (1.0 - smoothstep(-0.1, -0.07, vH));
  col += uShallow * caustic(p, t) * 0.16 * (1.0 - band.x) * (0.35 + 0.65 * light);

  // Sky colour on grazing angles.
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.5);
  col = mix(col, uSkyCol, fr * 0.55);

  // Sun/moon: a hard-edged glitter path plus twinkling stars that gather along it.
  float rv = max(dot(reflect(-uSunDir, N), V), 0.0);
  float sunAmt = clamp(uSun / 1.6, 0.25, 1.3);
  float glitter = smoothstep(0.45, 0.55, pow(rv, 60.0));
  float stars = glints(p, t, 0.1 + 0.6 * pow(rv, 10.0)) * (1.0 - smoothstep(45.0, 90.0, camDist));
  col += uSunCol * (glitter * 0.55 + stars * 0.5) * sunAmt * (0.4 + 0.6 * day);

  // Foam colour: by day the sky's foam white; at night a lighter shade of the water itself, so it dims with the light.
  vec3 foamCol = mix(uFoam, col + uFoam * NIGHT_FOAM, uNight);

  // Thin highlight lines riding the wave tops.
  float crest = 1.0 - smoothstep(0.0, CREST_W, abs(vH + (nz - 0.5) * 0.07 - CREST_H));
  crest *= smoothstep(0.5, 0.6, nz2) * (1.0 - smoothstep(50.0, 100.0, camDist));
  col = mix(col, foamCol, crest * 0.6);

  // Foam lines: quay wall, pier posts and hulls, then ripple rings from the fishing float.
  float dSmall = postDist(p);
  for (int i = 0; i < ${MAX_BOATS}; i++) {
    if (uBoat[i].w > 0.0) dSmall = min(dSmall, hullDist(p, uBoat[i]));
  }
  float foam = max(foamLines(dLand - QUAY_FOAM_OUT, QUAY_FOAM_REACH, t, nz, nz2), foamLines(dSmall, SMALL_FOAM_REACH, t, nz, nz2));
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 rp = uRip[i];
    if (rp.w > 0.0) {
      float w = 0.05 + rp.z * 0.04;
      foam = max(foam, (1.0 - smoothstep(w * 0.6, w, abs(length(p - rp.xy) - rp.z))) * rp.w);
    }
  }
  float fm = smoothstep(0.45, 0.55, foam);
  col = mix(col, foamCol, fm * 0.95);

  // Lantern light on the water: a solid warm core, then wavy bars of light breaking up towards the edge.
  float lamp = 0.0;
  for (int i = 0; i < ${LAMPS.length}; i++) {
    vec2 dl = (p - uLamp[i] - vec2(sign(uLamp[i].x), 1.0) * LANTERN_SHIFT) / LANTERN_SIZE;
    lamp = max(lamp, exp(-dot(dl, dl)));
  }
  float bars = smoothstep(0.4, 0.55, abs(fract(p.y * 1.8 + 0.25 * sin(p.x * 3.0 + t * 1.4) - t * 0.25) - 0.5) * 2.0);
  float pool = max(smoothstep(0.7, 0.76, lamp), 0.85 * bars * smoothstep(0.22, 0.3, lamp));
  col = mix(col, LANTERN_COL * 0.45, pool * uLantern * 0.7);

  col = mix(col, uFog, smoothstep(uFogNear, uFogFar, camDist));
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
      uBoat: { value: Array.from({ length: MAX_BOATS }, () => new THREE.Vector4()) },
      uRip: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4()) },
      uLamp: { value: LAMPS.map(([x, z]) => new THREE.Vector2(x, z)) },
    };
    const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.u });
    this.mesh = new THREE.Mesh(seaGeometry(), m);
    this.mesh.position.y = SEA_Y;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2; // after the boats' depth-only hull lids, so no sea is drawn inside a hull
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
    for (let i = 0; i < MAX_BOATS; i++) {
      const b = boats[i];
      if (b) bv[i].set(b.x, b.z, b.heading, b.scale);
      else bv[i].set(0, 0, 0, 0);
    }
    const rv = u.uRip.value as THREE.Vector4[];
    for (let i = 0; i < MAX_RIPPLES; i++) {
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
