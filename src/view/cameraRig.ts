import * as THREE from 'three';
import { Damped } from './motion';

/** The camera jumps (instead of swooping) when the player is moved further than this in one frame, e.g. a teleport or a load. */
const JUMP = 3.5;
/** A little look-ahead in the direction of movement, in metres per m/s of speed, and its limit. */
const AHEAD = 0.14, AHEAD_MAX = 0.9;

/** Title-screen camera: a slow circle round the harbour, starting far out over the sea and drifting in. */
const SHOW_CENTRE = new THREE.Vector3(0, 0, 2);
const SHOW_FAR = 70, SHOW_NEAR = 34, SHOW_DOLLY_S = 6, SHOW_SPIN = 0.045, SHOW_START = Math.PI - 0.45, SHOW_HEIGHT = 0.5;
/** How fast the camera blends between the title circle and following the player (per second). */
const SHOW_BLEND = 0.7;
const smooth = (x: number) => x * x * (3 - 2 * x);
const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3(), showPos = new THREE.Vector3();

/** Fixed-yaw angled camera, smooth follow. The pitch eases flatter out on the pier so the sea and haze show. */
export class CameraRig {
  readonly focus = new THREE.Vector3();
  pitchDeg = 55;
  pitchGoal = 55;
  distance = 20;
  override: { pitch: number; dist: number } | null = null;
  /** True while the title screen is up: the camera circles the harbour instead of following the player. */
  showcase = false;
  private show = 0;
  private showT = 0;
  private fx = new Damped();
  private fz = new Damped();
  private pitch = new Damped(55);
  private lastX: number;
  private lastZ: number;
  private aheadX = 0;
  private aheadZ = 0;

  constructor(private camera: THREE.PerspectiveCamera, start: THREE.Vector3) {
    this.focus.copy(start);
    this.fx.snap(start.x);
    this.fz.snap(start.z);
    this.lastX = start.x;
    this.lastZ = start.z;
    this.apply();
  }

  update(dt: number, target: THREE.Vector3): void {
    dt = Math.min(dt, 0.05);
    const jump = Math.hypot(target.x - this.lastX, target.z - this.lastZ) > JUMP || Math.hypot(target.x - this.fx.value, target.z - this.fz.value) > 14;
    if (jump) {
      // Moved far in one go: cut straight there, with no swoop across the town.
      this.fx.snap(target.x);
      this.fz.snap(target.z);
      this.pitch.snap(this.pitchGoal);
      this.aheadX = this.aheadZ = 0;
    } else if (dt > 0) {
      // Look a little way ahead of where the player is heading; the movement is measured, then eased so it never twitches.
      const vx = (target.x - this.lastX) / dt, vz = (target.z - this.lastZ) / dt;
      const sp = Math.hypot(vx, vz);
      const f = sp > 0 ? Math.min(AHEAD * sp, AHEAD_MAX) / sp : 0;
      const k = 1 - Math.exp(-dt * 3);
      this.aheadX += (vx * f - this.aheadX) * k;
      this.aheadZ += (vz * f - this.aheadZ) * k;
    }
    this.lastX = target.x;
    this.lastZ = target.z;
    this.focus.x = this.fx.update(target.x + this.aheadX, 0.2, dt);
    this.focus.z = this.fz.update(target.z + this.aheadZ, 0.2, dt);
    this.focus.y += (target.y - this.focus.y) * (1 - Math.exp(-dt * 5));
    this.pitchDeg = this.pitch.update(this.pitchGoal, 0.6, dt);
    if (this.showcase) this.showT += dt;
    this.show = Math.min(1, Math.max(0, this.show + (this.showcase ? 1 : -1) * dt * SHOW_BLEND));
    this.apply();
  }

  private apply(): void {
    const pitch = this.override?.pitch ?? this.pitchDeg;
    const dist = this.override?.dist ?? this.distance;
    const p = (pitch * Math.PI) / 180;
    tmpPos.set(this.focus.x, this.focus.y + Math.sin(p) * dist, this.focus.z + Math.cos(p) * dist);
    tmpLook.set(this.focus.x, this.focus.y + 0.6, this.focus.z);
    if (this.show > 0) {
      // Blend from the follow camera towards the title circle (and back again when play starts).
      const r = SHOW_FAR + (SHOW_NEAR - SHOW_FAR) * smooth(Math.min(1, this.showT / SHOW_DOLLY_S));
      const a = SHOW_START + this.showT * SHOW_SPIN, k = smooth(this.show);
      tmpPos.lerp(showPos.set(SHOW_CENTRE.x + Math.sin(a) * r, r * SHOW_HEIGHT, SHOW_CENTRE.z + Math.cos(a) * r), k);
      tmpLook.lerp(SHOW_CENTRE, k);
    }
    this.camera.position.copy(tmpPos);
    this.camera.lookAt(tmpLook);
  }
}
