import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CameraRig } from './cameraRig';

describe('camera rig', () => {
  const make = () => new CameraRig(new THREE.PerspectiveCamera(), new THREE.Vector3(0, 0, 0));

  it('follows without jerking while the player walks', () => {
    const rig = make(), t = new THREE.Vector3();
    let last = 0, lastStep = 0, worst = 0;
    for (let i = 0; i < 240; i++) {
      t.z = -Math.min(i, 120) * 5.2 / 60; // walks, then stops at 120
      rig.update(1 / 60, t);
      const step = rig.focus.z - last;
      if (i > 2) worst = Math.max(worst, Math.abs(step - lastStep));
      lastStep = step; last = rig.focus.z;
    }
    expect(worst).toBeLessThan(0.03);
    expect(Math.abs(rig.focus.z - t.z)).toBeLessThan(0.05);
  });

  it('cuts straight to the player after a big jump', () => {
    const rig = make(), t = new THREE.Vector3(40, 0, -12);
    rig.pitchGoal = 42;
    rig.update(1 / 60, t);
    expect(rig.focus.x).toBeCloseTo(40, 3);
    expect(rig.focus.z).toBeCloseTo(-12, 3);
    expect(rig.pitchDeg).toBeCloseTo(42, 3);
  });

  it('leads a little in the direction of movement and settles back when still', () => {
    const rig = make(), t = new THREE.Vector3();
    for (let i = 0; i < 90; i++) { t.x += 5.2 / 60; rig.update(1 / 60, t); }
    expect(t.x - rig.focus.x).toBeLessThan(0.6); // the look-ahead cancels most of the follow lag (about 1 m without it)
    for (let i = 0; i < 180; i++) rig.update(1 / 60, t);
    expect(Math.abs(rig.focus.x - t.x)).toBeLessThan(0.02);
  });
});
