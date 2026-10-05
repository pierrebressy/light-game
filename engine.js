// Moteur de lumière : géométrie, lancer de rayons, réflexion, réfraction (dispersion), filtres.
// Pur JS, sans DOM — utilisable dans le navigateur et dans Node (tools/check-levels.js).
(function (root) {
  'use strict';

  const W = 800, H = 1000, BORDER = 24;
  const DEG = Math.PI / 180;
  const EPS = 1e-6;
  const MAX_DEPTH = 64;
  const MAX_SEGMENTS = 600;
  const RAY_LEN = 4000;

  // Couleurs codées sur 3 bits : rouge=1, vert=2, bleu=4, blanc=7.
  const COLOR_MASK = { R: 1, G: 2, B: 4, Y: 3, M: 5, C: 6, W: 7 };
  const COLOR_NAME = { 1: 'rouge', 2: 'vert', 3: 'jaune', 4: 'bleu', 5: 'magenta', 6: 'cyan', 7: 'blanc' };
  // Indice de réfraction par composante (dispersion volontairement exagérée pour le jeu).
  const IOR = { 1: 1.42, 2: 1.55, 4: 1.70 };

  function cloneLevel(level) {
    return JSON.parse(JSON.stringify(level));
  }

  function prismVertices(p) {
    const r = p.size || 60;
    const pts = [];
    for (let i = 0; i < 3; i++) {
      const a = (p.angle - 90 + i * 120) * DEG;
      pts.push([p.x + r * Math.cos(a), p.y + r * Math.sin(a)]);
    }
    return pts;
  }

  function lineEnds(o) {
    const h = (o.len || 80) / 2;
    const c = Math.cos(o.angle * DEG), s = Math.sin(o.angle * DEG);
    return [o.x - c * h, o.y - s * h, o.x + c * h, o.y + s * h];
  }

  function rectSurfaces(x, y, w, h, out, obj) {
    const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    for (let i = 0; i < 4; i++) {
      const a = pts[i], b = pts[(i + 1) % 4];
      out.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], kind: 'wall', obj });
    }
  }

  // Construit la liste des surfaces qu'un rayon peut toucher.
  function buildScene(objects) {
    const surfaces = [];
    const targets = [];
    rectSurfaces(0, 0, W, BORDER, surfaces, null);
    rectSurfaces(0, H - BORDER, W, BORDER, surfaces, null);
    rectSurfaces(0, 0, BORDER, H, surfaces, null);
    rectSurfaces(W - BORDER, 0, BORDER, H, surfaces, null);

    for (const o of objects) {
      if (o.type === 'wall') {
        rectSurfaces(o.x, o.y, o.w, o.h, surfaces, o);
      } else if (o.type === 'mirror') {
        const [ax, ay, bx, by] = lineEnds(o);
        surfaces.push({ ax, ay, bx, by, kind: 'mirror', obj: o });
      } else if (o.type === 'splitter') {
        const [ax, ay, bx, by] = lineEnds(o);
        surfaces.push({ ax, ay, bx, by, kind: 'splitter', obj: o });
      } else if (o.type === 'filter') {
        const [ax, ay, bx, by] = lineEnds(o);
        surfaces.push({ ax, ay, bx, by, kind: 'filter', mask: COLOR_MASK[o.color], obj: o });
      } else if (o.type === 'dichroic') {
        const [ax, ay, bx, by] = lineEnds(o);
        surfaces.push({ ax, ay, bx, by, kind: 'dichroic', mask: COLOR_MASK[o.color], obj: o });
      } else if (o.type === 'portal') {
        const partner = objects.find(p => p.type === 'portal' && p.id === o.link);
        const [ax, ay, bx, by] = lineEnds(o);
        if (partner) surfaces.push({ ax, ay, bx, by, kind: 'portal', obj: o, partner });
      } else if (o.type === 'prism') {
        const v = prismVertices(o);
        for (let i = 0; i < 3; i++) {
          const a = v[i], b = v[(i + 1) % 3];
          let nx = b[1] - a[1], ny = -(b[0] - a[0]);
          const len = Math.hypot(nx, ny);
          nx /= len; ny /= len;
          // Normale orientée vers l'extérieur du prisme.
          const mx = (a[0] + b[0]) / 2 - o.x, my = (a[1] + b[1]) / 2 - o.y;
          if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
          surfaces.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], kind: 'glass', nx, ny, obj: o });
        }
      } else if (o.type === 'target') {
        targets.push(o);
      }
    }
    return { surfaces, targets };
  }

  function raySegment(ox, oy, dx, dy, s) {
    const ex = s.bx - s.ax, ey = s.by - s.ay;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) return Infinity;
    const qx = s.ax - ox, qy = s.ay - oy;
    const t = (qx * ey - qy * ex) / den;
    const u = (qx * dy - qy * dx) / den;
    if (t > EPS && u >= -1e-9 && u <= 1 + 1e-9) return t;
    return Infinity;
  }

  function rayCircle(ox, oy, dx, dy, cx, cy, r) {
    const fx = ox - cx, fy = oy - cy;
    const b = fx * dx + fy * dy;
    const c = fx * fx + fy * fy - r * r;
    const disc = b * b - c;
    if (disc < 0) return Infinity;
    const t1 = -b - Math.sqrt(disc);
    return t1 > EPS ? t1 : Infinity;
  }

  function bits(mask) {
    const out = [];
    for (const b of [1, 2, 4]) if (mask & b) out.push(b);
    return out;
  }

  // Lance tous les rayons. Retourne les segments lumineux et la couleur reçue par chaque cible.
  function trace(objects) {
    const { surfaces, targets } = buildScene(objects);
    const segments = [];
    const received = targets.map(() => 0);
    const stack = [];

    for (const o of objects) {
      if (o.type !== 'source') continue;
      const a = o.angle * DEG;
      const dx = Math.cos(a), dy = Math.sin(a);
      stack.push({ x: o.x + dx * 30, y: o.y + dy * 30, dx, dy, mask: COLOR_MASK[o.color || 'W'], depth: 0 });
    }

    while (stack.length && segments.length < MAX_SEGMENTS) {
      const r = stack.pop();
      let best = RAY_LEN, hit = null, hitTarget = -1;
      for (const s of surfaces) {
        const t = raySegment(r.x, r.y, r.dx, r.dy, s);
        if (t < best) { best = t; hit = s; }
      }
      for (let i = 0; i < targets.length; i++) {
        const tg = targets[i];
        const t = rayCircle(r.x, r.y, r.dx, r.dy, tg.x, tg.y, tg.r || 26);
        if (t < best) { best = t; hit = null; hitTarget = i; }
      }
      const hx = r.x + r.dx * best, hy = r.y + r.dy * best;
      segments.push({ x1: r.x, y1: r.y, x2: hx, y2: hy, mask: r.mask, inGlass: !!r.inGlass });

      if (hitTarget >= 0) { received[hitTarget] |= r.mask; continue; }
      if (!hit || r.depth >= MAX_DEPTH) continue;
      const d = r.depth + 1;

      if (hit.kind === 'mirror' || hit.kind === 'splitter') {
        let nx = -(hit.by - hit.ay), ny = hit.bx - hit.ax;
        const l = Math.hypot(nx, ny); nx /= l; ny /= l;
        const dot = r.dx * nx + r.dy * ny;
        const rx = r.dx - 2 * dot * nx, ry = r.dy - 2 * dot * ny;
        stack.push({ x: hx + rx * 1e-3, y: hy + ry * 1e-3, dx: rx, dy: ry, mask: r.mask, depth: d });
        // La lame séparatrice laisse aussi passer la lumière.
        if (hit.kind === 'splitter') stack.push({ x: hx + r.dx * 1e-3, y: hy + r.dy * 1e-3, dx: r.dx, dy: r.dy, mask: r.mask, depth: d });
      } else if (hit.kind === 'dichroic') {
        // Miroir dichroïque : réfléchit sa couleur, laisse passer le reste.
        const refl = r.mask & hit.mask, pass = r.mask & ~hit.mask;
        if (refl) {
          let nx = -(hit.by - hit.ay), ny = hit.bx - hit.ax;
          const l = Math.hypot(nx, ny); nx /= l; ny /= l;
          const dot = r.dx * nx + r.dy * ny;
          const rx = r.dx - 2 * dot * nx, ry = r.dy - 2 * dot * ny;
          stack.push({ x: hx + rx * 1e-3, y: hy + ry * 1e-3, dx: rx, dy: ry, mask: refl, depth: d });
        }
        if (pass) stack.push({ x: hx + r.dx * 1e-3, y: hy + r.dy * 1e-3, dx: r.dx, dy: r.dy, mask: pass, depth: d });
      } else if (hit.kind === 'portal') {
        // Téléportation : même position relative sur le portail jumeau, direction tournée d'autant.
        const ex = hit.bx - hit.ax, ey = hit.by - hit.ay;
        const u = ((hx - hit.ax) * ex + (hy - hit.ay) * ey) / (ex * ex + ey * ey);
        const [pax, pay, pbx, pby] = lineEnds(hit.partner);
        const px = pax + (pbx - pax) * u, py = pay + (pby - pay) * u;
        const rot = (hit.partner.angle - hit.obj.angle) * DEG;
        const c = Math.cos(rot), s = Math.sin(rot);
        const ndx = r.dx * c - r.dy * s, ndy = r.dx * s + r.dy * c;
        segments.push({ x1: hx, y1: hy, x2: px, y2: py, mask: r.mask, warp: true });
        stack.push({ x: px + ndx * 1e-2, y: py + ndy * 1e-2, dx: ndx, dy: ndy, mask: r.mask, depth: d });
      } else if (hit.kind === 'filter') {
        const m = r.mask & hit.mask;
        if (m) stack.push({ x: hx + r.dx * 1e-3, y: hy + r.dy * 1e-3, dx: r.dx, dy: r.dy, mask: m, depth: d });
      } else if (hit.kind === 'glass') {
        const entering = r.dx * hit.nx + r.dy * hit.ny < 0;
        // La lumière composée se sépare en entrant dans le prisme.
        const parts = entering ? bits(r.mask) : [r.mask];
        for (const m of parts) {
          const n = IOR[m] || IOR[2];
          const n1 = entering ? 1 : n, n2 = entering ? n : 1;
          const Nx = entering ? hit.nx : -hit.nx, Ny = entering ? hit.ny : -hit.ny;
          const cosI = -(r.dx * Nx + r.dy * Ny);
          const eta = n1 / n2;
          const k = 1 - eta * eta * (1 - cosI * cosI);
          let ox, oy, inside;
          if (k < 0) {
            // Réflexion totale interne.
            ox = r.dx + 2 * cosI * Nx; oy = r.dy + 2 * cosI * Ny;
            inside = !entering;
          } else {
            const c = eta * cosI - Math.sqrt(k);
            ox = eta * r.dx + c * Nx; oy = eta * r.dy + c * Ny;
            inside = entering;
          }
          const l = Math.hypot(ox, oy); ox /= l; oy /= l;
          stack.push({ x: hx + ox * 1e-3, y: hy + oy * 1e-3, dx: ox, dy: oy, mask: m, depth: d, inGlass: inside });
        }
      }
      // 'wall' : la lumière s'arrête.
    }

    // Un capteur « avoid » est satisfait tant qu'il ne reçoit aucune lumière.
    const lit = targets.map((t, i) => (t.avoid ? received[i] === 0 : received[i] === COLOR_MASK[t.color || 'W']));
    return { segments, received, lit, targets, solved: targets.length > 0 && lit.every(Boolean) };
  }

  // Projection d'un point sur un rail [x1,y1,x2,y2].
  function projectOnTrack(track, px, py) {
    const [x1, y1, x2, y2] = track;
    const ex = x2 - x1, ey = y2 - y1;
    let u = ((px - x1) * ex + (py - y1) * ey) / (ex * ex + ey * ey);
    u = Math.max(0, Math.min(1, u));
    return [x1 + ex * u, y1 + ey * u, u];
  }

  const api = { W, H, BORDER, DEG, COLOR_MASK, COLOR_NAME, IOR, trace, prismVertices, lineEnds, projectOnTrack, cloneLevel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LightEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
