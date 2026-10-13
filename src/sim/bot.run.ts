import { runBot } from './bot';
const rows: number[][] = [];
for (const seed of [1, 2, 3, 4, 5, 6]) {
  const r = runBot(seed, 130);
  rows.push(r.rankMinutes.map((m) => m ?? 999));
  console.log(seed, r.rankMinutes.map((m) => (m === null ? '-' : m.toFixed(1))).join(' '), 'hulls', r.state.boats.map((b) => b.hull).join(''));
}
const med = (i: number) => rows.map((r) => r[i]).sort((a, b) => a - b)[Math.floor(rows.length / 2)];
console.log('median', [1, 2, 3, 4].map(med).map((x) => x.toFixed(1)).join(' '));
