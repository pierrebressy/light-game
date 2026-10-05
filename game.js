// Rendu canvas, boîte à outils (glisser-déposer), interactions souris / tactile / clavier, progression.
// Appelé par index.html (après engine.js et levels.js).
(function () {
  'use strict';

  const E = window.LightEngine;
  const LEVELS = window.LIGHT_LEVELS;
  const { W, H, BORDER, DEG } = E;
  const STORE_KEY = 'lightgame.progress.v2';

  const canvas = document.getElementById('game');
  const mainCtx = canvas.getContext('2d');
  let ctx = mainCtx; // remplacé temporairement pour dessiner les icônes de la boîte à outils
  const $ = id => document.getElementById(id);
  const toolbar = $('toolbar');

  // ---------- État ----------
  let levelIndex = 0;
  let level = null;
  let objects = [];
  let result = null;
  let scale = 1, dpr = 1;
  let selected = null, hovered = null, drag = null;
  let solvedAt = 0, winShown = false;
  const progress = loadProgress();

  function loadProgress() {
    try {
      const p = JSON.parse(localStorage.getItem(STORE_KEY));
      if (p && Array.isArray(p.done)) return p;
    } catch (e) { /* stockage indisponible */ }
    return { done: [] };
  }
  function saveProgress() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) { /* ignoré */ }
  }
  const isDone = i => progress.done.includes(i);
  const isUnlocked = i => i === 0 || isDone(i - 1) || isDone(i);

  // ---------- Couleurs ----------
  function maskRGB(mask) {
    if (mask === 7) return [255, 252, 235];
    let r = 0, g = 0, b = 0;
    if (mask & 1) { r += 255; g += 50; b += 50; }
    if (mask & 2) { r += 40; g += 255; b += 80; }
    if (mask & 4) { r += 60; g += 110; b += 255; }
    return [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
  }
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const COLOR_LABEL = { R: 'rouge', G: 'vert', B: 'bleu', Y: 'jaune', M: 'magenta', C: 'cyan', W: 'blanc' };

  // ---------- Motif de briques ----------
  const brick = (() => {
    const c = document.createElement('canvas');
    c.width = 48; c.height = 24;
    const g = c.getContext('2d');
    g.fillStyle = '#3a0d0b';
    g.fillRect(0, 0, 48, 24);
    const tones = ['#9b2a22', '#a8322a', '#8c241d', '#b13a2f'];
    [0, 12].forEach((y, r) => {
      for (let x = (r ? -12 : 0); x < 48; x += 24) {
        g.fillStyle = tones[((x + 12) / 12 + r * 3) % tones.length];
        g.fillRect(x + 1, y + 1, 22, 10);
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(x + 1, y + 1, 22, 2);
      }
    });
    return c;
  })();
  let brickPattern = null;

  // ---------- Niveau ----------
  const isInteractive = o => o.placed || o.rotatable || !!o.track;
  const canRotate = o => !!o.rotatable;

  function loadLevel(i) {
    levelIndex = Math.max(0, Math.min(LEVELS.length - 1, i));
    level = LEVELS[levelIndex];
    objects = E.cloneLevel(level.objects);
    selected = null; hovered = null; drag = null;
    solvedAt = 0; winShown = false;
    $('lvl-num').textContent = `Niveau ${levelIndex + 1} / ${LEVELS.length}`;
    $('lvl-name').textContent = level.name;
    $('hint').textContent = level.hint || '';
    $('btn-prev').disabled = levelIndex === 0;
    $('btn-next').disabled = levelIndex === LEVELS.length - 1 || !isUnlocked(levelIndex + 1);
    hideOverlays();
    try { history.replaceState(null, '', `#${levelIndex + 1}`); } catch (e) { /* file:// */ }
    buildToolbar();
    resize();
    update();
  }

  function update() {
    result = E.trace(objects);
    if (result.solved && !solvedAt && !drag) {
      solvedAt = performance.now();
      if (!isDone(levelIndex)) { progress.done.push(levelIndex); saveProgress(); }
      $('btn-next').disabled = levelIndex === LEVELS.length - 1;
      chime();
      setTimeout(showWin, 900);
    }
  }

  // ---------- Boîte à outils ----------
  function toolLabel(t) {
    switch (t.type) {
      case 'mirror': return 'Miroir';
      case 'splitter': return 'Lame';
      case 'dichroic': return `Dichro. ${COLOR_LABEL[t.color || 'R']}`;
      case 'filter': return `Filtre ${COLOR_LABEL[t.color || 'G']}`;
      case 'prism': return 'Prisme';
      case 'lens': { const f = t.f || 200; return `Lentille ${f > 0 ? '+' : '−'}${Math.abs(f)}`; }
      case 'diffuser': return `Diffuseur ×${t.rays || 3}`;
      default: return t.type;
    }
  }
  function toolTitle(t) {
    switch (t.type) {
      case 'mirror': return 'Miroir : réfléchit la lumière';
      case 'splitter': return 'Lame séparatrice : réfléchit et laisse passer';
      case 'dichroic': return `Miroir dichroïque : réfléchit le ${COLOR_LABEL[t.color || 'R']}, laisse passer le reste`;
      case 'filter': return `Filtre : ne laisse passer que le ${COLOR_LABEL[t.color || 'G']}`;
      case 'prism': return 'Prisme : décompose la lumière blanche';
      case 'lens': return (t.f || 200) > 0 ? `Lentille convergente, focale ${t.f || 200}` : `Lentille divergente, focale ${t.f}`;
      case 'diffuser': return `Diffuseur : éclate un rayon en ${t.rays || 3} rayons sur ${t.spread || 40}°`;
      default: return t.type;
    }
  }

  const usedCount = k => objects.filter(o => o.placed && o.tool === k).length;

  function buildToolbar() {
    toolbar.innerHTML = '';
    (level.tools || []).forEach((t, k) => {
      const b = document.createElement('button');
      b.className = 'tool';
      b.title = `${toolTitle(t)} — glisse-le sur le plateau`;
      b.dataset.tool = k;
      const c = document.createElement('canvas');
      c.width = 88; c.height = 88;
      drawToolIcon(c, t);
      const label = document.createElement('span');
      label.textContent = toolLabel(t);
      const badge = document.createElement('b');
      b.append(c, label, badge);
      b.addEventListener('pointerdown', e => startToolDrag(e, k));
      toolbar.appendChild(b);
    });
    refreshToolbar();
  }

  function refreshToolbar() {
    toolbar.querySelectorAll('.tool').forEach(b => {
      const k = Number(b.dataset.tool);
      const left = level.tools[k].count - usedCount(k);
      b.querySelector('b').textContent = `×${left}`;
      b.classList.toggle('empty', left <= 0);
    });
  }

  function drawToolIcon(c, t) {
    const g = c.getContext('2d');
    const piece = E.makePiece(t, 0, 0);
    if (piece.type === 'lens' || piece.type === 'filter') piece.angle = 90;
    const extent = piece.type === 'prism' ? piece.size * 1.9
      : piece.type === 'diffuser' ? 70 : Math.max(60, piece.len || 80);
    const s = Math.min(1.2, 72 / extent);
    g.setTransform(s, 0, 0, s, 44, 44);
    const saved = ctx;
    ctx = g;
    if (piece.type === 'diffuser') drawFanPreview(piece);
    drawPiece(piece, 0, true);
    ctx = saved;
  }

  // ---------- Dimensionnement ----------
  function resize() {
    const main = canvas.parentElement;
    const availW = main.clientWidth - 16, availH = main.clientHeight - 4;
    scale = Math.max(0.1, Math.min(availW / W, availH / H));
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.style.width = `${W * scale}px`;
    canvas.style.height = `${H * scale}px`;
    canvas.width = Math.round(W * scale * dpr);
    canvas.height = Math.round(H * scale * dpr);
    brickPattern = mainCtx.createPattern(brick, 'repeat');
  }

  // ---------- Dessin ----------
  function draw(now) {
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    drawNoPlace();
    drawWalls();
    for (const o of objects) if (o.track) drawTrack(o);
    drawBeams(now);
    for (const o of objects) if (o.type !== 'target' && o.type !== 'wall') drawPiece(o, now, false);
    result.targets.forEach((t, i) => drawTarget(t, result.received[i], result.lit[i], now));
    const ui = drag ? drag.obj : (hovered || selected);
    if (ui && !solvedAt && objects.includes(ui)) drawHandle(ui);
  }

  function drawPiece(o, now, icon) {
    if (o.invalid) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,60,60,0.18)';
      ctx.strokeStyle = 'rgba(255,80,80,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(o.x, o.y, pieceRadius(o), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    switch (o.type) {
      case 'prism': drawPrism(o); break;
      case 'mirror': drawMirror(o, false); break;
      case 'splitter': drawMirror(o, true); break;
      case 'filter': drawFilter(o); break;
      case 'dichroic': drawDichroic(o); break;
      case 'portal': drawPortal(o, now); break;
      case 'lens': drawLens(o); break;
      case 'diffuser': drawDiffuser(o, now); break;
      case 'source': drawSource(o); break;
    }
    if (!icon && o.placed) drawPivot(o);
  }

  function drawNoPlace() {
    if (!level.noPlace) return;
    ctx.save();
    for (const z of level.noPlace) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.beginPath();
      ctx.rect(z.x, z.y, z.w, z.h);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 2;
      for (let d = -z.h; d < z.w; d += 14) {
        ctx.beginPath(); ctx.moveTo(z.x + d, z.y + z.h); ctx.lineTo(z.x + d + z.h, z.y); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function wallRect(x, y, w, h) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,40,30,0.35)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = brickPattern;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  function drawWalls() {
    wallRect(0, 0, W, BORDER);
    wallRect(0, H - BORDER, W, BORDER);
    wallRect(0, 0, BORDER, H);
    wallRect(W - BORDER, 0, BORDER, H);
    for (const o of objects) if (o.type === 'wall') wallRect(o.x, o.y, o.w, o.h);
  }

  function drawBeams(now) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const flicker = 0.92 + 0.08 * Math.sin(now / 90);
    for (const [width, alpha] of [[30, 0.05], [14, 0.14], [3.5, 0.9]]) {
      const core = width < 4;
      ctx.lineWidth = width;
      for (const s of result.segments) {
        if (s.warp) continue;
        const c = maskRGB(s.mask);
        ctx.strokeStyle = rgba(core ? c.map(v => Math.round(v * 0.6 + 102)) : c, alpha * (core ? 1 : flicker) * (s.inGlass ? 0.7 : 1));
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawTrack(o) {
    const [x1, y1, x2, y2] = o.track;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,178,63,0.18)';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,178,63,0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.stroke();
    ctx.restore();
  }

  function drawMirror(o, splitter) {
    const [ax, ay, bx, by] = E.lineEnds(o);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    if (splitter) {
      ctx.strokeStyle = 'rgba(140,200,255,0.35)';
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(200,235,255,0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.stroke();
    } else {
      const g = ctx.createLinearGradient(ax, ay, bx, by);
      g.addColorStop(0, '#8d97a3'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#8d97a3');
      ctx.strokeStyle = '#2b3038';
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.strokeStyle = g;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.restore();
    if (!o.placed) drawPivot(o);
  }

  function drawPivot(o) {
    const active = isInteractive(o);
    ctx.save();
    ctx.fillStyle = active ? '#ffb23f' : '#555c66';
    ctx.beginPath(); ctx.arc(o.x, o.y, active ? 5 : 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawFilter(o) {
    const [ax, ay, bx, by] = E.lineEnds(o);
    const c = maskRGB(E.COLOR_MASK[o.color]);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    ctx.shadowColor = rgba(c, 0.8);
    ctx.shadowBlur = 12;
    ctx.strokeStyle = rgba(c, 0.5);
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(c, 0.95);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawDichroic(o) {
    const [ax, ay, bx, by] = E.lineEnds(o);
    const c = maskRGB(E.COLOR_MASK[o.color]);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    ctx.strokeStyle = '#2b3038';
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.shadowColor = rgba(c, 0.9);
    ctx.shadowBlur = 10;
    ctx.strokeStyle = rgba(c, 0.95);
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 6]);
    ctx.stroke();
    ctx.restore();
  }

  // Lentille : biconvexe (convergente) ou biconcave (divergente), dans le repère de la lentille.
  function drawLens(o) {
    const L = (o.len || 140) / 2, conv = (o.f || 200) > 0;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.angle * DEG);
    ctx.beginPath();
    if (conv) {
      const T = Math.min(22, 8 + L * 0.08);
      ctx.moveTo(-L, 0);
      ctx.quadraticCurveTo(0, -2 * T, L, 0);
      ctx.quadraticCurveTo(0, 2 * T, -L, 0);
    } else {
      const T = 12;
      ctx.moveTo(-L, -T);
      ctx.quadraticCurveTo(0, -2, L, -T);
      ctx.lineTo(L, T);
      ctx.quadraticCurveTo(0, 2, -L, T);
      ctx.closePath();
    }
    const g = ctx.createLinearGradient(0, -20, 0, 20);
    g.addColorStop(0, 'rgba(170,215,255,0.32)'); g.addColorStop(0.5, 'rgba(220,240,255,0.12)'); g.addColorStop(1, 'rgba(170,215,255,0.32)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(215,238,255,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawDiffuser(o, now) {
    const r = o.r || 16;
    ctx.save();
    ctx.translate(o.x, o.y);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.2);
    glow.addColorStop(0, 'rgba(255,255,255,0.35)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(now / 3000);
    ctx.beginPath();
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6, rr = k % 2 ? r * 0.55 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(225,240,255,0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,250,255,0.95)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // Petit éventail dessiné derrière l'icône du diffuseur.
  function drawFanPreview(o) {
    const n = o.rays || 3, spread = (o.spread || 40) * DEG;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,250,230,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(0, 0); ctx.stroke();
    for (let k = 0; k < n; k++) {
      const a = n === 1 ? 0 : -spread / 2 + (k * spread) / (n - 1);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 34); ctx.stroke();
    }
    ctx.restore();
  }

  function portalHue(o) {
    const key = [o.id, o.link].sort().join('');
    let h = 0;
    for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return (h * 7 + 270) % 360;
  }

  function drawPortal(o, now) {
    const [ax, ay, bx, by] = E.lineEnds(o);
    const hue = portalHue(o);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    ctx.shadowColor = `hsl(${hue},100%,60%)`;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = `hsla(${hue},100%,55%,0.45)`;
    ctx.lineWidth = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `hsl(${hue},100%,75%)`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 6]);
    ctx.lineDashOffset = -now / 40;
    ctx.stroke();
    ctx.restore();
  }

  function drawPrism(o) {
    const v = E.prismVertices(o);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(v[0][0], v[0][1]); ctx.lineTo(v[1][0], v[1][1]); ctx.lineTo(v[2][0], v[2][1]); ctx.closePath();
    const g = ctx.createLinearGradient(v[0][0], v[0][1], v[2][0], v[2][1]);
    g.addColorStop(0, 'rgba(190,225,255,0.18)'); g.addColorStop(1, 'rgba(190,225,255,0.04)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(210,235,255,0.85)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function drawSource(o) {
    const c = maskRGB(E.COLOR_MASK[o.color || 'W']);
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.angle * DEG);
    const body = ctx.createLinearGradient(0, -14, 0, 14);
    body.addColorStop(0, '#9aa1aa'); body.addColorStop(0.5, '#5d636b'); body.addColorStop(1, '#2f3338');
    ctx.fillStyle = body;
    roundRect(-30, -12, 44, 24, 5); ctx.fill();
    ctx.fillStyle = '#3c4148';
    roundRect(10, -16, 18, 32, 4); ctx.fill();
    ctx.fillStyle = rgba(c, 1);
    ctx.shadowColor = rgba(c, 1);
    ctx.shadowBlur = 16;
    roundRect(25, -13, 5, 26, 2); ctx.fill();
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawAvoid(t, received, now) {
    const r = t.r || 26;
    const hit = received !== 0;
    const blink = hit ? 0.6 + 0.4 * Math.sin(now / 70) : 1;
    ctx.save();
    if (hit) {
      const glow = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, r * 2.6);
      glow.addColorStop(0, `rgba(255,40,40,${0.5 * blink})`);
      glow.addColorStop(1, 'rgba(255,40,40,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(t.x, t.y, r * 2.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = hit ? `rgba(120,10,10,${blink})` : '#140606';
    ctx.strokeStyle = hit ? '#ff4b4b' : '#8a2b2b';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = hit ? '#ffd0d0' : '#c04545';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    const k = r * 0.45;
    ctx.beginPath();
    ctx.moveTo(t.x - k, t.y - k); ctx.lineTo(t.x + k, t.y + k);
    ctx.moveTo(t.x + k, t.y - k); ctx.lineTo(t.x - k, t.y + k);
    ctx.stroke();
    ctx.restore();
  }

  function drawTarget(t, received, lit, now) {
    if (t.avoid) { drawAvoid(t, received, now); return; }
    const r = t.r || 26;
    const want = maskRGB(E.COLOR_MASK[t.color || 'W']);
    ctx.save();
    if (lit) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 160);
      const glow = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, r * 3);
      glow.addColorStop(0, rgba(want, 0.55));
      glow.addColorStop(1, rgba(want, 0));
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(t.x, t.y, r * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(want, 0.75 + 0.25 * pulse);
      ctx.beginPath(); ctx.arc(t.x, t.y, r - 4, 0, Math.PI * 2); ctx.fill();
    } else if (received) {
      // Mauvaise couleur : on montre ce qui arrive.
      ctx.fillStyle = rgba(maskRGB(received), 0.25);
      ctx.beginPath(); ctx.arc(t.x, t.y, r - 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowColor = rgba(want, 0.9);
    ctx.shadowBlur = lit ? 24 : 10;
    ctx.strokeStyle = rgba(want, lit ? 1 : 0.85);
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#d9d9d9';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(t.x, t.y + 6); ctx.lineTo(t.x, t.y - r - 34); ctx.stroke();
    const wave = lit ? Math.sin(now / 120) * 4 : 0;
    ctx.fillStyle = lit ? rgba(want, 1) : '#9a9a9a';
    ctx.beginPath();
    ctx.moveTo(t.x + 1.5, t.y - r - 34);
    ctx.quadraticCurveTo(t.x + 22, t.y - r - 38 + wave, t.x + 42, t.y - r - 34);
    ctx.lineTo(t.x + 1.5, t.y - r - 18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Rapporteur + poignée orange + angle, foyers des lentilles.
  function drawHandle(o) {
    ctx.save();
    if (o.type === 'lens') {
      const f = o.f || 200;
      const nx = -Math.sin(o.angle * DEG), ny = Math.cos(o.angle * DEG);
      ctx.fillStyle = f > 0 ? '#8fd3ff' : '#c9a4ff';
      ctx.font = '600 13px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const s of [-1, 1]) {
        const fx = o.x + nx * f * s, fy = o.y + ny * f * s;
        ctx.beginPath(); ctx.arc(fx, fy, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillText('F', fx, fy - 9);
      }
    }
    if (canRotate(o)) {
      const R = handleRadius(o);
      const a = o.angle * DEG;
      ctx.strokeStyle = 'rgba(255,178,63,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(o.x, o.y, R, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,178,63,0.5)';
      for (let k = 0; k < 36; k++) {
        const t = k * 10 * DEG, l = k % 9 === 0 ? 10 : 5;
        ctx.beginPath();
        ctx.moveTo(o.x + Math.cos(t) * R, o.y + Math.sin(t) * R);
        ctx.lineTo(o.x + Math.cos(t) * (R - l), o.y + Math.sin(t) * (R - l));
        ctx.stroke();
      }
      const hx = o.x + Math.cos(a) * R, hy = o.y + Math.sin(a) * R;
      ctx.fillStyle = '#ffb23f';
      ctx.shadowColor = '#ffb23f'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(hx, hy, 10, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      const period = o.type === 'source' || o.type === 'portal' ? 360 : o.type === 'prism' ? 120 : 180;
      const shown = ((-o.angle % period) + period) % period;
      ctx.font = '600 15px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd08a';
      const ty = o.y - R - 12 < 40 ? o.y + R + 22 : o.y - R - 10;
      ctx.fillText(`${shown.toFixed(1)}°`, o.x, ty);
    }
    if (o.placed || o.track) {
      ctx.strokeStyle = '#ffb23f';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(o.x, o.y, 14, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function handleRadius(o) {
    if (o.type === 'prism') return (o.size || 55) + 22;
    if (o.type === 'source') return 50;
    return (o.len || 80) / 2 + 18;
  }

  function pieceRadius(o) {
    if (o.type === 'prism') return (o.size || 55) + 6;
    if (o.type === 'diffuser') return (o.r || 16) + 10;
    return (o.len || 80) / 2 + 6;
  }

  // Distance d'un point au « corps » d'une pièce (pour la saisir et la déplacer).
  function bodyDistance(o, x, y) {
    if (o.type === 'prism') return Math.max(0, Math.hypot(x - o.x, y - o.y) - (o.size || 55) * 0.6);
    if (o.type === 'diffuser') return Math.max(0, Math.hypot(x - o.x, y - o.y) - (o.r || 16));
    const [ax, ay, bx, by] = E.lineEnds(o);
    const ex = bx - ax, ey = by - ay;
    const u = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey)));
    return Math.hypot(x - ax - ex * u, y - ay - ey * u);
  }

  // ---------- Interaction ----------
  function toWorld(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return [(clientX - r.left) / scale, (clientY - r.top) / scale];
  }
  const touchSlop = () => Math.max(16, 22 / scale);

  // Que vise le pointeur ? → { obj, mode: 'rotate' | 'move' } ou null.
  function pick(x, y) {
    const slop = touchSlop();
    // 1) Poignée de rotation de l'objet actif (prioritaire).
    const cands = objects.filter(isInteractive);
    const active = [selected, hovered].filter(o => o && cands.includes(o));
    for (const o of active) {
      if (!canRotate(o)) continue;
      const R = handleRadius(o), a = o.angle * DEG;
      if (Math.hypot(x - (o.x + Math.cos(a) * R), y - (o.y + Math.sin(a) * R)) < slop) return { obj: o, mode: 'rotate' };
    }
    // 2) Corps d'une pièce posée ou sur rail → déplacement.
    let best = null, bestD = Infinity;
    for (const o of cands) {
      if (!o.placed && !o.track) continue;
      const d = bodyDistance(o, x, y);
      if (d < slop && d < bestD) { best = o; bestD = d; }
    }
    if (best) return { obj: best, mode: 'move' };
    // 3) Couronne autour d'une pièce rotative → rotation.
    for (const o of cands) {
      if (!canRotate(o)) continue;
      if (Math.hypot(x - o.x, y - o.y) < handleRadius(o) + slop * 0.6) return { obj: o, mode: 'rotate' };
    }
    return null;
  }

  function beginDrag(target, x, y, pointerId, fromToolbar) {
    const o = target.obj;
    selected = o;
    if (target.mode === 'move') {
      drag = { obj: o, mode: 'move', dx: o.x - x, dy: o.y - y, ox: o.x, oy: o.y, fromToolbar, moved: false, pointerId };
    } else {
      drag = { obj: o, mode: 'rotate', start: Math.atan2(y - o.y, x - o.x), angle0: o.angle, pointerId };
    }
    canvas.style.cursor = 'grabbing';
  }

  canvas.addEventListener('pointerdown', e => {
    if (solvedAt || drag) return;
    const [x, y] = toWorld(e.clientX, e.clientY);
    const target = pick(x, y);
    if (!target) { selected = null; return; }
    beginDrag(target, x, y, e.pointerId, false);
    e.preventDefault();
  });

  function startToolDrag(e, k) {
    e.preventDefault();
    if (solvedAt || drag) return;
    if (level.tools[k].count - usedCount(k) <= 0) return;
    const [x, y] = toWorld(e.clientX, e.clientY);
    const piece = E.makePiece(level.tools[k], x, y);
    piece.tool = k;
    objects.push(piece);
    beginDrag({ obj: piece, mode: 'move' }, x, y, e.pointerId, true);
    drag.startClient = [e.clientX, e.clientY];
    piece.invalid = !E.placementOK(level, objects, piece);
    toolbar.classList.add('drop');
    refreshToolbar();
    update();
  }

  window.addEventListener('pointermove', e => {
    if (!drag) {
      if (e.target !== canvas) return;
      const [x, y] = toWorld(e.clientX, e.clientY);
      const t = solvedAt ? null : pick(x, y);
      hovered = t ? t.obj : null;
      canvas.style.cursor = t ? (t.mode === 'move' ? 'move' : 'grab') : 'default';
      return;
    }
    if (e.pointerId !== drag.pointerId) return;
    const [x, y] = toWorld(e.clientX, e.clientY);
    const o = drag.obj;
    if (drag.mode === 'move') {
      if (o.track) {
        const [px, py] = E.projectOnTrack(o.track, x + drag.dx, y + drag.dy);
        o.x = px; o.y = py;
      } else {
        o.x = x + drag.dx; o.y = y + drag.dy;
        o.invalid = !E.placementOK(level, objects, o);
      }
      drag.moved = true;
      if (o.placed) toolbar.classList.toggle('drop', overToolbar(e) || drag.fromToolbar);
    } else {
      const a = Math.atan2(y - o.y, x - o.x);
      let deg = drag.angle0 + (a - drag.start) / DEG;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      o.angle = normAngle(deg);
    }
    update();
  });

  function overToolbar(e) {
    const r = toolbar.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top - 8 && e.clientY <= r.bottom;
  }
  function overCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }

  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.pointerId)) return;
    const o = drag.obj;
    if (drag.mode === 'move' && o.placed) {
      const tap = drag.fromToolbar && e && Math.hypot(e.clientX - drag.startClient[0], e.clientY - drag.startClient[1]) < 8;
      if (tap) {
        // Simple clic sur un outil : on le pose dans un endroit libre.
        const spot = findFreeSpot(o);
        if (spot) { o.x = spot[0]; o.y = spot[1]; o.invalid = false; } else removePiece(o);
      } else if (e && (overToolbar(e) || !overCanvas(e))) {
        removePiece(o);
      } else if (o.invalid) {
        if (drag.fromToolbar) removePiece(o);
        else { o.x = drag.ox; o.y = drag.oy; }
      }
      delete o.invalid;
    }
    drag = null;
    toolbar.classList.remove('drop');
    canvas.style.cursor = 'default';
    refreshToolbar();
    update();
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  function removePiece(o) {
    objects = objects.filter(p => p !== o);
    if (selected === o) selected = null;
    if (hovered === o) hovered = null;
  }

  // Cherche, en spirale depuis le centre du plateau, un emplacement autorisé.
  function findFreeSpot(o) {
    for (let r = 0; r < 500; r += 20) {
      const steps = Math.max(1, Math.round((2 * Math.PI * r) / 40));
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        o.x = W / 2 + Math.cos(a) * r; o.y = H / 2 + Math.sin(a) * r;
        if (E.placementOK(level, objects, o)) return [o.x, o.y];
      }
    }
    return null;
  }

  canvas.addEventListener('pointerleave', () => { if (!drag) hovered = null; });

  canvas.addEventListener('dblclick', e => {
    if (solvedAt) return;
    const [x, y] = toWorld(e.clientX, e.clientY);
    const t = pick(x, y);
    if (t && t.obj.placed) { removePiece(t.obj); refreshToolbar(); update(); }
  });

  canvas.addEventListener('wheel', e => {
    const o = hovered || selected;
    if (!o || !objects.includes(o) || solvedAt || !(canRotate(o) || o.track)) return;
    e.preventDefault();
    nudge(o, Math.sign(e.deltaY) * (e.shiftKey ? 5 : 0.5));
  }, { passive: false });

  function nudge(o, amount) {
    if (canRotate(o)) o.angle = normAngle(o.angle + amount);
    else if (o.track) {
      const [x1, y1, x2, y2] = o.track;
      const len = Math.hypot(x2 - x1, y2 - y1);
      const [, , u] = E.projectOnTrack(o.track, o.x, o.y);
      const nu = Math.max(0, Math.min(1, u + amount * 2 / len));
      o.x = x1 + (x2 - x1) * nu; o.y = y1 + (y2 - y1) * nu;
    }
    update();
  }

  const normAngle = a => ((a % 360) + 360) % 360;

  window.addEventListener('keydown', e => {
    if ($('menu').classList.contains('show')) { if (e.key === 'Escape') hideOverlays(); return; }
    if ($('win').classList.contains('show')) { if (e.key === 'Enter') { e.preventDefault(); goNext(); } return; }
    if (e.key === 'r' || e.key === 'R') { loadLevel(levelIndex); return; }
    if (!selected || !objects.includes(selected) || solvedAt) return;
    const step = e.shiftKey ? 5 : 0.5;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected.placed) {
      e.preventDefault(); removePiece(selected); refreshToolbar(); update();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); nudge(selected, -step); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); nudge(selected, step); }
  });

  // ---------- UI ----------
  function hideOverlays() {
    $('win').classList.remove('show');
    $('menu').classList.remove('show');
  }

  function showWin() {
    if (winShown || !solvedAt) return;
    winShown = true;
    const last = levelIndex === LEVELS.length - 1;
    $('win-text').textContent = last
      ? 'Tous les niveaux sont terminés. Bravo !'
      : `« ${level.name} » réussi.`;
    $('win-next').textContent = last ? 'Niveaux' : 'Niveau suivant';
    $('win').classList.add('show');
    $('win-next').focus();
  }

  function goNext() {
    if (levelIndex === LEVELS.length - 1) { hideOverlays(); openMenu(); }
    else loadLevel(levelIndex + 1);
  }

  function openMenu() {
    const grid = $('level-grid');
    grid.innerHTML = '';
    LEVELS.forEach((lvl, i) => {
      const b = document.createElement('button');
      b.innerHTML = `${i + 1}<small>${isDone(i) ? '★ réussi' : isUnlocked(i) ? 'ouvert' : 'verrouillé'}</small>`;
      b.title = lvl.name;
      b.disabled = !isUnlocked(i);
      if (isDone(i)) b.classList.add('done');
      if (i === levelIndex) b.classList.add('current');
      b.addEventListener('click', () => loadLevel(i));
      grid.appendChild(b);
    });
    $('menu').classList.add('show');
  }

  $('btn-menu').addEventListener('click', openMenu);
  $('menu-close').addEventListener('click', hideOverlays);
  $('btn-reset').addEventListener('click', () => loadLevel(levelIndex));
  $('btn-prev').addEventListener('click', () => loadLevel(levelIndex - 1));
  $('btn-next').addEventListener('click', () => loadLevel(levelIndex + 1));
  $('win-next').addEventListener('click', goNext);
  $('win-replay').addEventListener('click', () => loadLevel(levelIndex));
  $('menu').addEventListener('click', e => { if (e.target === $('menu')) hideOverlays(); });

  // ---------- Son ----------
  let audio = null;
  function chime() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audio.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        const osc = audio.createOscillator(), gain = audio.createGain();
        const t = t0 + i * 0.09;
        osc.type = 'sine';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.connect(gain).connect(audio.destination);
        osc.start(t);
        osc.stop(t + 0.65);
      });
    } catch (e) { /* audio indisponible */ }
  }

  // ---------- Démarrage ----------
  function frame(now) {
    draw(now);
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  const fromHash = parseInt(location.hash.slice(1), 10) - 1;
  let start = 0;
  if (fromHash >= 0 && fromHash < LEVELS.length && isUnlocked(fromHash)) start = fromHash;
  else while (start < LEVELS.length - 1 && isDone(start)) start++;
  loadLevel(start);
  requestAnimationFrame(frame);

  // Accès debug depuis la console : place la solution connue du niveau courant.
  window.lightGame = {
    loadLevel, update,
    get objects() { return objects; },
    solve() {
      for (const s of level.solution || []) {
        const p = E.makePiece(level.tools[s.tool], s.x, s.y, s.angle);
        p.tool = s.tool;
        objects.push(p);
      }
      refreshToolbar();
      update();
    },
  };
})();
