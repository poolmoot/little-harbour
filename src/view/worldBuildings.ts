import * as THREE from 'three';
import { LAYOUT, toWorld } from '../sim/config';
import { Smoke } from './fx';
import { hullGeometry } from './hull';
import { BOAT_TIERS } from './boatModels';
import { barrel, bx, chimney, crateBox, cy, doorAt, flat, gableRoof, net, put, signMesh, tBox, toon, windowAt } from './kit';
import type { Build } from './worldParts';

export function buildShipyard(w: Build): void {
  const Y = LAYOUT.shipyard, M = w.M;
  const { s: g, live } = w.place(Y.x, Y.z, Y.rot);
  bx(6.2, 0.4, 4.2, M.wall, 0, 0.2, 0, g);
  tBox(6, 2.7, 4, M.wood, 1.6, 0, 1.75, 0, g);
  for (const sx of [-1, 1]) bx(0.2, 3, 4.2, M.trim, sx * 3, 1.5, 0, g);
  gableRoof(g, 6, 4, 3.1, 1.7, M.blueRoof, M.wood, 0.5);
  // big workshop double door
  bx(1.9, 2.5, 0.1, M.trim, -1.1, 1.5, 2.02, g);
  for (const sx of [-1, 1]) {
    tBox(0.85, 2.3, 0.08, M.dark, 1, -1.1 + sx * 0.44, 1.4, 2.07, g);
    bx(0.6, 0.07, 0.1, M.iron, -1.1 + sx * 0.44, 1.0, 2.13, g);
    bx(0.6, 0.07, 0.1, M.iron, -1.1 + sx * 0.44, 1.9, 2.13, g);
  }
  windowAt(g, 1.7, 1.9, 2.03, 1.0, 0.9, { shutter: 0x3f6a86, flowers: true });
  windowAt(g, 3.03, 1.9, 0.5, 0.8, 0.8, { ry: Math.PI / 2 });
  windowAt(g, -3.03, 1.9, 0.5, 0.8, 0.8, { ry: -Math.PI / 2 });
  const smoke = chimney(g, -2.1, 3.6, -1.0, 2.0);
  g.updateMatrixWorld(true);
  w.smokes.push(new Smoke(w.group, g.localToWorld(smoke)));
  const sign = signMesh('SHIPYARD', 2.4, 0.55, '#3b5167');
  sign.position.set(0.9, 3.0, 2.2);
  live.add(sign);
  w.signs.push({ m: sign, phase: 1.2 });
  // upturned hull on trestles, round the back where the yard is quiet
  const hullMat = flat(0x7b4b32, 0.85);
  const hull = put(hullGeometry(BOAT_TIERS[0].shape, { bottom: 0, stripe: 0, side: 0, sheer: 0 }), hullMat, -0.6, 1.15, -3.1, g);
  hull.rotation.set(0, Math.PI / 2, Math.PI);
  hull.scale.set(0.85, 1, 0.8);
  (hull.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  bx(0.25, 0.75, 1.5, M.dark, -1.8, 0.38, -3.1, g);
  bx(0.25, 0.75, 1.5, M.dark, 0.6, 0.38, -3.1, g);
  // timber stack, barrels, anchor
  for (let i = 0; i < 4; i++) bx(2.2, 0.12, 0.3, i % 2 ? M.crate : M.wood, -3.9, 0.07 + i * 0.13, 1.2 + (i % 2) * 0.05, g).rotation.y = 0.5;
  barrel(g, 3.4, 2.4, 0, 1, false);
  crateBox(g, -3.3, 0, 2.6, 0.7, 0.2);
  const anchor = new THREE.Group();
  anchor.position.set(-2.3, 0.55, 2.7);
  cy(0.04, 0.04, 1.0, M.iron, 0, 0, 0, anchor, 6);
  bx(0.6, 0.05, 0.05, M.iron, 0, 0.35, 0, anchor);
  const arc = put(new THREE.TorusGeometry(0.28, 0.04, 5, 10, Math.PI), M.iron, 0, -0.35, 0, anchor);
  arc.rotation.z = Math.PI;
  anchor.rotation.set(0.1, 0.4, 0.15);
  g.add(anchor);
  w.signs.push({ m: net(live, 1.6, 1.0, 1.9, 0.9, 3.0, 0.2), phase: 3.3 });
  w.box({ cx: Y.x, cz: Y.z, hx: 3, hz: 2, a: Y.rot });
  const h = toWorld(Y, -0.6, -3.1);
  w.box({ cx: h.x, cz: h.z, hx: 1.7, hz: 0.8, a: Y.rot });
}

export function buildInn(w: Build): void {
  const { x, z } = LAYOUT.inn, M = w.M, s = w.stat;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  s.add(g);
  bx(7.2, 0.4, 5.2, M.wall, 0, 0.2, 0, g);
  tBox(7, 2.6, 5, M.cream, 2, 0, 1.7, 0, g);
  tBox(6.6, 2.2, 4.6, M.wood, 1.6, 0, 4.1, 0, g);
  bx(7.3, 0.2, 5.3, M.trim, 0, 3.05, 0, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(0.22, 3.0, 0.22, M.trim, sx * 3.5, 1.5, sz * 2.5, g);
  for (const sx of [-1, 1]) bx(0.18, 2.2, 0.18, M.dark, sx * 3.3, 4.1, 2.3, g);
  bx(6.7, 0.14, 0.14, M.dark, 0, 5.15, 2.3, g);
  gableRoof(g, 6.6, 4.6, 5.2, 1.9, M.redRoof, M.wood, 0.6);
  doorAt(g, -1.8, 2.5, 1.3, 2.2);
  windowAt(g, 0.8, 1.7, 2.5, 0.95, 0.95, { shutter: 0x2f6f8f, flowers: true });
  windowAt(g, 2.5, 1.7, 2.5, 0.95, 0.95, { shutter: 0x2f6f8f, flowers: true });
  for (const wx of [-1.8, 0.2, 2.2]) windowAt(g, wx, 4.1, 2.3, 0.9, 0.9, { shutter: 0xb5483a });
  windowAt(g, 3.5, 1.8, 0.4, 0.9, 0.9, { ry: Math.PI / 2, shutter: 0x2f6f8f });
  windowAt(g, 3.3, 4.1, 0, 0.9, 0.9, { ry: Math.PI / 2 });
  const top = chimney(g, 2.5, 5.9, -0.8, 1.7);
  w.smokes.push(new Smoke(w.group, top.add(new THREE.Vector3(x, 0, z)), 32));
  // hanging anchor sign
  for (const sx of [-1.3, 1.7]) bx(0.05, 0.4, 0.05, M.iron, sx, 3.35, 2.7, g);
  const sign = signMesh('THE ANCHOR INN', 3.0, 0.55, '#7a2f2a');
  sign.position.set(x + 0.2, 3.35, z + 2.74);
  w.group.add(sign);
  w.signs.push({ m: sign, phase: 2.4 });
  // pennant on the ridge
  const pole = cy(0.03, 0.03, 1.6, M.iron, 3.1, 7.9, 0, g, 5);
  pole.castShadow = false;
  const fg = new THREE.PlaneGeometry(0.9, 0.5, 6, 2);
  fg.translate(0.45, 0, 0);
  w.flag = new THREE.Mesh(fg, toon(new THREE.MeshStandardMaterial({ color: 0xd24a3a, side: THREE.DoubleSide, roughness: 0.9 })));
  w.flag.position.set(x + 3.1, 8.4, z);
  w.flag.userData.keep = true;
  w.group.add(w.flag);
  // outside bits
  barrel(s, x + 4.1, z + 2.2);
  crateBox(s, x + 4.9, 0, z + 1.6, 0.8, 0.2);
  crateBox(s, x + 4.5, 0, z + 0.7, 0.6, 0.6);
  bx(1.6, 0.08, 0.4, M.dark, x + 0.6, 0.5, z + 2.95, s);
  bx(0.08, 0.5, 0.36, M.dark, x - 0.1, 0.25, z + 2.95, s);
  bx(0.08, 0.5, 0.36, M.dark, x + 1.3, 0.25, z + 2.95, s);
  for (const px of [-3.0, -0.7]) {
    put(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 8), flat(0xb5654a, 0.9), x + px, 0.15 + 0.4, z + 2.75, s);
    for (let i = 0; i < 4; i++) put(new THREE.SphereGeometry(0.1, 6, 5), flat([0xff7aa8, 0xffe14a, 0xffffff, 0xb48cf0][i], 0.8), x + px - 0.12 + i * 0.08, 0.7, z + 2.75 + (i % 2) * 0.05, s);
  }
  w.solid({ x0: x - 3.5, x1: x + 3.5, z0: z - 2.5, z1: z + 2.5 });
}

export function buildBoardAndIce(w: Build): void {
  const nb = LAYOUT.noticeBoard, M = w.M, s = w.stat;
  for (const sx of [-1, 1]) cy(0.07, 0.08, 2.4, M.dark, nb.x + sx * 0.95, 1.2, nb.z, s, 6);
  tBox(2.1, 1.3, 0.1, M.wood, 1.2, nb.x, 1.55, nb.z, s);
  bx(2.3, 0.1, 0.16, M.trim, nb.x, 2.25, nb.z, s);
  for (const sx of [-1, 1]) {
    const r = tBox(1.3, 0.08, 0.5, M.blueRoof, 1, nb.x + sx * 0.52, 2.45, nb.z, s);
    r.rotation.z = -sx * 0.4;
  }
  const papers = [0xf6ecd2, 0xe9dcb0, 0xf6ecd2, 0xdfe8d0, 0xf2dcd0];
  papers.forEach((c, i) => {
    const p = bx(0.38, 0.5, 0.02, flat(c, 0.95), nb.x - 0.75 + i * 0.37, 1.55 + (i % 2) * 0.12, nb.z + 0.07, s);
    p.rotation.z = (i - 2) * 0.07;
    put(new THREE.SphereGeometry(0.03, 5, 4), flat(0xc03a2a, 0.5), nb.x - 0.75 + i * 0.37, 1.76 + (i % 2) * 0.12, nb.z + 0.1, s);
  });
  const sign = signMesh('NOTICES', 1.4, 0.3, '#2f4f3a');
  sign.position.set(nb.x, 0.62, nb.z + 0.09);
  s.add(sign);
  w.solid({ x0: nb.x - 1, x1: nb.x + 1, z0: nb.z - 0.2, z1: nb.z + 0.2 });

  const ib = LAYOUT.iceBox;
  tBox(1.7, 0.9, 1.3, M.white, 1.4, ib.x, 0.45, ib.z, s);
  bx(1.8, 0.1, 1.4, flat(0x8fb5c6, 0.4), ib.x, 0.92, ib.z, s);
  for (const dy of [0.2, 0.7]) bx(1.74, 0.05, 1.34, M.iron, ib.x, dy, ib.z, s);
  bx(0.4, 0.12, 0.1, flat(0xb0b6ba, 0.3), ib.x, 0.7, ib.z + 0.68, s);
  const sg = signMesh('ICE', 0.6, 0.25, '#4a7a96');
  sg.position.set(ib.x, 0.45, ib.z + 0.69);
  s.add(sg);
  w.solid({ x0: ib.x - 0.9, x1: ib.x + 0.9, z0: ib.z - 0.7, z1: ib.z + 0.7 });
}
