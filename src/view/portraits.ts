import * as THREE from 'three';
import { Figure } from './figures';
import type { FigureOpts } from './figures';

/**
 * Head-and-shoulders pictures of people for the menus, rendered from the same 3D figures the game shows.
 * Each look is drawn once on a small private canvas and cached as an image URL.
 */
const SIZE = 192;
const cache = new Map<string, string>();
let stage: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera } | null = null;

function getStage() {
  if (stage) return stage;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(2, 4, 5);
  scene.add(sun, new THREE.HemisphereLight(0xffffff, 0x8a8a9a, 1.3));
  const camera = new THREE.PerspectiveCamera(20, 1, 0.5, 20);
  stage = { renderer, scene, camera };
  return stage;
}

/** Image URL of a person's portrait. Returns '' where 3D drawing is not available (for example in tests). */
export function portrait(look: FigureOpts): string {
  const key = JSON.stringify(look);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let url = '';
  try {
    const { renderer, scene, camera } = getStage();
    const figure = new Figure({ ...look, scale: 1 });
    figure.update(0.016, 0);
    figure.group.rotation.y = 0.32;
    scene.add(figure.group);
    // Frame the shoulders to the top of the hat.
    camera.position.set(0, 1.72, 3.8);
    camera.lookAt(0, 1.66, 0);
    renderer.render(scene, camera);
    url = renderer.domElement.toDataURL('image/png');
    scene.remove(figure.group);
    figure.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  } catch {
    url = '';
  }
  cache.set(key, url);
  return url;
}
