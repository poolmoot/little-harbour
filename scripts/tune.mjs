// Tuning script (not part of the game or the production bundle).
// Runs the scripted player on several seeds and prints when each rank is reached.
// Usage: npm run tune [-- seedCount maxMinutes]
import { createServer } from 'vite';

const seedCount = Number(process.argv[2] ?? 8);
const maxMinutes = Number(process.argv[3] ?? 130);

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { runBot } = await server.ssrLoadModule('/src/sim/bot.ts');
  const rows = [];
  const kings = [];
  for (let seed = 1; seed <= seedCount; seed++) {
    const r = runBot(seed, maxMinutes);
    rows.push(r.rankMinutes.map((m) => m ?? 999));
    const trawlers = r.state.boats.filter((b) => b.hull === 3).length;
    const f = (m) => (m === null ? '-' : m.toFixed(1));
    console.log(`seed ${seed}:`, r.rankMinutes.map(f).join(' '), '| king', f(r.kingMinutes), 'inn', f(r.deliveredMinutes), '| gap', r.longestGap.toFixed(1), '| goals', r.state.goal, '| hulls', r.state.boats.map((b) => b.hull).join(''), '| trawlers', trawlers, '| bld', Object.values(r.state.buildings).join(''));
    kings.push(r.deliveredMinutes ?? 999);
  }
  const med = (i) => rows.map((r) => r[i]).sort((a, b) => a - b)[Math.floor(rows.length / 2)];
  console.log('median minutes to the King Fish at the inn:', kings.sort((a, b) => a - b)[Math.floor(kings.length / 2)].toFixed(1));
  console.log('median minutes to rank 1-4:', [1, 2, 3, 4].map(med).map((x) => x.toFixed(1)).join(' '));
} finally {
  await server.close();
}
