# Prisme — jeu de lumière

Puzzle de réflexion en JavaScript pur : oriente miroirs, prismes, filtres, lames séparatrices,
miroirs dichroïques et portails pour guider la lumière jusqu'aux drapeaux. 24 niveaux.

**Jouer :** https://pierrebressy.github.io/light-game/

## Lancer en local

```bash
python3 -m http.server 8137
```

puis ouvrir http://localhost:8137.

## Contrôles

- Glisser autour d'un objet : rotation (Shift : pas de 15°)
- Glisser le centre d'un objet sur rail : déplacement
- Molette / flèches : réglage fin (Shift : 5°), Tab : objet suivant, R : recommencer

## Ajouter un niveau

Ajouter une entrée dans `levels.js`, puis vérifier qu'il est résoluble :

```bash
node tools/check-levels.js
```
