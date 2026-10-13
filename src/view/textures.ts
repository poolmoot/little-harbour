import * as THREE from 'three';

/**
 * Procedural canvas textures (no image files). All cached.
 * Drawn in the game's cartoon style: flat colour fills, bold dark seams and one clean highlight per
 * shape, with no fine grain or speckle (that reads as realistic and fights the cel shading).
 */
const SEAM = 'rgba(52,34,40,.6)';        // dark line between boards
const SHINE = 'rgba(255,255,255,.16)';   // highlight along the lit edge of a shape
const SHADE = 'rgba(40,24,40,.14)';      // matching shade along the opposite edge
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

const cache = new Map<string, THREE.CanvasTexture>();
function cached(key: string, f: () => THREE.CanvasTexture): THREE.CanvasTexture {
  let t = cache.get(key);
  if (!t) { t = f(); cache.set(key, t); }
  return t;
}

/** Rounded stones in staggered rows. 1 tile ~ 2 m. */
export function stones(key: string, palette: number[][], rows = 8, per = 5, grout = [92, 84, 72], vary = 16): THREE.CanvasTexture {
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
          g.fillStyle = jitter(base, r, vary);
          g.beginPath();
          g.roundRect(x + 2 + ox, y + 2, sw, sh, 7);
          g.fill();
          g.fillStyle = SHINE;
          g.fillRect(x + 7 + ox, y + 4, sw - 10, 3);
          g.fillStyle = SHADE;
          g.fillRect(x + 7 + ox, y + sh - 2, sw - 10, 3);
        }
      }
    }
  }));
}
export const cobble = () => stones('cobble', [[224, 200, 156], [216, 190, 146], [230, 208, 166], [210, 186, 146]], 8, 5, [168, 140, 108], 5);
export const stoneWall = () => stones('stonewall', [[150, 158, 176], [168, 172, 184], [134, 144, 166], [160, 158, 164]], 6, 3, [82, 84, 108], 8);
export const quayLip = () => stones('lip', [[240, 228, 200], [228, 214, 184]], 4, 2, [164, 146, 122], 5);

const GRAIN_STROKES = 2;
/** Boards. dir 'h' = boards run along u. */
export function boards(key: string, base: number[], count = 8, nails = true): THREE.CanvasTexture {
  return cached(key, () => make(512, (g, s) => {
    const r = rng(key.length * 31 + count);
    const bh = s / count;
    for (let i = 0; i < count; i++) {
      g.fillStyle = jitter(base, r, 20);
      g.fillRect(0, i * bh, s, bh);
      // a couple of short chunky grain strokes per board, not a fine grain
      g.lineCap = 'round';
      for (let k = 0; k < GRAIN_STROKES; k++) {
        g.strokeStyle = SHADE;
        g.lineWidth = 3;
        const y = i * bh + bh * (0.35 + 0.4 * r()), x0 = r() * s, len = s * (0.12 + r() * 0.2);
        for (const ox of [-s, 0]) {
          g.beginPath();
          g.moveTo(x0 + ox, y);
          g.lineTo(x0 + len + ox, y);
          g.stroke();
        }
      }
      g.fillStyle = SEAM;
      g.fillRect(0, i * bh, s, 4);
      g.fillStyle = SHINE;
      g.fillRect(0, i * bh + 4, s, 3);
      if (nails) for (const nx of [10, s - 10]) {
        g.fillStyle = 'rgba(30,25,22,.7)';
        g.beginPath(); g.arc(nx, i * bh + bh / 2, 2.2, 0, 7); g.fill();
      }
    }
  }));
}
export const pierPlanks = () => boards('pier', [196, 144, 90], 8);
export const wallPlanks = () => boards('wall', [176, 116, 70], 8);
export const darkPlanks = () => boards('dark', [116, 76, 52], 6, false);
export const crateWood = () => boards('crate', [212, 160, 92], 4);

export function grass(): THREE.CanvasTexture {
  return cached('grass', () => make(512, (g, s) => {
    const r = rng(5);
    g.fillStyle = 'rgb(108,176,74)';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      const x = r() * s, y = r() * s, rad = 30 + r() * 60;
      const light = r() > 0.5;
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        gr.addColorStop(0, light ? 'rgba(170,220,96,.26)' : 'rgba(60,132,66,.26)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
  }));
}

export function roofTiles(key: string, base: number[]): THREE.CanvasTexture {
  return cached('roof' + key, () => make(256, (g, s) => {
    const r = rng(key.length + 9);
    const rows = 8, rh = s / rows, n = 6, w = s / n;
    g.fillStyle = 'rgb(46,28,40)';
    g.fillRect(0, 0, s, s);
    for (let row = -1; row < rows; row++) {
      const off = (row % 2) * w * 0.5;
      for (let i = -1; i <= n; i++) {
        const fill = jitter(base, r, 18);
        const x = i * w + off, y = row * rh;
        for (const ox of [0, s, -s]) {
          g.fillStyle = fill;
          g.beginPath();
          g.moveTo(x + ox, y);
          g.lineTo(x + w + ox, y);
          g.lineTo(x + w + ox, y + rh * 0.6);
          g.quadraticCurveTo(x + w / 2 + ox, y + rh * 1.35, x + ox, y + rh * 0.6);
          g.closePath();
          g.fill();
          g.strokeStyle = SEAM;
          g.lineWidth = 2.5;
          g.stroke();
          g.fillStyle = SHINE;
          g.fillRect(x + 4 + ox, y + 3, w - 8, 3);
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
    for (let i = 0; i < 24; i++) {
      const x = r() * s, y = r() * s, rad = 24 + r() * 40;
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        gr.addColorStop(0, r() > 0.5 ? 'rgba(255,255,255,.08)' : 'rgba(120,70,30,.06)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
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
