import * as THREE from 'three';

/** Procedural canvas textures (no image files). All cached. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function make(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat = true, srgb = true): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (g) draw(g, size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  return t;
}

const jitter = (base: number[], r: () => number, a: number): string =>
  `rgb(${base.map((v) => Math.max(0, Math.min(255, Math.round(v + (r() - 0.5) * a)))).join(',')})`;

function speckle(g: CanvasRenderingContext2D, s: number, r: () => number, n: number, light = 'rgba(255,255,255,.07)', dark = 'rgba(0,0,0,.07)'): void {
  for (let i = 0; i < n; i++) {
    g.fillStyle = r() > 0.5 ? light : dark;
    g.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 2);
  }
}

const cache = new Map<string, THREE.CanvasTexture>();
function cached(key: string, f: () => THREE.CanvasTexture): THREE.CanvasTexture {
  let t = cache.get(key);
  if (!t) { t = f(); cache.set(key, t); }
  return t;
}

/** Rounded stones in staggered rows. 1 tile ~ 2 m. */
export function stones(key: string, palette: number[][], rows = 8, per = 5, grout = [92, 84, 72]): THREE.CanvasTexture {
  return cached(key, () => make(512, (g, s) => {
    const r = rng(key.length * 77 + rows);
    g.fillStyle = `rgb(${grout.join(',')})`;
    g.fillRect(0, 0, s, s);
    const rh = s / rows;
    for (let row = 0; row < rows; row++) {
      const n = per + (row % 3 === 0 ? 1 : 0);
      const w = s / n;
      const off = (row % 2) * w * 0.5;
      for (let i = -1; i <= n; i++) {
        const base = palette[Math.floor(r() * palette.length)];
        const x = i * w + off + (r() - 0.5) * 4, y = row * rh + (r() - 0.5) * 2;
        const sw = w - 5 - r() * 4, sh = rh - 4 - r() * 3;
        for (const ox of [0, s, -s]) {
          g.fillStyle = jitter(base, r, 16);
          g.beginPath();
          g.roundRect(x + 2 + ox, y + 2, sw, sh, 7);
          g.fill();
          g.fillStyle = 'rgba(255,255,255,.14)';
          g.fillRect(x + 5 + ox, y + 3, sw - 8, 2);
          g.fillStyle = 'rgba(0,0,0,.12)';
          g.fillRect(x + 5 + ox, y + sh - 1, sw - 8, 2);
        }
      }
    }
    speckle(g, s, r, 2600);
  }));
}
export const cobble = () => stones('cobble', [[212, 200, 172], [196, 184, 156], [222, 211, 184], [184, 176, 156], [205, 190, 160]], 8, 5);
export const stoneWall = () => stones('stonewall', [[150, 150, 146], [168, 164, 156], [138, 140, 138], [160, 150, 138]], 6, 3, [96, 92, 88]);
export const quayLip = () => stones('lip', [[226, 218, 198], [210, 202, 182]], 4, 2, [150, 142, 124]);

/** Boards. dir 'h' = boards run along u. */
export function boards(key: string, base: number[], count = 8, nails = true): THREE.CanvasTexture {
  return cached(key, () => make(512, (g, s) => {
    const r = rng(key.length * 31 + count);
    const bh = s / count;
    for (let i = 0; i < count; i++) {
      g.fillStyle = jitter(base, r, 26);
      g.fillRect(0, i * bh, s, bh);
      for (let k = 0; k < 14; k++) {
        g.strokeStyle = r() > 0.5 ? 'rgba(0,0,0,.09)' : 'rgba(255,255,255,.07)';
        g.lineWidth = 1 + r() * 1.5;
        const y = i * bh + 3 + r() * (bh - 6);
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(s * 0.3, y + (r() - 0.5) * 5, s * 0.6, y + (r() - 0.5) * 5, s, y);
        g.stroke();
      }
      if (r() > 0.6) {
        g.fillStyle = 'rgba(40,24,10,.35)';
        g.beginPath();
        g.ellipse(r() * s, i * bh + bh * 0.5, 5 + r() * 4, 2.5, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = 'rgba(25,14,6,.55)';
      g.fillRect(0, i * bh, s, 3);
      g.fillStyle = 'rgba(255,255,255,.1)';
      g.fillRect(0, i * bh + 3, s, 2);
      if (nails) for (const nx of [10, s - 10]) {
        g.fillStyle = 'rgba(30,25,22,.7)';
        g.beginPath(); g.arc(nx, i * bh + bh / 2, 2.2, 0, 7); g.fill();
      }
    }
  }));
}
export const pierPlanks = () => boards('pier', [168, 130, 92], 8);
export const wallPlanks = () => boards('wall', [150, 112, 78], 8);
export const darkPlanks = () => boards('dark', [104, 76, 52], 6, false);
export const crateWood = () => boards('crate', [176, 140, 96], 4);

export function grass(): THREE.CanvasTexture {
  return cached('grass', () => make(512, (g, s) => {
    const r = rng(5);
    g.fillStyle = 'rgb(112,168,76)';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 220; i++) {
      const x = r() * s, y = r() * s, rad = 18 + r() * 46;
      const light = r() > 0.5;
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        gr.addColorStop(0, light ? 'rgba(168,214,96,.30)' : 'rgba(58,120,60,.30)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
    speckle(g, s, r, 4000, 'rgba(210,240,140,.18)', 'rgba(30,80,40,.18)');
  }));
}

export function roofTiles(key: string, base: number[]): THREE.CanvasTexture {
  return cached('roof' + key, () => make(256, (g, s) => {
    const r = rng(key.length + 9);
    const rows = 8, rh = s / rows, n = 6, w = s / n;
    g.fillStyle = 'rgb(40,24,20)';
    g.fillRect(0, 0, s, s);
    for (let row = -1; row < rows; row++) {
      const off = (row % 2) * w * 0.5;
      for (let i = -1; i <= n; i++) {
        g.fillStyle = jitter(base, r, 24);
        const x = i * w + off, y = row * rh;
        for (const ox of [0, s, -s]) {
          g.beginPath();
          g.moveTo(x + ox, y);
          g.lineTo(x + w + ox, y);
          g.lineTo(x + w + ox, y + rh * 0.6);
          g.quadraticCurveTo(x + w / 2 + ox, y + rh * 1.35, x + ox, y + rh * 0.6);
          g.closePath();
          g.fill();
          g.strokeStyle = 'rgba(0,0,0,.28)';
          g.lineWidth = 1.5;
          g.stroke();
        }
      }
    }
  }));
}

export function plaster(key: string, base: number[]): THREE.CanvasTexture {
  return cached('plaster' + key, () => make(256, (g, s) => {
    const r = rng(key.length + 3);
    g.fillStyle = `rgb(${base.join(',')})`;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      const x = r() * s, y = r() * s, rad = 10 + r() * 30;
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        gr.addColorStop(0, r() > 0.5 ? 'rgba(255,255,255,.10)' : 'rgba(90,60,30,.08)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
    speckle(g, s, r, 1500);
  }));
}

/** Fishing net: transparent mesh lines. */
export function net(): THREE.CanvasTexture {
  return cached('net', () => make(128, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.strokeStyle = 'rgba(214,196,150,1)';
    g.lineWidth = 3;
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const p = (i / n) * s;
      g.beginPath(); g.moveTo(p - s / 2, 0); g.lineTo(p + s / 2, s); g.stroke();
      g.beginPath(); g.moveTo(p + s / 2, 0); g.lineTo(p - s / 2, s); g.stroke();
    }
  }));
}

/** Soft white blob used for foam wake puffs and glows. */
export function blob(): THREE.CanvasTexture {
  return cached('blob', () => make(128, (g, s) => {
    const r = rng(11);
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.5, 'rgba(255,255,255,.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(0,0,0,${0.2 + r() * 0.4})`;
      g.beginPath();
      g.arc(r() * s, r() * s, 3 + r() * 8, 0, 7);
      g.fill();
    }
  }, false));
}
export function glow(): THREE.CanvasTexture {
  return cached('glow', () => make(128, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  }, false));
}

export function sign(text: string, w: number, h: number, bg = '#6b4a2f', fg = '#f6ecd2'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = Math.max(64, Math.round((512 * h) / w));
  const g = c.getContext('2d');
  if (g) {
    const r = rng(text.length * 13);
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 30; i++) {
      g.strokeStyle = r() > 0.5 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.08)';
      g.lineWidth = 1 + r() * 2;
      const y = r() * c.height;
      g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(c.width * 0.3, y + 4, c.width * 0.6, y - 4, c.width, y); g.stroke();
    }
    g.strokeStyle = fg;
    g.lineWidth = 6;
    g.strokeRect(10, 10, c.width - 20, c.height - 20);
    g.font = `bold ${Math.round(c.height * 0.5)}px "Trebuchet MS", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,.45)';
    g.fillText(text, c.width / 2 + 3, c.height / 2 + 6);
    g.fillStyle = fg;
    g.fillText(text, c.width / 2, c.height / 2 + 3);
    g.fillStyle = 'rgba(30,20,12,.8)';
    for (const [nx, ny] of [[22, 22], [c.width - 22, 22], [22, c.height - 22], [c.width - 22, c.height - 22]]) {
      g.beginPath(); g.arc(nx, ny, 4, 0, 7); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
