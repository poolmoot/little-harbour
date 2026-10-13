import * as THREE from 'three';
import { hourOf } from '../sim/time';

interface Key {
  h: number;
  sky: number;
  sun: number;
  sunI: number;
  hemiI: number;
  sea: number;
}
const KEYS: Key[] = [
  { h: 0, sky: 0x0b1626, sun: 0x7f95d0, sunI: 0.22, hemiI: 0.38, sea: 0x0c2a3f },
  { h: 5.5, sky: 0x0e1a30, sun: 0x7f95d0, sunI: 0.22, hemiI: 0.38, sea: 0x0d2c44 },
  { h: 6.5, sky: 0xf2b48a, sun: 0xffb27a, sunI: 0.8, hemiI: 0.5, sea: 0x3a6f86 },
  { h: 8.5, sky: 0x9fd6ef, sun: 0xfff1d6, sunI: 1.2, hemiI: 0.65, sea: 0x2f89a8 },
  { h: 13, sky: 0x8fd3f2, sun: 0xffffff, sunI: 1.35, hemiI: 0.72, sea: 0x2a93b5 },
  { h: 17.5, sky: 0xe9c08a, sun: 0xffb06a, sunI: 1.0, hemiI: 0.58, sea: 0x3a7d96 },
  { h: 19.5, sky: 0xb85f6f, sun: 0xff7f66, sunI: 0.45, hemiI: 0.42, sea: 0x2a5470 },
  { h: 21, sky: 0x0e1a30, sun: 0x7f95d0, sunI: 0.22, hemiI: 0.38, sea: 0x0d2c44 },
  { h: 24, sky: 0x0b1626, sun: 0x7f95d0, sunI: 0.22, hemiI: 0.38, sea: 0x0c2a3f },
];

const cA = new THREE.Color();
const cB = new THREE.Color();
function lerpHex(a: number, b: number, t: number, out: THREE.Color): THREE.Color {
  return out.set(a).lerp(cB.set(b), t);
}

export interface SkyState {
  sky: THREE.Color;
  sea: THREE.Color;
  lantern: number; // 0 day .. 1 night
}

export class SceneRig {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly sun = new THREE.DirectionalLight(0xffffff, 1);
  readonly hemi = new THREE.HemisphereLight(0xffffff, 0x6b6250, 0.6);
  readonly skyState: SkyState = { sky: new THREE.Color(), sea: new THREE.Color(), lantern: 0 };
  private fog = new THREE.Fog(0x9fd6ef, 45, 100);

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 260);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0x9fd6ef);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 120;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target, this.hemi);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  /** Blend sun, sky and sea by the in-game hour; keep the shadow box centred on the focus point. */
  update(dayTime: number, focus: THREE.Vector3): void {
    const h = hourOf(dayTime);
    let i = 0;
    while (i < KEYS.length - 2 && h >= KEYS[i + 1].h) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = Math.min(1, Math.max(0, (h - a.h) / (b.h - a.h)));
    const sky = lerpHex(a.sky, b.sky, t, this.skyState.sky);
    this.skyState.sea = lerpHex(a.sea, b.sea, t, this.skyState.sea);
    this.sun.color.copy(lerpHex(a.sun, b.sun, t, cA));
    this.sun.intensity = a.sunI + (b.sunI - a.sunI) * t;
    this.hemi.intensity = a.hemiI + (b.hemiI - a.hemiI) * t;
    this.hemi.color.copy(sky).lerp(cB.set(0xffffff), 0.45);
    (this.scene.background as THREE.Color).copy(sky);
    this.fog.color.copy(sky);
    this.skyState.lantern = h >= 12 ? Math.min(1, Math.max(0, (h - 19) / 1.5)) : Math.min(1, Math.max(0, (6.5 - h) / 1));

    // Sun travels east (+x) at dawn to west (-x) at dusk; at night it becomes a high pale moon.
    const day = Math.min(1, Math.max(0, (h - 6) / 12));
    const ang = day * Math.PI;
    const night = h < 6 || h > 18;
    const sx = night ? -14 : Math.cos(ang) * 38;
    const sy = night ? 34 : Math.max(10, Math.sin(ang) * 38);
    this.sun.position.set(focus.x + sx, sy, focus.z + 16);
    this.sun.target.position.set(focus.x, 0, focus.z);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
