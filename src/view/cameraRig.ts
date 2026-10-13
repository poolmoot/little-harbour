import * as THREE from 'three';

/** Fixed-yaw angled camera, smooth follow. The pitch eases flatter out on the pier so the sea and haze show. */
export class CameraRig {
  readonly focus = new THREE.Vector3();
  pitchDeg = 55;
  pitchGoal = 55;
  distance = 20;
  override: { pitch: number; dist: number } | null = null;

  constructor(private camera: THREE.PerspectiveCamera, start: THREE.Vector3) {
    this.focus.copy(start);
    this.apply();
  }

  update(dt: number, target: THREE.Vector3): void {
    const k = 1 - Math.exp(-dt * 5);
    this.focus.lerp(target, k);
    this.pitchDeg += (this.pitchGoal - this.pitchDeg) * (1 - Math.exp(-dt * 2));
    this.apply();
  }

  private apply(): void {
    const pitch = this.override?.pitch ?? this.pitchDeg;
    const dist = this.override?.dist ?? this.distance;
    const p = (pitch * Math.PI) / 180;
    this.camera.position.set(this.focus.x, this.focus.y + Math.sin(p) * dist, this.focus.z + Math.cos(p) * dist);
    this.camera.lookAt(this.focus.x, this.focus.y + 0.6, this.focus.z);
  }
}
