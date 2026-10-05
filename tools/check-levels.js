// Vérifie chaque niveau « boîte à outils » :
//  - pas résolu sans outils ;
//  - la solution fournie respecte l'inventaire et les règles de placement, et résout le niveau ;
//  - tolérance : part des petites perturbations (±1°, ±3 px) de la solution qui restent valides.
// Usage : node tools/check-levels.js [numéroNiveau]
'use strict';
const E = require('../engine.js');
const LEVELS = require('../levels.js');

function placeSolution(level, jitter) {
  const objects = E.cloneLevel(level.objects);
  const used = level.tools.map(() => 0);
  const errors = [];
  for (const s of level.solution) {
    const tool = level.tools[s.tool];
    if (!tool) { errors.push(`outil ${s.tool} inconnu`); continue; }
    const j = jitter ? () => (Math.random() * 2 - 1) : () => 0;
    const p = E.makePiece(tool, s.x + 3 * j(), s.y + 3 * j(), s.angle === undefined ? undefined : s.angle + j());
    used[s.tool]++;
    if (!E.placementOK(level, objects, p)) errors.push(`placement interdit (${tool.type} en ${s.x},${s.y})`);
    objects.push(p);
  }
  level.tools.forEach((t, k) => { if (used[k] > t.count) errors.push(`trop de ${t.type}`); });
  return { objects, errors };
}

const only = process.argv[2] ? Number(process.argv[2]) - 1 : null;
let ok = true;
LEVELS.forEach((level, n) => {
  if (only !== null && n !== only) return;
  const initial = E.trace(E.cloneLevel(level.objects)).solved;
  const { objects, errors } = placeSolution(level, false);
  const solved = E.trace(objects).solved;
  let tolerant = 0;
  const TRIALS = 200;
  for (let k = 0; k < TRIALS; k++) if (E.trace(placeSolution(level, true).objects).solved) tolerant++;
  const good = !initial && solved && errors.length === 0;
  if (!good) ok = false;
  const tools = level.tools.map(t => `${t.count}×${t.type}`).join(' ');
  console.log(`${good ? 'OK' : 'KO'} ${String(n + 1).padStart(2)} ${level.name.padEnd(24)} ${tools.padEnd(40)} ` +
    `tolérance=${String(Math.round((100 * tolerant) / TRIALS)).padStart(3)}%` +
    (initial ? '  RÉSOLU SANS OUTIL' : '') + (solved ? '' : '  SOLUTION KO') + (errors.length ? '  ' + errors.join(', ') : ''));
});
process.exit(ok ? 0 : 1);
