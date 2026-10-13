import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { hourOf } from '../sim/time';
import type { QualityPreset, QualityTarget } from './quality';

interface Key {
  h: number;
  zen: number; hor: number;       // sky zenith / horizon (also fog)
  sun: number; sunI: number;      // key light
  hemiSky: number; hemiGnd: number; hemiI: number;
  shallow: number; mid: number; deep: number; // water
  expo: number;
}
const KEYS: Key[] = [
  { h: 0, zen: 0x070d22, hor: 0x1a2a52, sun: 0x9db4ff, sunI: 0.55, hemiSky: 0x4a63a8, hemiGnd: 0x1b2438, hemiI: 0.75, shallow: 0x2a7a96, mid: 0x1a4f7c, deep: 0x0d2552, expo: 1.0 },
  { h: 5.2, zen: 0x0b1530, hor: 0x25365f, sun: 0x9db4ff, sunI: 0.55, hemiSky: 0x4a63a8, hemiGnd: 0x1b2438, hemiI: 0.75, shallow: 0x2a7a96, mid: 0x1a4f7c, deep: 0x0d2552, expo: 1.0 },
  { h: 6.3, zen: 0x6a7fd0, hor: 0xffa57e, sun: 0xffb27a, sunI: 1.9, hemiSky: 0xffd6c4, hemiGnd: 0x7a6e5e, hemiI: 1.05, shallow: 0x62d2c6, mid: 0x44a6c8, deep: 0x2e68a8, expo: 1.05 },
  { h: 8.5, zen: 0x4aa6ee, hor: 0xcdeaf6, sun: 0xfff0d6, sunI: 2.2, hemiSky: 0xbfe0ff, hemiGnd: 0x8c9a5a, hemiI: 1.0, shallow: 0x4fcfc0, mid: 0x1f9ec2, deep: 0x1058a0, expo: 1.0 },
  { h: 13, zen: 0x3a9ae8, hor: 0xbfe6ff, sun: 0xffffff, sunI: 2.3, hemiSky: 0xbfe0ff, hemiGnd: 0x8c9a5a, hemiI: 1.0, shallow: 0x4fd2c2, mid: 0x1c9cc4, deep: 0x0e56a2, expo: 1.0 },
  { h: 17.5, zen: 0x4f8cd8, hor: 0xffd29c, sun: 0xffbf80, sunI: 2.0, hemiSky: 0xffe0b8, hemiGnd: 0x8a8a52, hemiI: 0.95, shallow: 0x4fc8b8, mid: 0x2492b8, deep: 0x185294, expo: 1.0 },
  { h: 19.3, zen: 0x4a4488, hor: 0xff8a72, sun: 0xff9a68, sunI: 1.45, hemiSky: 0xc4a2d0, hemiGnd: 0x6a5e5e, hemiI: 1.1, shallow: 0x4cb0bc, mid: 0x2e72a0, deep: 0x213d7a, expo: 1.05 },
  { h: 21, zen: 0x0b1530, hor: 0x25365f, sun: 0x9db4ff, sunI: 0.55, hemiSky: 0x4a63a8, hemiGnd: 0x1b2438, hemiI: 0.75, shallow: 0x2a7a96, mid: 0x1a4f7c, deep: 0x0d2552, expo: 1.0 },
  { h: 24, zen: 0x070d22, hor: 0x1a2a52, sun: 0x9db4ff, sunI: 0.55, hemiSky: 0x4a63a8, hemiGnd: 0x1b2438, hemiI: 0.75, shallow: 0x2a7a96, mid: 0x1a4f7c, deep: 0x0d2552, expo: 1.0 },
];

const tmpA = new THREE.Color(), tmpB = new THREE.Color();
const mix = (a: number, b: number, t: number, out: THREE.Color) => out.set(a).lerp(tmpB.set(b), t);

export interface SkyState {
  sky: THREE.Color;       // horizon / fog colour
  zenith: THREE.Color;
  shallow: THREE.Color;
  mid: THREE.Color;
  deep: THREE.Color;
  foam: THREE.Color;
  sunColor: THREE.Color;
  sunDir: THREE.Vector3;  // direction towards the key light
  sunI: number;
  lantern: number;        // 0 day .. 1 night lights
  night: number;          // 0 day .. 1 deep night
  light: number;          // 0..1 overall daylight
}

const SKY_V = `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_F = `
varying vec3 vDir;
uniform vec3 uZen, uHor, uSunDir, uSunCol, uMoonDir;
uniform float uNight, uTime, uSunVis;
float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ return noise(p)*0.55 + noise(p*2.1+7.)*0.3 + noise(p*4.3+3.)*0.15; }
void main(){
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = mix(uHor, uZen, pow(clamp(y, 0.0, 1.0), 0.5));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunCol * (smoothstep(0.9993, 0.9997, sd) * 4.0 + pow(sd, 24.0) * 0.45 + pow(sd, 4.0) * 0.12) * uSunVis;
  // Soft stylised clouds.
  if (y > 0.02) {
    vec2 uv = d.xz / (y + 0.25) * 0.9 + vec2(uTime * 0.01, 0.0);
    float c = smoothstep(0.52, 0.8, fbm(uv * 1.3));
    vec3 cc = mix(uHor * 1.15 + 0.1, vec3(1.0), 0.5) * mix(1.0, 0.35, uNight);
    col = mix(col, cc, c * 0.65 * smoothstep(0.02, 0.2, y));
  }
  // Stars and moon.
  if (uNight > 0.01 && y > 0.0) {
    vec2 g = d.xz / (y + 0.4) * 60.0;
    vec2 id = floor(g);
    float h = hash(id);
    float star = step(0.985, h) * smoothstep(0.5, 0.0, length(fract(g) - 0.5));
    star *= 0.6 + 0.4 * sin(uTime * 2.0 + h * 80.0);
    col += vec3(0.9, 0.95, 1.0) * star * uNight * smoothstep(0.05, 0.3, y) * 1.4;
  }
  float md = dot(d, uMoonDir);
  col = mix(col, vec3(1.0, 0.96, 0.85) * 1.7, smoothstep(0.9990, 0.9994, md) * uNight);
  col += vec3(0.5, 0.6, 0.95) * pow(max(md, 0.0), 40.0) * 0.25 * uNight;
  gl_FragColor = vec4(col, 1.0);
}`;

/** Daytime colour boost in the final grade; a touch stronger than neutral to suit the cartoon look. */
const GRADE_SAT = 1.22;
const GRADE = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.32 }, uSat: { value: GRADE_SAT }, uCon: { value: 1.06 }, uTint: { value: new THREE.Color(1, 1, 1) }, uAspect: { value: 1.6 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
  uniform sampler2D tDiffuse; uniform float uVig, uSat, uCon, uAspect; uniform vec3 uTint; varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
  void main(){
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, uSat);
    c = (c - 0.5) * uCon + 0.5;
    c *= uTint;
    c += (1.0 - l) * vec3(0.0, 0.012, 0.03);            // teal shadows
    vec2 d = (vUv - 0.5) * vec2(uAspect * 0.62, 1.0);
    c *= 1.0 - uVig * smoothstep(0.3, 0.85, length(d));
    c += (hash(vUv * 1000.0) - 0.5) / 255.0;
    gl_FragColor = vec4(max(c, 0.0), 1.0);
  }`,
};

export class SceneRig implements QualityTarget {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly sun = new THREE.DirectionalLight(0xffffff, 1);
  readonly hemi = new THREE.HemisphereLight(0xffffff, 0x6b6250, 0.6);
  readonly skyState: SkyState = {
    sky: new THREE.Color(), zenith: new THREE.Color(), shallow: new THREE.Color(), mid: new THREE.Color(), deep: new THREE.Color(),
    foam: new THREE.Color(), sunColor: new THREE.Color(), sunDir: new THREE.Vector3(0, 1, 0), sunI: 1, lantern: 0, night: 0, light: 1,
  };
  readonly fog = new THREE.Fog(0x9fd6ef, 38, 140);
  private sky: THREE.Mesh;
  private skyU: Record<string, THREE.IUniform>;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private grade: ShaderPass;
  private dprCap = 1.75;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap was removed in r18x; PCF is soft now
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 500);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0x9fd6ef);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -27; sc.right = 27; sc.top = 27; sc.bottom = -27; sc.near = 1; sc.far = 130;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.05;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target, this.hemi);

    this.skyU = {
      uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3() },
      uSunCol: { value: new THREE.Color() }, uMoonDir: { value: new THREE.Vector3(-0.35, 0.55, -0.75).normalize() },
      uNight: { value: 0 }, uTime: { value: 0 }, uSunVis: { value: 1 },
    };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(400, 24, 16),
      new THREE.ShaderMaterial({ vertexShader: SKY_V, fragmentShader: SKY_F, uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 1.05);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GRADE);
    this.composer.addPass(this.grade);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Apply a picture quality level: pixel ratio, shadows, anti-aliasing and bloom. */
  applyQuality(p: QualityPreset): void {
    this.dprCap = p.dpr;
    const shadows = p.shadow > 0;
    this.renderer.shadowMap.enabled = shadows;
    this.sun.castShadow = shadows;
    if (shadows && this.sun.shadow.mapSize.x !== p.shadow) {
      this.sun.shadow.mapSize.set(p.shadow, p.shadow);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    for (const rt of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      if (rt.samples !== p.samples) {
        rt.samples = p.samples;
        rt.dispose();
      }
    }
    this.bloom.enabled = p.bloom;
    this.resize();
  }

  resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.dprCap));
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.grade.uniforms.uAspect.value = this.camera.aspect;
  }

  /** Blend sun, sky and sea by the in-game hour; keep the shadow box centred on the focus point. */
  update(dayTime: number, focus: THREE.Vector3, t: number): void {
    const h = hourOf(dayTime);
    let i = 0;
    while (i < KEYS.length - 2 && h >= KEYS[i + 1].h) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const k = Math.min(1, Math.max(0, (h - a.h) / (b.h - a.h)));
    const s = this.skyState;
    mix(a.hor, b.hor, k, s.sky);
    mix(a.zen, b.zen, k, s.zenith);
    mix(a.shallow, b.shallow, k, s.shallow);
    mix(a.mid, b.mid, k, s.mid);
    mix(a.deep, b.deep, k, s.deep);
    mix(a.sun, b.sun, k, s.sunColor);
    s.sunI = a.sunI + (b.sunI - a.sunI) * k;
    this.sun.color.copy(s.sunColor);
    this.sun.intensity = s.sunI;
    this.hemi.intensity = a.hemiI + (b.hemiI - a.hemiI) * k;
    mix(a.hemiSky, b.hemiSky, k, this.hemi.color);
    mix(a.hemiGnd, b.hemiGnd, k, this.hemi.groundColor);
    this.renderer.toneMappingExposure = a.expo + (b.expo - a.expo) * k;
    (this.scene.background as THREE.Color).copy(s.sky);
    this.fog.color.copy(s.sky);

    s.lantern = h >= 12 ? Math.min(1, Math.max(0, (h - 19) / 1.5)) : Math.min(1, Math.max(0, (6.6 - h) / 1));
    const dayAmt = Math.min(1, Math.max(0, (s.sunI - 0.6) / 1.6));
    s.light = dayAmt;
    s.night = 1 - Math.min(1, Math.max(0, (s.sunI - 0.55) / 0.9));
    // Foam picks up the light colour.
    s.foam.set(0xffffff).lerp(tmpA.copy(s.sunColor), 0.3).multiplyScalar(0.3 + 0.7 * dayAmt);

    // Sun travels east (+x) at dawn to west (-x) at dusk; at night it becomes a high pale moon.
    const day = Math.min(1, Math.max(0, (h - 6) / 12));
    const ang = day * Math.PI;
    const night = h < 6 || h > 18.2;
    const sx = night ? -14 : Math.cos(ang) * 38;
    const sy = night ? 34 : Math.max(9, Math.sin(ang) * 38);
    this.sun.position.set(focus.x + sx, sy, focus.z + 12);
    this.sun.target.position.set(focus.x, 0, focus.z);
    s.sunDir.set(sx, sy, 12).normalize();

    // Sky dome follows the camera.
    this.sky.position.copy(this.camera.position);
    const u = this.skyU;
    (u.uZen.value as THREE.Color).copy(s.zenith);
    (u.uHor.value as THREE.Color).copy(s.sky);
    (u.uSunDir.value as THREE.Vector3).copy(night ? tmpDir.set(0.2, 0.07, -0.95).normalize() : s.sunDir);
    (u.uSunCol.value as THREE.Color).copy(s.sunColor);
    u.uNight.value = s.night;
    u.uTime.value = t;
    u.uSunVis.value = night ? 0 : 1;

    // Colour grade: warm tint at the golden hours, cooler at night.
    const warm = Math.max(0, 1 - Math.abs(s.sunI - 1.6) / 0.8) * (night && h < 18 ? 1 : 1) * (s.night < 0.5 ? 1 : 0);
    const g = this.grade.uniforms;
    (g.uTint.value as THREE.Color).setRGB(1 + warm * 0.06, 1 + warm * 0.005, 1 - warm * 0.05 + s.night * 0.04);
    g.uSat.value = GRADE_SAT - s.night * 0.1;
    this.bloom.strength = 0.28 + s.night * 0.12;
  }

  render(): void {
    this.composer.render();
  }
}
const tmpDir = new THREE.Vector3();
