import * as THREE from 'three';
import { CROWD_SPOTS, nearestGate } from './townPlaces';
import type { Spot } from './townPlaces';
import { CitizenPool } from './townFolk';
import type { Citizen } from './townFolk';
import { crowdSize } from './townRules';
import type { CrowdKind } from './townRules';
import type { World } from './world';

const WATCHING = 1, LEAVING = 2;
/** How long (seconds) a crowd stays for each kind of catch. */
const STAY: Record<CrowdKind, number> = { big: 22, golden: 28, king: 36 };
/** Seconds after a boat is unloaded that its crowd drifts away. */
const LINGER = 3;
const RANK: Record<CrowdKind, number> = { big: 1, golden: 2, king: 3 };

interface Gathering { kind: CrowdKind; crates: number; focus: Spot; boatId: number; until: number; since: number }

/**
 * A crowd at the head of the pier. A big catch draws a few townsfolk who watch the unloading and drift away; a golden fish
 * or the King Fish draws more, and they clap and wave.
 */
export class PierCrowd {
  private pool: CitizenPool;
  private g: Gathering | null = null;
  private members: Citizen[] = [];
  private spawnIn = 0;

  constructor(scene: THREE.Scene, private world: World, size: number) {
    this.pool = new CitizenPool(scene, size, 300);
  }

  get gathering(): boolean { return this.g !== null; }

  /** Someone (or something) worth watching has happened at `focus`. A bigger event upgrades a crowd that is already there. */
  gather(kind: CrowdKind, crates: number, focus: Spot, boatId: number, now: number): void {
    const old = this.g;
    if (old && RANK[old.kind] > RANK[kind]) { old.until = Math.max(old.until, now + STAY[kind] * 0.5); return; }
    // a bigger event at the same place keeps watching the same spot
    this.g = { kind, crates: Math.max(crates, old?.crates ?? 0), focus: old ? old.focus : focus, boatId: old ? old.boatId : boatId, until: now + STAY[kind], since: now };
  }

  /** The boat was unloaded: its crowd goes soon. */
  unloaded(boatId: number, now: number): void {
    if (this.g && this.g.boatId === boatId && this.g.kind === 'big') this.g.until = Math.min(this.g.until, now + LINGER);
  }

  update(dt: number, now: number, cap: number): void {
    const g = this.g;
    if (g && now > g.until) this.g = null;
    const want = this.g ? crowdSize(this.g.kind, this.g.crates, cap) : 0;
    const list = this.members;
    // drift away when it is over, or when the crowd should be smaller
    while (list.length > want) this.dismiss(list.pop() as Citizen);
    this.spawnIn -= dt;
    if (this.g && list.length < want && this.spawnIn <= 0) {
      const c = this.pool.acquire();
      if (c) {
        const gate = nearestGate(CROWD_SPOTS[list.length].x, CROWD_SPOTS[list.length].z);
        c.spawn(gate.x, gate.z, 0);
        c.tag = WATCHING;
        c.slot = -1;
        list.push(c);
        this.spawnIn = 0.5 + Math.random() * 0.9;
      }
    }
    const f = this.g?.focus;
    for (let i = 0; i < list.length; i++) {
      const c = list[i], spot = CROWD_SPOTS[i % CROWD_SPOTS.length];
      if (c.slot !== i && f) {
        c.slot = i;
        c.goTo(spot.x, spot.z, 1.7, Math.atan2(f.x - spot.x, f.z - spot.z));
      }
      const g2 = this.g;
      let wave = false, clap = false;
      if (g2 && c.arrived) {
        const t = now - g2.since;
        if (g2.kind === 'big') clap = t < 5 && i % 2 === 0 && (Math.floor(now * 0.9 + i) % 3 !== 0);
        else {
          // golden fish and the King Fish: everyone cheers for a good while, some clapping and some waving
          const loud = t < (g2.kind === 'king' ? 24 : 14);
          clap = loud && i % 3 !== 0;
          wave = loud && i % 3 === 0;
        }
      }
      c.fig.pose.clap = clap;
      c.fig.pose.wave = wave;
      c.lookYaw = c.arrived ? Math.sin(now * 0.5 + i * 1.7) * 0.25 : null;
    }
    for (const c of this.pool.all) {
      if (c.tag === LEAVING && c.active && c.arrived && !c.fading) c.retire();
    }
    this.pool.update(dt, this.world);
  }

  private dismiss(c: Citizen): void {
    c.tag = LEAVING;
    c.slot = -1;
    c.fig.pose.clap = false;
    c.fig.pose.wave = false;
    c.lookYaw = null;
    const gate = nearestGate(c.x, c.z);
    c.goTo(gate.x, gate.z, 1.5 + Math.random() * 0.3, null);
  }
}
