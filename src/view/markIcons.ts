/** Simple chunky icons for the building signboards, drawn with code on a 2D canvas (no pictures). Each fits a 100 by 100 box. */
export type MarkIcon = 'fish' | 'snow' | 'smoke' | 'plate' | 'light' | 'anchor' | 'mug' | 'paper' | 'ice' | 'forsale';

const CREAM = '#f6ecd2', INK = '#2a1a10';

function fill(g: CanvasRenderingContext2D, colour: string): void {
  g.fillStyle = colour; g.strokeStyle = INK; g.lineWidth = 5; g.lineJoin = 'round'; g.lineCap = 'round';
  g.fill(); g.stroke();
}

export function drawIcon(g: CanvasRenderingContext2D, icon: MarkIcon, x: number, y: number, s: number): void {
  g.save();
  g.translate(x, y);
  g.scale(s / 100, s / 100);
  switch (icon) {
    case 'fish':
      g.beginPath(); g.ellipse(46, 50, 32, 21, 0, 0, 7); fill(g, '#7fc4e8');
      g.beginPath(); g.moveTo(72, 50); g.lineTo(96, 30); g.lineTo(96, 70); g.closePath(); fill(g, '#5aa8d6');
      g.beginPath(); g.arc(30, 44, 4.5, 0, 7); g.fillStyle = INK; g.fill();
      break;
    case 'snow':
      g.strokeStyle = '#d9f1ff'; g.lineWidth = 8; g.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3, dx = Math.cos(a) * 40, dy = Math.sin(a) * 40;
        g.beginPath(); g.moveTo(50 - dx, 50 - dy); g.lineTo(50 + dx, 50 + dy); g.stroke();
        for (const k of [-1, 1]) {
          const ex = 50 + k * dx * 0.62, ey = 50 + k * dy * 0.62;
          g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + Math.cos(a + 1.1) * 12, ey + Math.sin(a + 1.1) * 12); g.moveTo(ex, ey); g.lineTo(ex + Math.cos(a - 1.1) * 12, ey + Math.sin(a - 1.1) * 12); g.stroke();
        }
      }
      break;
    case 'smoke':
      g.strokeStyle = '#e8e2d6'; g.lineWidth = 9; g.lineCap = 'round';
      for (const x0 of [28, 50, 72]) { g.beginPath(); g.moveTo(x0, 88); g.bezierCurveTo(x0 - 16, 68, x0 + 16, 52, x0, 34); g.bezierCurveTo(x0 - 10, 22, x0 + 8, 14, x0, 8); g.stroke(); }
      break;
    case 'plate':
      g.beginPath(); g.arc(50, 52, 34, 0, 7); fill(g, '#f6f1e4');
      g.beginPath(); g.arc(50, 52, 20, 0, 7); g.strokeStyle = '#c9bfa6'; g.lineWidth = 4; g.stroke();
      g.strokeStyle = CREAM; g.lineWidth = 6;
      g.beginPath(); g.moveTo(8, 20); g.lineTo(8, 84); g.moveTo(92, 20); g.lineTo(92, 84); g.stroke();
      break;
    case 'light':
      g.beginPath(); g.moveTo(36, 90); g.lineTo(42, 34); g.lineTo(58, 34); g.lineTo(64, 90); g.closePath(); fill(g, '#f4efe4');
      g.beginPath(); g.moveTo(38, 70); g.lineTo(62, 70); g.lineTo(63, 58); g.lineTo(39, 58); g.closePath(); fill(g, '#d6453a');
      g.beginPath(); g.rect(40, 22, 20, 14); fill(g, '#ffe07a');
      g.beginPath(); g.moveTo(38, 22); g.lineTo(50, 8); g.lineTo(62, 22); g.closePath(); fill(g, '#d6453a');
      g.strokeStyle = '#ffe07a'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(32, 26); g.lineTo(8, 20); g.moveTo(68, 26); g.lineTo(92, 20); g.moveTo(32, 32); g.lineTo(10, 38); g.moveTo(68, 32); g.lineTo(90, 38); g.stroke();
      break;
    case 'anchor':
      g.strokeStyle = '#dfe6ec'; g.lineWidth = 9; g.lineCap = 'round';
      g.beginPath(); g.arc(50, 18, 8, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(50, 26); g.lineTo(50, 82); g.moveTo(32, 40); g.lineTo(68, 40); g.stroke();
      g.beginPath(); g.arc(50, 58, 32, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      break;
    case 'mug':
      g.beginPath(); g.roundRect(18, 30, 46, 56, 6); fill(g, '#e9b24a');
      g.beginPath(); g.arc(70, 56, 15, -1.3, 1.3); g.strokeStyle = '#e9b24a'; g.lineWidth = 9; g.stroke();
      g.beginPath(); g.arc(28, 28, 11, 0, 7); g.arc(42, 24, 13, 0, 7); g.arc(55, 28, 10, 0, 7); fill(g, '#fffaf0');
      break;
    case 'paper':
      g.beginPath(); g.moveTo(22, 10); g.lineTo(62, 10); g.lineTo(80, 28); g.lineTo(80, 90); g.lineTo(22, 90); g.closePath(); fill(g, '#f6ecd2');
      g.beginPath(); g.moveTo(62, 10); g.lineTo(62, 28); g.lineTo(80, 28); fill(g, '#dccfa6');
      g.strokeStyle = '#8a7a5a'; g.lineWidth = 5;
      for (const yy of [44, 58, 72]) { g.beginPath(); g.moveTo(32, yy); g.lineTo(70, yy); g.stroke(); }
      break;
    case 'ice':
      g.beginPath(); g.moveTo(50, 12); g.lineTo(86, 32); g.lineTo(86, 70); g.lineTo(50, 90); g.lineTo(14, 70); g.lineTo(14, 32); g.closePath(); fill(g, '#bfe9ff');
      g.beginPath(); g.moveTo(14, 32); g.lineTo(50, 52); g.lineTo(86, 32); g.moveTo(50, 52); g.lineTo(50, 90); g.strokeStyle = '#7fb6d6'; g.lineWidth = 4; g.stroke();
      break;
    case 'forsale':
      g.strokeStyle = '#8a6a44'; g.lineWidth = 8;
      g.beginPath(); g.moveTo(24, 92); g.lineTo(24, 10); g.stroke();
      g.beginPath(); g.roundRect(24, 16, 62, 44, 6); fill(g, '#f6ecd2');
      g.fillStyle = '#b5483a'; g.font = 'bold 34px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('$', 55, 40);
      break;
  }
  g.restore();
}
