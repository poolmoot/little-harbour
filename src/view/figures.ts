import * as THREE from 'three';

const matCache = new Map<number, THREE.MeshStandardMaterial>();
export function mat(color: number): THREE.MeshStandardMaterial {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });
    matCache.set(color, m);
  }
  return m;
}

export function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, parent?: THREE.Object3D): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent?.add(m);
  return m;
}

export interface FigureOpts {
  skin?: number;
  shirt: number;
  pants: number;
  hat?: 'straw' | 'cap' | 'none';
  hatColor?: number;
  apron?: number;
  scale?: number;
}

/** Code-built low-poly person with a procedural walk (leg swing and bob). Front faces +z. */
export class Figure {
  group = new THREE.Group();
  private body = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private phase = Math.random() * 6;
  private amp = 0;
  private idle = 0;

  constructor(o: FigureOpts) {
    const skin = o.skin ?? 0xf0c8a0;
    this.group.add(this.body);
    box(0.56, 0.62, 0.32, o.shirt, 0, 0.88, 0, this.body);
    if (o.apron) box(0.5, 0.5, 0.05, o.apron, 0, 0.8, 0.18, this.body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat(skin));
    head.position.y = 1.38;
    head.castShadow = true;
    this.body.add(head);
    for (const sx of [-0.08, 0.08]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), mat(0x2a2320));
      eye.position.set(sx, 1.4, 0.2);
      this.body.add(eye);
    }
    for (const [g, sx] of [[this.legL, -0.14], [this.legR, 0.14]] as const) {
      g.position.set(sx, 0.58, 0);
      box(0.2, 0.58, 0.22, o.pants, 0, -0.29, 0, g);
      this.body.add(g);
    }
    for (const [g, sx] of [[this.armL, -0.4], [this.armR, 0.4]] as const) {
      g.position.set(sx, 1.14, 0);
      box(0.14, 0.52, 0.16, o.shirt, 0, -0.24, 0, g);
      box(0.15, 0.12, 0.17, skin, 0, -0.5, 0, g);
      this.body.add(g);
    }
    const hc = o.hatColor ?? 0xe6c35c;
    if (o.hat === 'straw') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.04, 18), mat(hc));
      brim.position.y = 1.52;
      brim.castShadow = true;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.16, 14), mat(hc));
      crown.position.y = 1.6;
      crown.castShadow = true;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.04, 14), mat(0xb5412f));
      band.position.y = 1.55;
      this.body.add(brim, crown, band);
    } else if (o.hat === 'cap') {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.235, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(hc));
      cap.position.y = 1.4;
      cap.castShadow = true;
      this.body.add(cap);
      box(0.3, 0.03, 0.18, hc, 0, 1.45, 0.22, this.body);
    }
    if (o.scale) this.group.scale.setScalar(o.scale);
  }

  /** speed in m/s. Call every frame. */
  update(dt: number, speed: number): void {
    const moving = speed > 0.15;
    this.amp += ((moving ? 1 : 0) - this.amp) * Math.min(1, dt * 12);
    if (moving) this.phase += dt * (5 + speed * 0.9);
    this.idle += dt;
    const s = Math.sin(this.phase);
    this.legL.rotation.x = s * 0.75 * this.amp;
    this.legR.rotation.x = -s * 0.75 * this.amp;
    const breathe = Math.sin(this.idle * 2) * 0.04 * (1 - this.amp);
    this.armL.rotation.x = -s * 0.6 * this.amp + breathe;
    this.armR.rotation.x = s * 0.6 * this.amp - breathe;
    this.body.position.y = Math.abs(s) * 0.07 * this.amp;
  }

  /** Raise the arms forward (carrying / casting). */
  setArmsUp(up: boolean): void {
    if (up) {
      this.armL.rotation.x = -1.2;
      this.armR.rotation.x = -1.2;
    }
  }
}
