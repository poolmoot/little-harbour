import * as THREE from 'three';
import { seeThrough } from './occlusion';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Ink outlines for the harbour's props and buildings, matching the characters in figures.ts:
 * the shape drawn again inside-out in a dark colour, pushed out so it shows as a rim.
 *
 * Boxes have a separate normal on every face, so pushing each face along its own normal would
 * tear the shell open at the corners. Here every corner gets one shared push direction (a mitre),
 * which keeps the shell closed and the line the same width on every side.
 */
export const INK_COLOUR = 0x1b1630;
/** Line width in metres at the usual camera distance. */
const INK_WIDTH = 0.03;
/** Camera distance (m) the width is tuned for; farther away the line grows so it does not vanish. */
const INK_REF_DIST = 20;
const INK_GROW_MAX = 2.2;
/** Parts thinner than this (ropes, rods, lamp cage bars) get no outline: they would turn solid black. */
const MIN_THICKNESS = 0.06;
/** The line is never wider than this share of a part's thinnest side. */
const MAX_SHARE = 0.25;
/** Limit on how far a sharp corner or cone tip is pushed, as a multiple of the line width. */
const MITRE_MAX = 2;
/** Corners closer than 1 / WELD metres count as the same corner. */
const WELD = 2000;
/** Normals this closely aligned count as the same face. */
const SAME_FACE = 0.999;

const inkMat = new THREE.MeshBasicMaterial({ color: INK_COLOUR, side: THREE.BackSide });
inkMat.onBeforeCompile = (shader) => {
  seeThrough(shader);
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
    float inkDist = -(modelViewMatrix * vec4(position, 1.0)).z;
    float inkGrow = clamp(inkDist / ${INK_REF_DIST.toFixed(1)}, 1.0, ${INK_GROW_MAX.toFixed(1)});
    vec3 transformed = position + normal * (${INK_WIDTH.toFixed(3)} * inkGrow);`);
};

/** Thinnest side of a mesh in world units, measured along its own axes. */
export function thinnestSide(mesh: THREE.Mesh): number {
  const g = mesh.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  const size = (g.boundingBox as THREE.Box3).getSize(new THREE.Vector3());
  const e = mesh.matrixWorld.elements;
  const sx = Math.hypot(e[0], e[1], e[2]), sy = Math.hypot(e[4], e[5], e[6]), sz = Math.hypot(e[8], e[9], e[10]);
  return Math.min(size.x * sx, size.y * sy, size.z * sz);
}

interface Corner { faces: THREE.Vector3[]; push: THREE.Vector3 }

/** One push direction per corner: the average of the faces that meet there, lengthened so every face moves out by the same amount. */
function cornerPushes(pos: THREE.BufferAttribute, nor: THREE.BufferAttribute): Corner[] {
  const corners = new Map<string, Corner>();
  const perVertex: Corner[] = [];
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * WELD)},${Math.round(pos.getY(i) * WELD)},${Math.round(pos.getZ(i) * WELD)}`;
    let c = corners.get(key);
    if (!c) { c = { faces: [], push: new THREE.Vector3() }; corners.set(key, c); }
    n.fromBufferAttribute(nor, i).normalize();
    if (!c.faces.some((f) => f.dot(n) > SAME_FACE)) c.faces.push(n.clone());
    perVertex.push(c);
  }
  for (const c of corners.values()) {
    for (const f of c.faces) c.push.add(f);
    if (c.push.lengthSq() < 1e-8) { c.push.copy(c.faces[0]); continue; }
    c.push.normalize();
    let facing = 0;
    for (const f of c.faces) facing += c.push.dot(f);
    c.push.multiplyScalar(Math.min(MITRE_MAX, c.faces.length / Math.max(facing, 1e-4)));
  }
  return perVertex;
}

/**
 * Outline shell for a geometry (already in the space it will be drawn in). `thin` is the part's
 * thinnest side; returns null when the part is too thin to outline.
 */
export function inkGeometry(src: THREE.BufferGeometry, thin: number): THREE.BufferGeometry | null {
  if (thin < MIN_THICKNESS) return null;
  const g = src.index ? src.toNonIndexed() : src;
  const pos = g.attributes.position as THREE.BufferAttribute, nor = g.attributes.normal as THREE.BufferAttribute;
  if (!nor) return null;
  const share = Math.min(1, (thin * MAX_SHARE) / INK_WIDTH);
  const push = new Float32Array(pos.count * 3);
  cornerPushes(pos, nor).forEach((c, i) => {
    push[i * 3] = c.push.x * share;
    push[i * 3 + 1] = c.push.y * share;
    push[i * 3 + 2] = c.push.z * share;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos.array), 3));
  out.setAttribute('normal', new THREE.BufferAttribute(push, 3)); // read by the ink shader as the push, not as a unit normal
  return out;
}

/** All the given outline shells as one mesh: one draw call however many parts it covers. */
export function inkMesh(shells: THREE.BufferGeometry[]): THREE.Mesh | null {
  if (!shells.length) return null;
  const merged = shells.length === 1 ? shells[0] : mergeGeometries(shells, false);
  if (!merged) return null;
  const m = new THREE.Mesh(merged, inkMat);
  m.userData.keep = true; // bake() must not merge it with lit meshes
  m.userData.ink = true;
  return m;
}

/** Outline a single stand-alone mesh (a sign, a moving prop) by hanging the shell on it as a child. */
export function addInk(mesh: THREE.Mesh): void {
  mesh.updateMatrixWorld(true);
  const shell = inkGeometry(mesh.geometry, thinnestSide(mesh));
  const ink = shell && inkMesh([shell]);
  if (ink) mesh.add(ink);
}
