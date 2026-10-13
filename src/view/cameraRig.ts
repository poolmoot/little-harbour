import * as THREE from 'three';

/** Fixed-yaw angled camera: about 55 degrees down, 20 m from the focus, smooth follow. */
export class CameraRig {
  readonly focus = new THREE.Vector3();
  private readonly offset: THREE.Vector3;

  constructor(private camera: THREE.PerspectiveCamera, start: THREE.Vector3, pitchDeg = 55, distance = 20) {
    const p = (pitchDeg * Math.PI) / 180;
    this.offset = new THREE.Vector3(0, Math.sin(p) * distance, Math.cos(p) * distance);
    this.focus.copy(start);
    this.apply();
  }

  update(dt: number, target: THREE.Vector3): void {
    const k = 1 - Math.exp(-dt * 5);
    this.focus.lerp(target, k);
    this.apply();
  }

  private apply(): void {
    this.camera.position.copy(this.focus).add(this.offset);
    this.camera.lookAt(this.focus.x, this.focus.y + 0.6, this.focus.z);
  }
}
