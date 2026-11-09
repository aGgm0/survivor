# CLAUDE.md — Survivor (nom provisoire) <!-- TODO: vrai nom du jeu -->

> Jeu navigateur de type **"Survivor"** (bullet heaven / roguelite, à la Vampire Survivors / Brotato / 20 Minutes Till Dawn).
> Le joueur se déplace, **les armes tirent automatiquement**, il survit à des vagues d'ennemis de plus en plus fortes et choisit des upgrades à chaque level up.

Ce fichier est lu par Claude Code au début de chaque session. Il décrit **quoi** construire, **comment** le code est organisé et **comment travailler avec moi**.
Légende : `TODO` = à décider / compléter · `[MVP]` = indispensable pour la v1 · `[LATER]` = après la v1.

---

## Sommaire

1. [Le projet en bref](#1-le-projet-en-bref)
2. [Stack technique](#2-stack-technique)
3. [Commandes](#3-commandes)
4. [Architecture & dossiers](#4-architecture--dossiers)
5. [Game design](#5-game-design)
6. [Règles techniques (perf & game loop)](#6-règles-techniques-perf--game-loop)
7. [Conventions de code](#7-conventions-de-code)
8. [Comment travailler avec moi](#8-comment-travailler-avec-moi)
9. [Roadmap](#9-roadmap)
10. [À ne PAS faire](#10-à-ne-pas-faire)
11. [Journal des décisions](#11-journal-des-décisions)
12. [Glossaire](#12-glossaire)

---

## 1. Le projet en bref

| Élément | Valeur |
|---|---|
| Genre | Survivor / bullet heaven, roguelite |
| Plateforme | Navigateur desktop (Chrome, Firefox). Mobile = `[LATER]` |
| Contrôles | Clavier (ZQSD + flèches). Manette = `[LATER]` |
| Durée d'une run | 10 min pour le MVP |
| Univers / thème | Provisoire : magie / fantasy (un mage qui survit à des hordes). <!-- TODO: à affiner --> |
| Style graphique | Formes géométriques simples au début (placeholder), améliorables ensuite (sprites) |
| Résolution logique | 1280×720, mise à l'échelle au viewport (letterbox) |
| Objectif perso | Projet portfolio + apprendre l'archi d'un jeu (game loop, ECS-light, perf) |

**Pitch en une phrase :** <!-- TODO: ex. "Un nécromancien survit 10 minutes dans un cimetière maudit en invoquant des armes spectrales." -->

**Le MVP est atteint quand :** on peut lancer une run, se déplacer, tuer des ennemis avec 3 armes auto, ramasser de l'XP, choisir des upgrades au level up, mourir ou survivre jusqu'au timer, et relancer une partie.

---

## 2. Stack technique

| Couche | Choix | Pourquoi |
|---|---|---|
| Langage | **TypeScript** (strict) | Typage = moins de bugs, meilleur pour Claude Code et le CV |
| Build / dev server | **Vite** | Rapide, zéro config, hot reload |
| Rendu | **Canvas 2D natif** (pas de moteur) | Comprendre la game loop soi-même. Si perf insuffisante → envisager PixiJS |
| UI (menus, HUD) | HTML/CSS par-dessus le canvas | Plus simple qu'un HUD dessiné en canvas |
| Tests | **Vitest** | Tester la logique pure (dégâts, XP, spawn) |
| Lint / format | ESLint + Prettier | |
| Sauvegarde | `localStorage` (méta-progression, settings) | Pas de backend |
| Déploiement | Local uniquement pour l'instant (`npm run dev`) | En ligne = Phase 5 |

> Tranché : **Canvas natif** plutôt que Phaser 3 (voir Journal des décisions).

Aucune dépendance runtime supplémentaire sans me demander.

---

## 3. Commandes

```bash
npm install        # installer
npm run dev        # serveur de dev (http://localhost:5173)
npm run build      # build de prod dans dist/
npm run preview    # tester le build
npm run test       # tests Vitest
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

Avant de dire qu'une tâche est finie : `npm run typecheck && npm run lint && npm run test` doivent passer.

---

## 4. Architecture & dossiers

```
/
├── CLAUDE.md
├── index.html
├── public/
│   └── assets/            # sprites, sons, fonts
├── src/
│   ├── main.ts            # point d'entrée : crée le Game et lance la loop
│   ├── core/              # moteur maison, indépendant du gameplay
│   │   ├── Game.ts        # game loop (fixed timestep), gestion des scènes
│   │   ├── Input.ts       # état clavier
│   │   ├── Renderer.ts    # wrapper canvas, caméra
│   │   ├── Pool.ts        # object pooling générique
│   │   ├── SpatialGrid.ts # partition spatiale pour les collisions
│   │   └── math.ts        # Vec2, clamp, lerp, random seedé
│   ├── scenes/            # MenuScene, GameScene, LevelUpScene, GameOverScene
│   ├── entities/          # Player, Enemy, Projectile, XpGem, Pickup
│   ├── systems/           # logique qui agit sur des groupes d'entités
│   │   ├── MovementSystem.ts
│   │   ├── CollisionSystem.ts
│   │   ├── SpawnSystem.ts     # vagues d'ennemis
│   │   ├── WeaponSystem.ts    # tir automatique
│   │   └── XpSystem.ts        # XP, level up
│   ├── data/              # ⭐ données de jeu (data-driven)
│   │   ├── weapons.ts
│   │   ├── enemies.ts
│   │   ├── upgrades.ts
│   │   └── waves.ts
│   ├── ui/                # HUD et menus en HTML/CSS
│   └── types/             # types partagés
└── tests/                 # tests Vitest (logique pure)
```

**Principes d'archi :**
- **Data-driven** : stats des armes, ennemis, vagues et upgrades vivent dans `src/data/`. Ajouter une arme = ajouter une entrée de config, pas toucher au moteur.
- **Séparation logique / rendu** : `update(dt)` ne dessine jamais, `render()` ne modifie jamais l'état.
- **`core/` ne connaît pas le gameplay** : aucun import de `entities/` ou `data/` dans `core/`.
- **Scènes** : une seule scène active, avec `enter()`, `exit()`, `update(dt)`, `render(ctx)`.
- Pas d'ECS complet au départ : entités = classes simples, systèmes = fonctions qui itèrent dessus. On refactorera si ça devient nécessaire.

---

## 5. Game design

### 5.1 Core loop

```
Se déplacer → les armes tirent seules → tuer des ennemis → ramasser l'XP
→ level up → choisir 1 upgrade parmi 3 → ennemis plus forts → ... → mort ou victoire au timer
```

### 5.2 Joueur

| Stat | Valeur de base | Notes |
|---|---|---|
| PV max | 100 | |
| Vitesse | 200 px/s | |
| Rayon de ramassage | 60 px | Augmentable via upgrade |
| Armure | 0 | Réduction plate des dégâts |
| Invincibilité après coup | 0,5 s | Évite de mourir en une frame |

<!-- TODO: plusieurs personnages jouables ? [LATER] -->

### 5.3 Contrôles

| Action | Touche |
|---|---|
| Déplacement | ZQSD / WASD / flèches (diagonale normalisée) |
| Pause | Échap / P |
| Choisir un upgrade | Clic ou touches 1-2-3 |

### 5.4 Armes `[MVP : 3 armes]`

Toutes les armes tirent automatiquement. Chaque arme a des niveaux 1 → 5 (max 6 armes en même temps `[LATER]`).

| Arme | Comportement | Dégâts | Cooldown | Notes |
|---|---|---|---|---|
| <!-- TODO --> Projectile | Tire vers l'ennemi le plus proche | 10 | 1 s | +1 projectile aux niv 3 et 5 |
| <!-- TODO --> Aura | Dégâts continus autour du joueur | 5/tick | 0,5 s | Le rayon augmente avec le niveau |
| <!-- TODO --> Orbite | Objets qui tournent autour du joueur | 8 | contact, 0,5 s de délai de re-touche par ennemi | +1 objet par niveau |

Noms des armes : `TODO` (en lien avec le thème magie). Règle de dégâts : **1 dégât minimum** par coup, même avec l'armure.

`[LATER]` : évolutions d'armes (arme niv max + objet passif = arme évoluée).

### 5.5 Ennemis `[MVP : 3 types + 1 boss]`

| Ennemi | PV | Vitesse | Dégâts contact | XP | Comportement |
|---|---|---|---|---|---|
| Basique | 10 | 80 | 5 | 1 | Fonce sur le joueur |
| Rapide | 5 | 150 | 3 | 1 | Fonce, fragile |
| Tank | 60 | 50 | 10 | 5 | Lent, résistant |
| Boss | 1000 | 70 | 20 | 50 | Apparaît à <!-- TODO --> min |

Les ennemis spawn **hors écran**, en cercle autour du joueur.

### 5.6 XP & level up

- Les ennemis lâchent des gemmes d'XP, attirées par le joueur quand il est dans le rayon de ramassage.
- XP requise : `xpToNext(level) = 5 + level * 10` <!-- TODO: à équilibrer -->
- Au level up : **pause du jeu**, 3 choix aléatoires parmi : nouvelle arme, niveau d'arme, stat passive (PV, vitesse, aimant, dégâts %, cooldown %).

### 5.7 Vagues & difficulté

- Défini dans `src/data/waves.ts` : par tranche de temps → types d'ennemis, taux de spawn, multiplicateur de PV.
- Courbe : nombre d'ennemis à l'écran qui monte progressivement (objectif perf : **500+ ennemis à 60 FPS**).

### 5.8 Fin de run

- **Défaite** : PV à 0 → écran Game Over (temps survécu, kills, niveau atteint).
- **Victoire** : survivre jusqu'au timer (10 min pour le MVP).
- Bouton "Rejouer" qui relance une run propre (aucun état qui fuit d'une run à l'autre).

### 5.9 Méta-progression `[LATER]`

<!-- TODO: monnaie gagnée par run → upgrades permanentes en menu ? déblocage de persos/armes ? -->

---

## 6. Règles techniques (perf & game loop)

Ce sont les points où un jeu Survivor rame si c'est mal fait. **À respecter strictement.**

1. **Fixed timestep** : logique à 60 updates/s fixes (accumulator), rendu via `requestAnimationFrame`. Clamp du `dt` max (ex. 250 ms) pour éviter la "spiral of death" quand l'onglet revient au premier plan.
2. **Tout mouvement est multiplié par `dt`** (en secondes). Jamais de vitesse "par frame".
3. **Object pooling** pour projectiles, ennemis, gemmes d'XP, textes de dégâts. Pas de `new` dans la boucle de jeu.
4. **Pas d'allocation dans `update()`** : pas de `.map()/.filter()` qui créent des tableaux à chaque frame dans les chemins chauds, pas d'objets `{x, y}` temporaires.
5. **Collisions via `SpatialGrid`** (hash spatial), jamais en O(n²) sur tous les ennemis.
6. **Ciblage "ennemi le plus proche"** : chercher dans la grille, pas dans tous les ennemis.
7. **Retrait d'entités** : marquer `active = false` puis recycler, ne pas faire `splice` en plein milieu d'une itération.
8. **Random seedé** (`core/math.ts`) pour pouvoir reproduire un bug.
9. Pause automatique quand l'onglet perd le focus (`visibilitychange`).
10. Un **overlay debug** (touche F3) : FPS, nombre d'entités actives, hitboxes.

---

## 7. Conventions de code

- TypeScript `strict: true`, pas de `any` (utiliser `unknown` + garde de type si besoin).
- Nommage : `PascalCase` classes/types, `camelCase` variables/fonctions, `UPPER_SNAKE_CASE` constantes. Un fichier = une classe principale, nommé comme elle.
- Pas de nombres magiques dans le gameplay : tout passe par `src/data/` ou des constantes nommées.
- Fonctions courtes ; logique pure (calcul de dégâts, XP, choix d'upgrades) séparée et **testée**.
- Commentaires en **français**, pour expliquer le **pourquoi**, pas le quoi.
- Commits : Conventional Commits en français — `feat: ajout de l'arme aura`, `fix: collision joueur/ennemi`, `refactor: ...`.
- Une branche par feature (`feat/weapon-aura`), merge sur `main` quand ça marche.

---

## 8. Comment travailler avec moi

Je suis étudiant en dev web (HTML/CSS/JS/PHP), le jeu vidéo est nouveau pour moi. Je veux **comprendre** ce qui est fait, pas juste avoir un jeu qui marche.

- **Petites étapes** : une feature à la fois, testable dans le navigateur. Pas de commit géant qui touche 15 fichiers.
- **Avant de coder une feature non triviale** : propose un plan court (fichiers touchés, approche) et attends mon OK.
- **Explique les concepts nouveaux** (fixed timestep, pooling, spatial hash...) en 3-5 lignes quand tu les introduis pour la première fois.
- **Sois critique** : si une de mes idées de design ou de code est mauvaise, dis-le franchement et propose mieux.
- **Ne devine pas** : si un point du game design n'est pas défini ici (`TODO`), demande-moi au lieu d'inventer.
- Après chaque feature : dis-moi **comment la tester** (quoi faire dans le jeu, quoi observer).
- Mets à jour la **Roadmap** (section 9) et le **Journal des décisions** (section 11) quand c'est pertinent.

---

## 9. Roadmap

### Phase 0 — Setup
- [x] Projet Vite + TypeScript strict, ESLint, Prettier, Vitest
- [x] Canvas plein écran avec mise à l'échelle 1280×720
- [x] Game loop fixed timestep + overlay FPS

### Phase 1 — Bouger
- [x] Input clavier
- [x] Joueur qui se déplace (diagonale normalisée)
- [x] Caméra qui suit le joueur + sol/grille de fond pour voir le mouvement
- [x] Interpolation au rendu + pause simple (Échap / P)

### Phase 2 — Ennemis
- [x] Spawn hors écran + poursuite du joueur (spawn temporaire, recyclage des ennemis lointains)
- [x] Object pool (+ debug F4 : +100 ennemis)
- [x] Timer de survie en haut à droite (avancé depuis le HUD de la Phase 4)
- [ ] SpatialGrid + séparation entre ennemis
- [ ] Collisions joueur/ennemi, PV, invincibilité, mort

### Phase 3 — Combat
- [ ] Arme 1 (projectile auto vers l'ennemi le plus proche)
- [ ] Dégâts, mort des ennemis, feedback visuel (flash, nombres de dégâts)
- [ ] Gemmes d'XP + aimant

### Phase 4 — Progression `[MVP atteint ici]`
- [ ] Level up + écran de choix (3 upgrades)
- [ ] Armes 2 et 3, upgrades passifs
- [ ] Vagues data-driven + boss
- [ ] Timer, écran Game Over / Victoire, rejouer
- [ ] HUD : PV, barre d'XP, niveau, timer, kills

### Phase 5 — Polish `[LATER]`
- [ ] Sprites et animations, sons et musique
- [ ] Screen shake, particules
- [ ] Menu principal, pause, options (volume)
- [ ] Méta-progression + sauvegarde localStorage
- [ ] Déploiement en ligne

---

## 10. À ne PAS faire

- ❌ Ajouter un moteur/une lib (Phaser, PixiJS, React...) sans me demander.
- ❌ Logique de gameplay dans `render()`, ou dessin dans `update()`.
- ❌ Collisions en O(n²), allocations dans la game loop.
- ❌ Stats de gameplay en dur dans le code au lieu de `src/data/`.
- ❌ Gros refactor non demandé.
- ❌ Inventer des règles de game design marquées `TODO` : demander.
- ❌ Marquer une tâche finie si typecheck/lint/tests échouent.

---

## 11. Journal des décisions

Format : date — décision — raison.

| Date | Décision | Raison |
|---|---|---|
| 2026-11-09 | Canvas 2D natif plutôt que Phaser | Apprendre la game loop, garder le contrôle |
| 2026-11-09 | Fixed timestep 60 Hz | Physique/logique stables quel que soit le FPS |
| 2026-11-09 | Orbite : délai de re-touche 0,5 s par ennemi | Sinon 8 dégâts × 60 updates/s = 480 DPS au contact |
| 2026-11-09 | Dégâts minimum 1 malgré l'armure | Éviter l'immunité totale contre les petits ennemis |
| 2026-11-09 | Run de 10 min, thème magie provisoire, jeu en local | Réponses aux TODO du brief |
| 2026-11-09 | Vite 8, Vitest 5, ESLint 10, TypeScript 6.0 (pas 7) | typescript-eslint ne supporte pas encore TS 7 |
| 2026-11-09 | Alertes `npm audit` minimatch (via ESLint) acceptées | Outil de dev uniquement, pas de correctif publié |
| 2026-11-09 | Map infinie, caméra rigide centrée sur le joueur | Standard du genre ; lisible avec beaucoup d'ennemis. Caméra souple = polish |
| 2026-11-09 | Pause simple (overlay HTML) dès la Phase 1 | Demandé ; le menu pause complet reste en Phase 5 |
| 2026-11-09 | Touches lues via `event.code` | Une seule config pour AZERTY (ZQSD) et QWERTY (WASD) |
| 2026-11-09 | Rendu interpolé (`alpha`) entre deux updates | Mouvement fluide sur écrans 144/240 Hz malgré la logique à 60 Hz |
| 2026-11-09 | Phase 2 : les 3 types d'ennemis, spawn temporaire 2/s plafonné à 600 (`data/spawn.ts`) | En attendant les vagues de la Phase 4 |
| 2026-11-09 | Rayons ennemis : basique 14, rapide 10, tank 24 px (joueur 16) | Absents du brief, valeurs de départ |
| 2026-11-09 | Ennemis trop loin replacés de l'autre côté du joueur | Map infinie : ne pas gaspiller le pool |
| 2026-11-09 | Séparation entre ennemis, barre de PV sous le joueur, overlay de mort simple | Validés pour la Phase 2 (HUD/Game Over complets en Phase 4) |
| 2026-11-09 | Timer de survie dès la Phase 2, en haut à droite | Demandé ; l'overlay debug occupe le coin haut gauche |

---

## 12. Glossaire

| Terme | Définition |
|---|---|
| **Run** | Une partie, du lancement à la mort/victoire |
| **dt (delta time)** | Temps écoulé depuis la dernière update, en secondes |
| **Fixed timestep** | La logique avance par pas de temps fixes, indépendamment du FPS |
| **Object pool** | Réserve d'objets réutilisés au lieu d'en créer/détruire en continu |
| **Spatial grid / hash** | Découpage de la map en cases pour ne tester les collisions qu'entre voisins |
| **Data-driven** | Le contenu (armes, ennemis...) est décrit par des données, pas codé en dur |
| **Bullet heaven** | Autre nom du genre Survivor : c'est le joueur qui remplit l'écran de projectiles |
