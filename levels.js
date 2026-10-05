// Niveaux « boîte à outils ». Repère logique 800×1000, angles en degrés (0 = droite, sens horaire à l'écran).
// objects  : éléments fixes du niveau (source, wall, target, diffuser, prism, mirror…).
//            target { color } doit recevoir exactement cette couleur ; target { avoid: true } doit rester dans le noir.
// tools    : inventaire du joueur, { type, count, ...propriétés } — mirror, splitter, dichroic {color},
//            filter {color}, prism, lens {f > 0 convergente, f < 0 divergente, len}, diffuser {rays, spread}.
// noPlace  : zones où l'on ne peut pas poser d'outil (optionnel).
// solution : une solution connue (indice d'outil + position + angle), vérifiée par tools/check-levels.js.
// Couleurs : W blanc, R rouge, G vert, B bleu, Y jaune, M magenta, C cyan.
(function (root) {
  'use strict';

  const LEVELS = [
    {
      name: 'Premier miroir',
      hint: 'Glisse le miroir depuis la boîte à outils, puis fais-le tourner avec la poignée orange.',
      objects: [
        { type: 'source', x: 80, y: 880, angle: 0 },
        { type: 'wall', x: 460, y: 600, w: 30, h: 376 },
        { type: 'target', x: 660, y: 250, color: 'W' },
      ],
      tools: [
        { type: 'mirror', count: 1 },
      ],
      solution: [
        { tool: 0, x: 260, y: 880, angle: 151.21 },
      ],
    },
    {
      name: 'Coin de rue',
      hint: 'Un seul miroir ne suffira pas.',
      objects: [
        { type: 'source', x: 80, y: 130, angle: 0 },
        { type: 'wall', x: 24, y: 380, w: 560, h: 30 },
        { type: 'wall', x: 240, y: 640, w: 536, h: 30 },
        { type: 'target', x: 110, y: 520, color: 'W' },
      ],
      tools: [
        { type: 'mirror', count: 2 },
      ],
      solution: [
        { tool: 0, x: 700, y: 130, angle: 45 },
        { tool: 0, x: 700, y: 520, angle: 135 },
      ],
    },
    {
      name: 'Le puits',
      hint: 'La cible est au fond d’un puits étroit.',
      objects: [
        { type: 'source', x: 80, y: 900, angle: -90 },
        { type: 'wall', x: 340, y: 700, w: 30, h: 276 },
        { type: 'wall', x: 430, y: 700, w: 30, h: 276 },
        { type: 'target', x: 400, y: 900, color: 'W' },
      ],
      tools: [
        { type: 'mirror', count: 2 },
      ],
      noPlace: [
        { x: 370, y: 700, w: 60, h: 276 },
      ],
      solution: [
        { tool: 0, x: 80, y: 150, angle: 135 },
        { tool: 0, x: 400, y: 150, angle: 45 },
      ],
    },
    {
      name: 'Slalom',
      hint: 'Les capteurs barrés ne doivent recevoir aucune lumière.',
      objects: [
        { type: 'source', x: 80, y: 500, angle: 0 },
        { type: 'target', x: 400, y: 100, avoid: true },
        { type: 'target', x: 400, y: 300, avoid: true },
        { type: 'target', x: 400, y: 500, avoid: true },
        { type: 'target', x: 400, y: 700, avoid: true },
        { type: 'target', x: 400, y: 900, avoid: true },
        { type: 'target', x: 700, y: 500, color: 'W' },
      ],
      tools: [
        { type: 'mirror', count: 2 },
      ],
      solution: [
        { tool: 0, x: 200, y: 500, angle: 166.72 },
        { tool: 0, x: 600, y: 300, angle: 18.43 },
      ],
    },
    {
      name: 'Le prisme',
      hint: 'Le prisme décompose la lumière. Le drapeau veut du rouge pur.',
      objects: [
        { type: 'source', x: 80, y: 800, angle: 0 },
        { type: 'wall', x: 300, y: 300, w: 30, h: 350 },
        { type: 'target', x: 150, y: 120, color: 'R' },
      ],
      tools: [
        { type: 'prism', count: 1 },
        { type: 'mirror', count: 1 },
      ],
      solution: [
        { tool: 0, x: 250, y: 800, angle: 36 },
        { tool: 1, x: 700, y: 517.82, angle: 92.28 },
      ],
    },
    {
      name: 'Filtre vert',
      hint: 'Un filtre ne laisse passer que sa couleur.',
      objects: [
        { type: 'source', x: 80, y: 150, angle: 0 },
        { type: 'wall', x: 300, y: 300, w: 30, h: 450 },
        { type: 'target', x: 150, y: 850, color: 'G' },
      ],
      tools: [
        { type: 'mirror', count: 2 },
        { type: 'filter', color: 'G', count: 1 },
      ],
      solution: [
        { tool: 0, x: 650, y: 150, angle: 45 },
        { tool: 0, x: 650, y: 850, angle: 135 },
        { tool: 1, x: 650, y: 500, angle: 0 },
      ],
    },
    {
      name: 'Synthèse',
      hint: 'Rouge + vert = jaune.',
      objects: [
        { type: 'source', x: 100, y: 900, angle: -90, color: 'R' },
        { type: 'source', x: 700, y: 900, angle: -90, color: 'G' },
        { type: 'wall', x: 150, y: 480, w: 500, h: 30 },
        { type: 'target', x: 400, y: 180, color: 'Y' },
      ],
      tools: [
        { type: 'mirror', count: 2 },
      ],
      solution: [
        { tool: 0, x: 100, y: 300, angle: 124.1 },
        { tool: 0, x: 700, y: 300, angle: 55.9 },
      ],
    },
    {
      name: 'Tri des couleurs',
      hint: 'Le miroir dichroïque réfléchit sa couleur et laisse passer le reste.',
      objects: [
        { type: 'source', x: 80, y: 500, angle: 0 },
        { type: 'wall', x: 24, y: 650, w: 500, h: 30 },
        { type: 'target', x: 700, y: 120, avoid: true },
        { type: 'target', x: 400, y: 120, color: 'R' },
        { type: 'target', x: 700, y: 880, color: 'C' },
      ],
      tools: [
        { type: 'dichroic', color: 'R', count: 1 },
        { type: 'mirror', count: 1 },
      ],
      solution: [
        { tool: 0, x: 400, y: 500, angle: 135 },
        { tool: 1, x: 700, y: 500, angle: 45 },
      ],
    },
    {
      name: 'Lame séparatrice',
      hint: 'Elle réfléchit ET laisse passer.',
      objects: [
        { type: 'source', x: 80, y: 500, angle: 0 },
        { type: 'wall', x: 200, y: 260, w: 30, h: 160 },
        { type: 'wall', x: 24, y: 640, w: 420, h: 30 },
        { type: 'target', x: 150, y: 120, color: 'W' },
        { type: 'target', x: 650, y: 880, color: 'W' },
      ],
      tools: [
        { type: 'splitter', count: 1 },
        { type: 'mirror', count: 1 },
      ],
      solution: [
        { tool: 0, x: 400, y: 500, angle: 118.33 },
        { tool: 1, x: 700, y: 500, angle: 48.75 },
      ],
    },
    {
      name: 'Point focal',
      hint: 'Une lentille convergente réunit les rayons parallèles en son foyer.',
      objects: [
        { type: 'source', x: 80, y: 420, angle: 0, color: 'R' },
        { type: 'source', x: 80, y: 580, angle: 0, color: 'B' },
        { type: 'wall', x: 590, y: 24, w: 20, h: 451 },
        { type: 'wall', x: 590, y: 525, w: 20, h: 451 },
        { type: 'target', x: 680, y: 500, color: 'M' },
      ],
      tools: [
        { type: 'lens', f: 200, len: 200, count: 1 },
      ],
      solution: [
        { tool: 0, x: 440, y: 500, angle: 90 },
      ],
    },
    {
      name: 'Éventail',
      hint: 'Le diffuseur éclate un rayon en plusieurs : une source, plusieurs cibles.',
      objects: [
        { type: 'source', x: 80, y: 880, angle: 0 },
        { type: 'target', x: 280, y: 171, color: 'W' },
        { type: 'target', x: 400, y: 150, color: 'W' },
        { type: 'target', x: 520, y: 171, color: 'W' },
      ],
      tools: [
        { type: 'diffuser', rays: 3, spread: 40, count: 1 },
        { type: 'mirror', count: 1 },
      ],
      solution: [
        { tool: 0, x: 400, y: 500 },
        { tool: 1, x: 400, y: 880, angle: 135 },
      ],
    },
    {
      name: 'Collimateur',
      hint: 'Diffuseur au foyer d’une lentille → faisceaux parallèles.',
      objects: [
        { type: 'source', x: 80, y: 500, angle: 0 },
        { type: 'diffuser', x: 200, y: 500, rays: 3, spread: 40 },
        { type: 'wall', x: 640, y: 24, w: 20, h: 383 },
        { type: 'wall', x: 640, y: 447, w: 20, h: 33 },
        { type: 'wall', x: 640, y: 520, w: 20, h: 33 },
        { type: 'wall', x: 640, y: 593, w: 20, h: 383 },
        { type: 'target', x: 720, y: 427, color: 'W' },
        { type: 'target', x: 720, y: 500, color: 'W' },
        { type: 'target', x: 720, y: 573, color: 'W' },
      ],
      tools: [
        { type: 'lens', f: 200, len: 200, count: 1 },
      ],
      solution: [
        { tool: 0, x: 400, y: 500, angle: 90 },
      ],
    },
    {
      name: 'Divergente',
      hint: 'Une lentille divergente écarte les rayons.',
      objects: [
        { type: 'source', x: 80, y: 500, angle: 0 },
        { type: 'diffuser', x: 180, y: 500, rays: 3, spread: 16 },
        { type: 'target', x: 700, y: 382, color: 'W' },
        { type: 'target', x: 700, y: 500, color: 'W' },
        { type: 'target', x: 700, y: 618, color: 'W' },
      ],
      tools: [
        { type: 'lens', f: -150, len: 140, count: 1 },
      ],
      solution: [
        { tool: 0, x: 300, y: 500, angle: 90 },
      ],
    },
    {
      name: 'Réducteur de faisceau',
      hint: 'Deux lentilles bien espacées : les faisceaux se rapprochent et restent parallèles.',
      objects: [
        { type: 'source', x: 80, y: 400, angle: 0 },
        { type: 'source', x: 80, y: 600, angle: 0 },
        { type: 'wall', x: 480, y: 24, w: 20, h: 406 },
        { type: 'wall', x: 480, y: 470, w: 20, h: 60 },
        { type: 'wall', x: 480, y: 570, w: 20, h: 406 },
        { type: 'target', x: 740, y: 450, color: 'W' },
        { type: 'target', x: 740, y: 550, color: 'W' },
      ],
      tools: [
        { type: 'lens', f: 200, len: 240, count: 1 },
        { type: 'lens', f: 100, len: 160, count: 1 },
      ],
      solution: [
        { tool: 0, x: 150, y: 500, angle: 90 },
        { tool: 1, x: 450, y: 500, angle: 90 },
      ],
    },
    {
      name: 'Trois drapeaux',
      hint: 'Partage la lumière entre les trois drapeaux.',
      objects: [
        { type: 'source', x: 80, y: 500, angle: 0 },
        { type: 'target', x: 720, y: 880, avoid: true },
        { type: 'target', x: 80, y: 880, avoid: true },
        { type: 'target', x: 250, y: 120, color: 'W' },
        { type: 'target', x: 550, y: 880, color: 'W' },
        { type: 'target', x: 720, y: 120, color: 'W' },
      ],
      tools: [
        { type: 'splitter', count: 2 },
        { type: 'mirror', count: 1 },
      ],
      solution: [
        { tool: 0, x: 250, y: 500, angle: 135 },
        { tool: 0, x: 550, y: 500, angle: 45 },
        { tool: 1, x: 720, y: 500, angle: 135 },
      ],
    },
    {
      name: 'Arc-en-ciel',
      hint: 'Rouge, vert, bleu : chacun chez soi.',
      objects: [
        { type: 'source', x: 80, y: 880, angle: 0 },
        { type: 'target', x: 710, y: 200, color: 'B' },
        { type: 'target', x: 120, y: 300, color: 'G' },
        { type: 'target', x: 120, y: 520, color: 'R' },
      ],
      tools: [
        { type: 'prism', count: 1 },
        { type: 'mirror', count: 2 },
      ],
      solution: [
        { tool: 0, x: 260, y: 880, angle: 36 },
        { tool: 1, x: 480, y: 678.89, angle: 92.35 },
        { tool: 1, x: 740, y: 579.61, angle: 77.09 },
      ],
    },
    {
      name: 'Foyer RVB',
      hint: 'Trois couleurs, une fente, un drapeau blanc.',
      objects: [
        { type: 'source', x: 80, y: 350, angle: 0, color: 'R' },
        { type: 'source', x: 80, y: 500, angle: 0, color: 'G' },
        { type: 'source', x: 80, y: 650, angle: 0, color: 'B' },
        { type: 'wall', x: 590, y: 24, w: 20, h: 446 },
        { type: 'wall', x: 590, y: 530, w: 20, h: 446 },
        { type: 'target', x: 650, y: 500, color: 'W' },
      ],
      tools: [
        { type: 'lens', f: 250, len: 320, count: 1 },
      ],
      solution: [
        { tool: 0, x: 380, y: 500, angle: 90 },
      ],
    },
    {
      name: 'Feu d’artifice',
      hint: 'Cinq drapeaux, cinq fentes, des rayons bien parallèles.',
      objects: [
        { type: 'source', x: 80, y: 500, angle: 0 },
        { type: 'wall', x: 650, y: 24, w: 20, h: 340.53 },
        { type: 'wall', x: 650, y: 404.53, w: 20, h: 21.88 },
        { type: 'wall', x: 650, y: 466.41, w: 20, h: 13.59 },
        { type: 'wall', x: 650, y: 520, w: 20, h: 13.59 },
        { type: 'wall', x: 650, y: 573.59, w: 20, h: 21.88 },
        { type: 'wall', x: 650, y: 635.47, w: 20, h: 340.53 },
        { type: 'target', x: 720, y: 384.53, color: 'W', r: 20 },
        { type: 'target', x: 720, y: 446.41, color: 'W', r: 20 },
        { type: 'target', x: 720, y: 500, color: 'W', r: 20 },
        { type: 'target', x: 720, y: 553.59, color: 'W', r: 20 },
        { type: 'target', x: 720, y: 615.47, color: 'W', r: 20 },
      ],
      tools: [
        { type: 'diffuser', rays: 5, spread: 60, count: 1 },
        { type: 'lens', f: 200, len: 300, count: 1 },
      ],
      solution: [
        { tool: 0, x: 230, y: 500 },
        { tool: 1, x: 430, y: 500, angle: 90 },
      ],
    },
    {
      name: 'Labyrinthe',
      hint: 'Suis les couloirs.',
      objects: [
        { type: 'source', x: 80, y: 150, angle: 0 },
        { type: 'wall', x: 24, y: 250, w: 600, h: 30 },
        { type: 'wall', x: 180, y: 500, w: 596, h: 30 },
        { type: 'wall', x: 24, y: 750, w: 600, h: 30 },
        { type: 'target', x: 700, y: 640, color: 'W' },
      ],
      tools: [
        { type: 'mirror', count: 4 },
      ],
      solution: [
        { tool: 0, x: 700, y: 150, angle: 45 },
        { tool: 0, x: 700, y: 400, angle: 135 },
        { tool: 0, x: 100, y: 400, angle: 135 },
        { tool: 0, x: 100, y: 640, angle: 45 },
      ],
    },
    {
      name: 'Grand final',
      hint: 'Sépare le bleu, éclate-le, redresse-le.',
      objects: [
        { type: 'source', x: 80, y: 880, angle: 0 },
        { type: 'wall', x: 24, y: 230, w: 79.21, h: 20 },
        { type: 'wall', x: 147.21, y: 230, w: 32.79, h: 20 },
        { type: 'wall', x: 220, y: 230, w: 32.79, h: 20 },
        { type: 'wall', x: 292.79, y: 230, w: 483.21, h: 20 },
        { type: 'target', x: 740, y: 880, avoid: true },
        { type: 'target', x: 127.21, y: 150, color: 'B' },
        { type: 'target', x: 200, y: 150, color: 'B' },
        { type: 'target', x: 272.79, y: 150, color: 'B' },
        { type: 'target', x: 650, y: 300, color: 'Y' },
      ],
      tools: [
        { type: 'dichroic', color: 'B', count: 1 },
        { type: 'diffuser', rays: 3, spread: 40, count: 1 },
        { type: 'lens', f: 200, len: 200, count: 1 },
        { type: 'mirror', count: 2 },
      ],
      solution: [
        { tool: 0, x: 200, y: 880, angle: 135 },
        { tool: 1, x: 200, y: 600 },
        { tool: 2, x: 200, y: 400, angle: 0 },
        { tool: 3, x: 650, y: 880, angle: 135 },
      ],
    },
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
  else root.LIGHT_LEVELS = LEVELS;
})(typeof window !== 'undefined' ? window : globalThis);
