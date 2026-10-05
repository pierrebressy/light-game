# Prisme — jeu de lumière

Puzzle de lumière en JavaScript pur. Chaque niveau fournit une **boîte à outils** (miroirs, lames séparatrices,
miroirs dichroïques, filtres, prismes, lentilles convergentes/divergentes, diffuseurs) : glisse les pièces sur le
plateau, place-les où tu veux, tourne-les, pour guider la lumière jusqu'aux drapeaux. 20 niveaux.

**Jouer :** https://pierrebressy.github.io/light-game/

## Lancer en local

```bash
python3 -m http.server 8137
```

puis ouvrir http://localhost:8137.

## Contrôles

- Glisser un outil depuis la barre du bas vers le plateau (ou cliquer dessus : il se pose dans un endroit libre)
- Glisser une pièce posée : déplacement ; la ramener dans la barre (ou double-clic, Suppr) : la ranger
- Poignée orange : rotation (Shift : pas de 15°) ; molette / flèches : réglage fin (Shift : 5°)
- R : recommencer

## Ajouter un niveau

Ajouter une entrée dans `levels.js` (éléments fixes, inventaire `tools` et une `solution` connue), puis vérifier :

```bash
node tools/check-levels.js
```
