// Vérifie que chaque niveau est résoluble (et pas déjà résolu au départ).
// Usage : node tools/check-levels.js [numéroNiveau]
'use strict';
const E = require('../engine.js');
const LEVELS = require('../levels.js');

// Paramètres libres d'un niveau : angle des objets rotatifs, position u des objets sur rail.
function freeParams(objects) {
  const params = [];
  objects.forEach((o, i) => {
    const period = o.type === 'source' || o.type === 'portal' ? 360 : o.type === 'prism' ? 120 : 180;
    if (o.rotatable) params.push({ i, kind: 'angle', min: 0, max: period });
    if (o.track) params.push({ i, kind: 'u', min: 0, max: 1 });
  });
  return params;
}

function apply(objects, params, values) {
  params.forEach((p, k) => {
    const o = objects[p.i];
    if (p.kind === 'angle') o.angle = values[k];
    else {
      const [x1, y1, x2, y2] = o.track;
      o.x = x1 + (x2 - x1) * values[k];
      o.y = y1 + (y2 - y1) * values[k];
    }
  });
}

function distToSegment(px, py, s) {
  const ex = s.x2 - s.x1, ey = s.y2 - s.y1;
  const l2 = ex * ex + ey * ey || 1;
  const u = Math.max(0, Math.min(1, ((px - s.x1) * ex + (py - s.y1) * ey) / l2));
  return Math.hypot(px - s.x1 - ex * u, py - s.y1 - ey * u);
}

// Score continu (pour guider la recherche) : cibles allumées + proximité des rayons de la bonne couleur.
function score(objects) {
  const r = E.trace(objects);
  let s = 0;
  r.targets.forEach((t, i) => {
    if (r.lit[i]) { s += 1; return; }
    if (t.avoid) return;
    const want = E.COLOR_MASK[t.color || 'W'];
    let best = Infinity;
    for (const seg of r.segments) if (!seg.warp && (seg.mask & want)) best = Math.min(best, distToSegment(t.x, t.y, seg));
    s += 0.8 * Math.exp(-best / 60);
  });
  return { s, solved: r.solved };
}

function solve(level) {
  const objects = E.cloneLevel(level.objects);
  const params = freeParams(objects);
  if (level.solution) {
    apply(objects, params, level.solution);
    return { found: E.trace(objects).solved ? level.solution : null, ratio: null };
  }
  const steps = params.map(p => (p.kind === 'angle' ? 1 : 0.005));
  // Grille exhaustive si petit espace, sinon recherche aléatoire + raffinement.
  const sizes = params.map((p, k) => Math.round((p.max - p.min) / steps[k]) + 1);
  const total = sizes.reduce((a, b) => a * b, 1);
  let found = null, count = 0;
  if (total <= 400000) {
    const idx = params.map(() => 0);
    for (let n = 0; n < total; n++) {
      let rem = n;
      for (let k = 0; k < params.length; k++) { idx[k] = rem % sizes[k]; rem = Math.floor(rem / sizes[k]); }
      const vals = idx.map((v, k) => params[k].min + v * steps[k]);
      apply(objects, params, vals);
      if (E.trace(objects).solved) { count++; if (!found) found = vals.slice(); }
    }
    return { found, ratio: count / total };
  }
  let tries = 0;
  for (; tries < 600 && !found; tries++) {
    let vals = params.map(p => p.min + Math.random() * (p.max - p.min));
    apply(objects, params, vals);
    let cur = score(objects).s;
    for (let it = 0; it < 1500; it++) {
      const k = Math.floor(Math.random() * params.length);
      const nv = vals.slice();
      const span = params[k].max - params[k].min;
      nv[k] = Math.min(params[k].max, Math.max(params[k].min, nv[k] + (Math.random() - 0.5) * span * (it < 500 ? 0.3 : 0.03)));
      apply(objects, params, nv);
      const sc = score(objects);
      if (sc.solved) { found = nv; break; }
      if (sc.s >= cur) { cur = sc.s; vals = nv; }
    }
  }
  return { found, ratio: null, tries };
}

const only = process.argv[2] ? Number(process.argv[2]) - 1 : null;
let ok = true;
LEVELS.forEach((level, n) => {
  if (only !== null && n !== only) return;
  const initial = E.trace(E.cloneLevel(level.objects)).solved;
  const { found, ratio, tries } = solve(level);
  const good = found && !initial;
  if (!good) ok = false;
  console.log(`${good ? 'OK' : 'KO'} ${String(n + 1).padStart(2)} ${level.name.padEnd(22)} initial=${initial ? 'RÉSOLU!' : 'non'} ` +
    `solution=${found ? found.map(v => v.toFixed(2)).join(',') : 'aucune'}` +
    (ratio != null ? ` densité=${(ratio * 100).toFixed(3)}%` : '') + (tries ? ` essais=${tries}` : ''));
});
process.exit(ok ? 0 : 1);
