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
| Contrôles | Clavier (ZQSD + flèches). Manette en 0.7 |
| Durée d'une run | 10 min aujourd'hui ; **30 min pour la 1.0** (un seul niveau, voir § 9) |
| Univers / thème | Provisoire : magie / fantasy (un mage qui survit à des hordes). <!-- TODO: à affiner --> |
| Style graphique | Formes géométriques simples au début (placeholder), améliorables ensuite (sprites) |
| Résolution logique | 1280×720, mise à l'échelle au viewport (letterbox) |
| Objectif perso | Projet portfolio + apprendre l'archi d'un jeu (game loop, ECS-light, perf) |
| Sortie | **Gratuite** sur itch.io (pas de vente). Version actuelle : 0.3.0 (`package.json`, voir `CHANGELOG.md`) |

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
| Déploiement | Local uniquement pour l'instant (`npm run dev`) | En ligne = Phase 7 |

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
npm run sim        # bot : 20 parties sans navigateur, bilan (SIM_SEEDS=50, SIM_PERSO=pyromancer, SIM_FORCE=sword:1)
npm run bench      # ms par update avec 600 ennemis
```

`npm run sim` sert à **comparer** deux versions sur les mêmes seeds (le bot n'est pas un humain) : lancer avant et après une modification d'équilibrage. Le bot plafonne vers le niveau 13 et n'atteint presque jamais une mutation : `SIM_FORCE=<arme>:<mutation>` lui donne l'arme au niveau max dès le début (mutation 0 ou 1, -1 : sans) pour comparer des mutations. Il ne casse pas les caisses : l'or qu'il mesure vient surtout des ennemis.

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
│   ├── scenes/            # MenuScene, GameScene (règles de la partie)
│   │   └── game/          # morceaux de GameScene : WorldRenderer (dessin), Feedback (sons, tremblement, particules), devActions (menu F2)
│   ├── entities/          # Player, Enemy, Projectile, XpGem, Pickup
│   ├── systems/           # logique qui agit sur des groupes d'entités
│   │   ├── MovementSystem.ts
│   │   ├── CollisionSystem.ts
│   │   ├── SpawnSystem.ts     # vagues d'ennemis
│   │   ├── WeaponSystem.ts    # fait agir chaque arme via son comportement (src/weapons/)
│   │   └── XpSystem.ts        # XP, level up
│   ├── data/              # ⭐ données de jeu (data-driven)
│   │   ├── weapons.ts
│   │   ├── enemies.ts
│   │   ├── upgrades.ts
│   │   └── waves.ts
│   ├── weapons/           # un comportement par type d'arme (projectile, aura, orbit, melee) + registry.ts
│   ├── ui/                # HUD et menus en HTML/CSS
│   └── types/             # types partagés (RunReport : bilan de partie, RunEvents : événements de partie)
├── sim/                   # bot de simulation (npm run sim / bench), faux objets partagés avec les tests
└── tests/                 # tests Vitest (logique pure)
```

**Principes d'archi :**
- **Data-driven** : stats des armes, ennemis, vagues et upgrades vivent dans `src/data/`. Ajouter une arme d'un type existant = ajouter une entrée de config, pas toucher au moteur (testé : `tests/newWeapon.test.ts`). Un nouveau **type** d'arme = un module dans `src/weapons/` (stats, update, dessin, stats de carte) + une ligne dans `registry.ts` + son d'impact dans `HIT_SOUNDS` (TypeScript signale ce qui manque).
- **Règles / ressenti** : les règles annoncent ce qui se passe (`RunEvents`) ; `Feedback` décide du son, du tremblement et des particules. Pas de son ni de particule dans les règles.
- **Refactor sans changement de gameplay** : `tests/fingerprint.test.ts` compare l'état de 16 parties du bot à un instantané ; il doit rester vert. Changement de gameplay voulu : `npx vitest run tests/fingerprint.test.ts -u`.
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
| Régénération | 0,1 PV/s | `regen` dans `data/player.ts`, pas de régén en pause ni au level up |
| Délai de coup par ennemi | 0,7 s | Pas d'invincibilité globale : chaque ennemi au contact frappe, puis attend 0,7 s (`data/combat.ts`) |

<!-- TODO: plusieurs personnages jouables ? [LATER] -->

### 5.3 Contrôles

| Action | Touche |
|---|---|
| Déplacement | ZQSD / WASD / flèches (diagonale normalisée) |
| Pause | Échap / P |
| Options (depuis la pause) | O |
| Plein écran | F (ou la case des Options) ; Échap en sort et met la partie en pause ; « Reprendre » (clic) ou P le remet |
| Choisir un upgrade | Clic ou touches 1-2-3 |

### 5.4 Armes `[MVP : 3 armes, 4 depuis l'Épée]`

Toutes les armes tirent automatiquement. Chaque arme a des niveaux 1 → 5. **Emplacements limités : 4 armes et 4 passifs maximum** en même temps (décidé le 2026-11-11 : la run de 10 min n'est qu'une première partie, les runs s'allongeront).

| Arme | Comportement | Dégâts | Cooldown | Notes |
|---|---|---|---|---|
| **Trait arcanique** (projectile) | Tire vers l'ennemi le plus proche à portée ; 450 px/s, 1,4 s de vie (~630 px), disparaît au 1er impact | 16 | 1 s | +1 projectile aux niv 3 et 5 |
| **Aura ardente** (aura) | Brûle chaque ennemi dont le bord touche le cercle (rayon 70 px) : dès qu'il entre, puis toutes les 0,5 s tant qu'il reste dedans (horloge par ennemi) | 5/tick | 0,5 s par ennemi | Niv 2 : +2 dégâts ; niv 3 et 4 : rayon +15 px ; niv 5 : +3 dégâts, rayon +20 px. Mutations : **Aura de givre** (rayon ×1,68, dégâts ×0,6 toutes les 0,6 s, ralentit 45 % ; neige `snowfall` du pack qui tombe dans le cercle) / **Fournaise** (rayon ×1,2 ; toutes les 1,5 s, une **onde de feu** part du joueur jusqu'à ×1,1 ce rayon en 0,4 s et touche chaque ennemi une fois : dégâts ×4, puis ×1,4 sur les gros (tank, élites, boss : `big`) et ×0,5 sur les autres ; pénétration 30 ; recul ×1,5 ; rien de dessiné en permanence, seulement l'onde) |
| **Épée** (mêlée) | Coup en arc devant le joueur, dans sa direction de marche (gardée à l'arrêt) : 125 px, 200°, chaque ennemi touché une fois par coup | 16 | 1,2 s | Niv 2 +5 dégâts, niv 3 arc +40°, niv 4 délai −20 %, niv 5 +7 dégâts et portée +25 px (28 au niv 5). Recul 170. Le Duplicateur ne s'applique pas à l'Épée. Mutations : **Tourbillon** (360°, dégâts ×0,85, recul ×1,3) / **Estoc** (vise l'ennemi le plus proche et attend s'il n'y en a pas ; portée ×2, 30°, dégâts ×2, recul ×1,5 ; touche tout ennemi qui chevauche le cône) |
| **Orbes runiques** (orbite) | 2 orbes de 13 px à 80 px du joueur, 3 rad/s | 10 | contact, 0,5 s de délai de re-touche par orbe et par ennemi | +1 orbe par niveau, +3 dégâts au niv 4, orbite 80 → 105 px au niv 5 (Orbes géants : ×1,25 ≈ 131 px) |

**Recul** (stat par arme, px/s donnés à l'ennemi touché) : toutes les forces ×1,2 (`KNOCKBACK.forceMult`, data/combat.ts) ; Trait arcanique 185 (sens du tir), Aura ardente 60 (depuis le joueur), Orbes runiques 200 (depuis le joueur : jamais renvoyé vers lui). Plus l'ennemi est lourd, moins il recule (tank ~3× moins) ; **le boss ne recule jamais** (`knockbackImmune`). Passif **Impact** : +8 % de recul par niveau.

Détail des niveaux de chaque arme : `src/data/weapons.ts`. **Tous les dégâts d'armes ci-dessus sont ×1,15** (`WEAPON_DAMAGE_MULT`, data/combat.ts, 2026-11-21) : le Trait fait donc 18,4, arrondi à 19 par coup. Règle de dégâts : **1 dégât minimum** par coup, même avec l'armure, et chaque coup est **arrondi à l'entier supérieur** (un petit bonus en % compte toujours). La Hâte accélère les tirs et les ticks d'aura, pas les orbes.

**Types de dégâts** (0.3) : l'Épée est **physique**, le Trait, l'Aura et les Orbes sont **magiques** (`damageType`). Chaque ennemi a une armure physique et une résistance magique (`resistances`, absent = 0) : réduction = A / (A + 100), avec A = résistance − pénétration, jamais négatif (`resistReduction`, data/combat.ts), puis arrondi au-dessus, 1 dégât minimum. Pénétration = arme + mutation + joueur : **Estoc 30, Fournaise 30, Trait perçant 20**, les autres 0 ; passif **Pénétration** +5 par niveau (5 niveaux). Le damage meter compte les dégâts après réduction.

`[LATER]` : évolutions d'armes (arme niv max + objet passif = arme évoluée).

### 5.5 Ennemis `[MVP : 3 types + 1 boss]`

| Ennemi | PV | Vitesse | Dégâts contact | XP | Comportement |
|---|---|---|---|---|---|
| Basique | 23 | 88 | 5 | 1 | Fonce sur le joueur (2 coups de Trait arcanique). 50 % de chances de lâcher une **gemme verte** qui vaut ×2 (`bonusGem`). 4 % de lâcher 1 pièce d'or |
| Rapide | 5 | 135 | 3 | 1 | Fonce, fragile. 4 % de lâcher 1 pièce d'or |
| Tank | 90 | 72 | 10 | 5 | Résistant, presque aussi rapide qu'un basique. 15 % de lâcher 1 pièce d'or |
| Boss | 1000 | 70 | 20 | 50 | Apparaît à 5:00 (**×3 PV = 3000**) et 9:00 (**×9 PV = 9000, vitesse ×2 = 140 px/s**) ; rayon 48 px, barre de PV, aucun recul, **insensible au ralentissement** (`BOSS_SPAWNS` dans waves.ts) |

**Mini-boss (élites)** : anneau doré pulsant, barre de PV, recul 75 % plus faible que leur version normale (`knockbackFactor` 0,375 et 0,25), **insensibles au ralentissement**, +10 or, XP ×20 (`ELITE_SPAWNS` dans waves.ts) :

| Élite | Arrive à | PV (base) | Vitesse | Dégâts | Rayon |
|---|---|---|---|---|---|
| Rapide élite (orange) | 3:00 | 300 (×60) × vague | 135 | 12 (×4) | 18 |
| Basique élite (rouge) | 7:00 | 1150 (×50) × vague | 97 | 20 (×4) | 25 |

**Capacités des boss** (`BOSS_ABILITIES`), toujours annoncées pour pouvoir les esquiver :
- **Charge** (tous les boss) : toutes les 6 s, arrêt de 0,8 s (**0,5 s pour le boss de 9:00** et ceux du sans fin) annoncé par des chevrons rouges en pixels sur la trajectoire (ils s'allument du boss vers le bout et clignotent de plus en plus vite, fissure au point d'arrivée), puis ligne droite à 5× la vitesse pendant 0,7 s (environ 245 px pour le boss de 5:00, 295 px pour celui de 9:00 : sa charge est calculée sur une vitesse ×1,2, pas sur sa marche ×2).
- **Invocation** (boss de 9:00 et du sans fin) : toutes les 10 s, anneau de braises violettes qui se resserre pendant 1 s sur le cercle d'apparition, puis 5 basiques et 1 basique élite autour du boss.
- Boss du sans fin : délais ×0,9 à chaque nouveau boss.

**Résistances** (0.3, physique / magique) : basique 10 / 10 (−9 %), rapide 0 / 0, tank 0 / 50 (−33 % contre la magie : l'Épée est l'arme anti-tank), rapide élite 0 / 40, basique élite 50 / 0, boss 30 / 30.

Les ennemis spawn **hors écran**, en cercle autour du joueur. Un ennemi resté à plus de 1,35 × ce cercle (≈ 1 080 px) est replacé sur le cercle **à un angle au hasard** (boss et élites : pile en face du joueur).

### 5.6 XP & level up

- Les ennemis lâchent des gemmes d'XP, attirées par le joueur quand il est dans le rayon de ramassage.
- XP requise : `xpToNext(level) = 5 + level × 7 + 0,75 × max(0, level − 10)²`, arrondi (`XP_CURVE` dans `data/progression.ts`). Les 10 premiers niveaux gardent l'ancienne courbe ; ensuite elle se durcit (niv 20 : 220, niv 30 : 515).
- L'écran de fin affiche **« build complet à mm:ss »** (moment où plus rien n'est améliorable) pour régler la courbe sur du concret.
- Un ennemi rapporte `XP de base × multiplicateur de PV de sa vague` (plus dur à tuer = plus d'XP). Couleur de la gemme selon sa valeur (bleue < 5, violette < 20, dorée), sauf la gemme verte du basique (×2, couleur à part, redevient normale si elle est fusionnée).
- Quand tout est au maximum (armes, mutations, passifs), l'XP requise est **×10** (×4 avant le 2026-11-21) ; chaque level up propose au choix **+15 PV** ou **+10 or**.
- Au level up : **pause du jeu**, 3 choix aléatoires parmi : nouvelle arme, niveau d'arme (ou sa mutation au niveau 6), passif (9 passifs pour 4 emplacements : Vitalité (+15 PV max et +0,3 PV/s par niveau), Célérité, Attraction, Puissance, Hâte, Impact, Taille, Vélocité, Duplicateur). Jusqu'au niveau 10, une carte de passif sort 2 fois moins souvent qu'une carte d'arme (`EARLY_PASSIVES`).
- **Relance** : 2 par partie (`REROLLS_PER_RUN`), touche R ou bouton sous les cartes. Les cartes affichées ne reviennent pas tant qu’il reste assez d’autres options ; la nouvelle arme garantie (< 3 armes) tient toujours. Impossible quand il ne reste que le soin.

### 5.7 Vagues & difficulté

- Défini dans `src/data/waves.ts` : par tranche de temps → types d'ennemis, taux de spawn, multiplicateur de PV.
- Ouverture calme : 0,8 ennemi/s de 0:00 à 0:30, puis 1,5/s.
- Courbe : nombre d'ennemis à l'écran qui monte progressivement (objectif perf : **500+ ennemis à 60 FPS**).
- **Rushs** (`BONUS_WAVES`) : en plus de la vague normale, 2:00-2:30 = +5 rapides/s (≈ 150), 6:00-6:30 = +4 basiques/s (≈ 120). PV et vitesse de la vague en cours.

### 5.8 Fin de run

- **Défaite** : PV à 0 → écran Game Over (temps survécu, kills, niveau atteint, damage meter).
- **Victoire** : survivre jusqu'au timer (10 min pour le MVP) **et** que le boss de 9:00 soit mort → tout se fige, écran de victoire avec le même bilan. Boss encore en vie à 10:00 → **prolongations** : le timer continue (vagues de fin toujours actives) jusqu'à la mort du boss (victoire) ou du joueur (défaite).
- **Mode sans fin** : sur l'écran de victoire, bouton **Continuer en sans fin** (ou **C**). Le timer continue, et chaque minute (depuis le début du sans fin) tous les ennemis qui apparaissent sont plus forts : PV ×1,2 et dégâts au contact ×1,1 cumulés, vitesse +3 % (plafond ×3), résistance au recul +8 % (plafond 80 %), résistance au ralentissement +10 % (plafond 80 %), et +2 ennemis/s. Un boss toutes les 3 min, 50 % plus résistant à chaque fois (`ENDLESS` dans waves.ts). Seule la mort termine la partie, qui compte comme **victoire + sans fin** (le meilleur temps du profil compte le sans fin).
- Bouton "Rejouer" qui relance une run propre (aucun état qui fuit d'une run à l'autre).

### 5.9 Méta-progression

**Persos de départ** (validé le 2026-11-11, fait) : au clic sur « Jouer », on choisit un perso (le choix est gardé pour « Rejouer »). Pour l'instant, un perso = **seulement son arme de départ** (mêmes stats pour tous). Les persos verrouillés se débloquent par un **défi** réussi avec leur arme ramassée en partie. Déblocages sauvegardés en `localStorage`.

| Perso (nom provisoire) | Arme de départ | Déblocage (chiffres à ajuster en jouant) |
|---|---|---|
| Arcaniste | Trait arcanique | Disponible dès le début |
| Pyromancien | Aura ardente | 5 000 kills avec l'Aura ardente, cumulés sur toutes les parties |
| Runiste | Orbes runiques | Tuer le boss de 9:00 en ayant les Orbes runiques au niveau 5 |
| Lame-mage | Épée | 3 000 kills avec l'Épée, cumulés sur toutes les parties |

`[LATER]` Stats propres à chaque perso : armure physique et magique, bonus de dégâts physiques et magiques, vitesse... (suppose de classer les armes et les ennemis en physique / magique).

**Or et mobilier** (validé le 2026-11-11) :
- **Mobilier** : tonneaux / caisses immobiles, cassés par n'importe quelle arme (10 PV) **ou en marchant dessus** (la visée automatique du Trait les ignore). Un nouveau toutes les 15 s hors écran, 8 au maximum. Lâche **70 % or** (1 à 2 pièces, un peu plus en fin de partie) ou **30 % nourriture** (+20 PV), ramassés à l'aimant. **Boss tué = +12 or. Élite tué = +5 or et nourriture (sauf élites invoqués par un boss, et en sans fin). Basiques et rapides : 2 % de chances d'une pièce, tanks : 7,5 %** (`goldChance`, tirage séparé). Caisses : 1 à 2 pièces. Or −50 % le 2026-11-21 (622 or à 14:00). Les objets lâchés par un même ennemi sont écartés de 14 px. Ne compte ni comme kill, ni dans le damage meter.
- L'or de la partie s'ajoute au total **seulement si elle est terminée** (et jamais en partie de test).
- **Boutique** au menu (bonus permanents, appliqués au début de chaque partie, sans prendre d'emplacement de passif) :

| Bonus | Par rang | Rangs | Prix (rang 1 → max) |
|---|---|---|---|
| Vitalité de départ | +5 PV max | 5 | 50 → 250 |
| Puissance de départ | +3 % dégâts | 5 | 80 → 400 |
| Célérité de départ | +2 % vitesse | 3 | 60 → 180 |
| Attraction de départ | +10 % aimant | 3 | 40 → 120 |
| Sagesse | +3 % d'XP gagnée | 5 | 100 → 500 |

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
11. Un **menu de test** (touche F2, `npm run dev` seulement, absent du build) : armes (ajout, niveau, mutation), passifs, niveaux, invincibilité, sauts dans le temps, sans fin, ennemis, boss. Toute action fait de la partie une **partie de test** (badge TEST) qui n'est **jamais** enregistrée au profil.

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

Roadmap versionnée validée le 2026-11-18 (bilan d'architecture fait le même jour). Chaque version est publiable sur itch.io. Les phases 0 à 7 (faites) sont gardées plus bas dans l'**Historique**.

### Numérotation des versions

- `MAJEUR.MINEUR.CORRECTIF`. `0.x` = en développement : contenu, équilibrage et sauvegarde peuvent changer. `0.x.y` = correctifs (bugs, petit équilibrage) sans nouveau contenu. `1.0` = jeu fini, les sauvegardes ne cassent plus.
- Source unique : `version` de `package.json` (`npm version minor` / `patch` met à jour et crée le tag). Injectée par le `define` de Vite, affichée dans le menu et sur l'écran de fin, écrite dans la sauvegarde (`savedWith`).
- Tag git annoté `v0.2.0`, `CHANGELOG.md` en français, devlog itch à chaque version mineure, zip nommé `survivor-0.2.0-itch.zip`.
- Le jeu tel qu'il est au 2026-11-18 = **0.1.0**.

### Objectif 1.0

**Sortie gratuite sur itch.io, pas de vente.** Un seul niveau, **30 min, bien fait**. Le 2e niveau et la version PC viennent en 1.x.

| | Aujourd'hui (0.1) | Cible 1.0 |
|---|---|---|
| Niveaux | 1 (10 min) | 1 (30 min) |
| Armes | 4 | 12 (au moins 8 comportements différents, autant de physiques que de magiques) |
| Passifs | 9 | ~12 (dont la pénétration) |
| Persos | 4 | 8, chacun avec ses stats et son ulti |
| Ennemis | 3 + 2 élites + 1 boss | 8 à 10 types (dont des blindés), plus d'élites, 3 boss (10:00, 20:00, 30:00) |
| Méta | 4 persos, boutique, profil | + bestiaire, relances, ~30 déblocages |

### 0.1.0 — Première version numérotée `[petite]`
- [x] Version dans `package.json` (0.1.0), affichée dans le menu et sur l'écran de fin, `savedWith` dans les sauvegardes ; `CHANGELOG.md` ; zip `survivor-0.1.0-itch.zip`
- [x] Tag `v0.1.0` sur `main` et poussé, une fois le zip testé sur itch (testé le 2026-11-18)
- [x] Plein écran : touche + option
- [x] Options modifiables en partie (bouton « Options » du menu pause, même écran que celui du menu)
- [x] « Jouer » grisé tant que les sprites et effets ne sont pas chargés (sinon toute la partie est en formes simples)
- [x] **Relance des cartes** de level up (2 par partie au départ, plus via la boutique ensuite) ; pas de « bannir » pour l’instant
- [x] **Régénération de base** 0,1 PV/s (stat du joueur dans `data/player.ts`, augmentable ensuite)
- [x] Buff léger de tout le recul (×1,2 global) : on ne le sentait pas
- [x] Équilibrage (retours de jeu, version allégée) : gemme verte du basique (50 %, ×2), ouverture calme 0:00-0:30, dégâts arrondis au-dessus, Trait arcanique 14 → 16, passifs 2× moins souvent avant le niveau 10
- [x] Bug : la horde tassée se figeait en bouchon (file d'attente) et ne suivait plus le joueur
- [x] Ennemis distancés replacés tout autour du joueur (plus seulement en face), seuil 1,5 → 1,35
- **Finie quand :** version du jeu = tag git = zip sur itch ; plein écran, options en partie, relance et régénération testés sur itch.

### 0.1.1 — Retours des testeurs `[petite]`
Correctifs sans nouveau contenu (retours de 2 testeurs sur la 0.1.0, 2026-11-20).
- [x] Sol un peu plus gris (plus de contraste avec les ennemis)
- [x] Cartes de level up plus grandes, texte plus gros, bonus en vert vif
- [x] Barre d'XP plus voyante
- [x] Aura ardente : anneau plus fin, disque plus discret (rayon de dégâts inchangé)
- [x] Les 2 mutations d'une arme se distinguent mieux sur leurs cartes
- [x] Pic de 6:00 adouci : vague de 6:00 9 → 7/s, rush 7 → 4/s (on passait de 3,5 à 16 ennemis/s d'un coup ; maintenant 11/s)
- [x] Testée et taguée `v0.1.1` (2026-11-20)
- **Finie quand :** zip sur itch, retours des 2 testeurs sur ces points.

### 0.1.2 — Soins et retours de jeu `[petite]`
Bloc A du plan de la 0.2 (validé le 2026-11-20), sorti à part pour avoir vite l'avis des testeurs.
- [x] **Soins revus** : **30 % de nourriture** dans les caisses (`goldChance` 0,85 → 0,7), **nourriture garantie sur chaque élite tué**, **Vitalité = +15 PV max et +0,3 PV/s** par niveau (+1,5 PV/s au niveau 5)
- [x] **Orbes géants : gros nerf du recul** : multiplicateur ×1,6 → ×1 (le recul de base des orbes reste) ; micro nerf des dégâts ×2 → ×1,8. Retour de jeu : « littéralement personne ne rentre »
- [x] **Vrais boutons sur l'écran de fin** (victoire et défaite) : Continuer en sans fin (victoire seulement), Rejouer, Menu principal ; touches C / R / M toujours actives ; clics ignorés pendant 0,5 s (`END_SCREEN_CLICK_DELAY`)
- [x] Version 0.1.2 (`package.json`, `CHANGELOG.md`), zip testé sur itch, tag `v0.1.2` poussé (2026-11-21)
- **Finie quand :** zip sur itch ; les testeurs se soignent assez, des ennemis atteignent le joueur avec les Orbes géants.

### 0.1.3 — Petits écrans et plein écran `[petite]`
Correctifs de confort (retour de jeu du 2026-11-21), sortis avant le bot. Contient aussi les refactors du bloc B (sans effet visible) et les icônes du damage meter, déjà sur `main`.
- [x] Interface à l'échelle du canvas : HUD, menus et écrans construits en 1280×720 dans `#ui`, mis à la même échelle que le monde (`transform: scale` par `core/Renderer`) ; plus rien ne déborde sur un petit écran. Outils F2 / F3 hors de cette échelle
- [x] Échap quitte le plein écran (le navigateur l'impose) : la pause qui suit propose « Reprendre en plein écran (P) », et un clic sur « Reprendre » ou P le remet. P met en pause et reprend, partout
- [x] Écrans qui dépassaient même en 1280×720 : cartes de perso 340 → 290 px (4 côte à côte), Options et Profil sans cadre par ligne, Boutique resserrée, Profil 640 → 760 px
- [x] Version 0.1.3 (`package.json`, `CHANGELOG.md`), zip testé sur itch, tag `v0.1.3` poussé (2026-11-21)
- **Finie quand :** zip sur itch ; menus lisibles et entiers dans une petite fenêtre ; plein écran remis après Échap.

### 0.2.2 — Tank démon et barre de PV `[petite]`
- [x] **Tank en démon** (avancé de la 0.4) : l'orc `ogre` du pack repeint aux couleurs des démons, cornes en croissant, yeux blancs (`tools/sprites/tank-demon.mjs`, atlas `sprites/monsters/`)
- [x] Barres du HUD (PV, XP, boss) : trou sombre à chaque bout une fois pleines. Le cadre faisait 8 px de côté mais son creux commence à 4 px : le cadre est maintenant dessiné 4 px au-delà de la barre (`border-image-outset`) ; même chose pour le pixel sombre du bas (bordure du bas 6 → 4 px sous une image de 6 px)
- [x] Icônes des cartes de fin de build : potion rouge (Soin, Raven n° 281) et bourse (Bourse, n° 158) ; elles étaient vides
- [x] Outils : planche des icônes Raven (`tools/ui/icons-preview.html`), page des variantes de sprites (`tools/sprites/variants-preview.html`)
- [x] Version 0.2.2 (`package.json`, `CHANGELOG.md`), zip testé sur itch, tag `v0.2.2` poussé (2026-11-21)
- **Finie quand :** zip sur itch ; tank démon en jeu, barres pleines sans trou.

### 0.2.1 — Police du texte courant `[petite]`
- [x] Comparaison de 3 polices pixel (`tools/ui/fonts-preview.html`) : monogram (CC0), Pixel Operator (CC0), Silver (CC BY 4.0, 3,5 Mo)
- [x] **monogram** (datagoblin, CC0, même auteur que DUNGEON.mode) pour le texte courant (`--ui-font-text`) : 32 px pour le texte principal (descriptions des cartes, noms des bonus de la Boutique, Options, damage meter), 24 px pour le texte secondaire (portée des cartes, Boutique, Profil, aides). DUNGEON.mode garde titres, noms, boutons, chiffres du HUD et nombres de dégâts
- [x] Version 0.2.1 (`package.json`, `CHANGELOG.md`), zip testé sur itch, tag `v0.2.1` poussé (2026-11-21)
- **Finie quand :** zip sur itch ; textes lisibles sur tous les écrans, rien ne déborde en 1280×720.

### 0.2 — Une partie juste `[moyenne]`
- [x] Refactor : rendu sorti de `GameScene` (`scenes/game/WorldRenderer.ts`), sans changer le comportement ; test de rendu d'une partie chargée avec un faux contexte canvas
- [x] Refactor : menu de test sorti de `GameScene` : armes, passifs et vue du panneau en fonctions pures (`scenes/game/devActions.ts`, testées) ; les actions sur le déroulement (temps, niveaux, sans fin, or, boss) restent dans `applyDevAction`
- [x] Refactor : type `RunReport` dans `src/types/` ; `computeDamage` dans `data/combat.ts`, à côté de `MIN_DAMAGE` (une entité n'importe pas un système)
- [x] Bot de simulation `npm run sim` : `GameScene` sans visuel, déplacement et choix d'upgrade automatiques, 20 seeds → temps de survie, build complet à, part de chaque arme ; quelques bornes larges en test. Benchmark `npm run bench` (600 ennemis, ms par update)
- [x] **Annonces de boss et barres de PV dans la DA** : charge en flèches / fissures pixel qui clignotent (plus de rectangle rouge), barres de PV à cadre pixel, pour le joueur, les élites et les boss seulement
  - [x] Étape 1 : longueur de la charge annoncée = vraie trajectoire (`chargeSpeed`, le boss de 9:00 annonçait ~490 px pour ~295)
  - [x] Étape 2 : charge en chevrons pixel (carrés de 2 px) qui se remplissent pendant l'annonce et clignotent plus vite à la fin, bord en pointillés, fissure au bout
  - [x] Étape 3 : invocation en anneau de carrés violets qui se resserre
  - [x] Étape 4 : barres des élites (plus au-dessus du boss : sa grande barre du HUD suffit, retour de jeu) avec `bar-frame` + `bar-red` du pack (rectangles en secours), **traînée** claire des dégâts récents (valeur mise à jour dans l'update) ; petite barre sous le joueur, visible seulement s'il a perdu des PV
  - [x] Étape 5 : grande barre du boss en haut de l'écran (HUD, sous le timer, « BOSS » : les boss n'ont pas encore de nom)
  - [x] Étape 6 : contour rouge léger sous **20 %** des PV max, pulsation plus rapide sous **10 %** (`LOW_HP`, 3 bandes nettes en CSS, sans halo ; fixe si le tremblement est coupé)
  - [x] Étape 7 : `CHARGE_TELEGRAPH`, `SUMMON_TELEGRAPH`, `HP_BARS` dans `data/feel.ts`, test de rendu (charge, invocation, barres avec et sans pack)
- [x] **Cartes de level up et survol de TOUS les boutons refaits dans la DA** : retour de jeu (2026-11-21) « trop simple, ça ne fait pas trop dans la DA ». Aujourd'hui une carte survolée monte de 4 px et s'éclaircit, un bouton change juste de couleur de texte : effets génériques de site web. À la place, des effets pixel du pack (cadre qui s'allume, sélection marquée, apparition des cartes). Le même survol partout : menu principal, pause, Options, Boutique (boutons d'achat), Profil, choix du perso, écran de fin, relance, cartes de level up et de mutation Fait (piste A + proposition Claude Design) : curseur ▶ doré en pixels sur les boutons ; cartes avec badge de la sorte, touche de clavier, icône dans sa case, crans de niveau, effet avant → après (`systems/choiceDetails.ts`), ligne de portée (`scope` dans weapons.ts et upgrades.ts), tampon de mutation, contour doré au survol, arrivée une par une
- [x] Passe d'équilibrage des 10 min actuelles (faite le 2026-11-21, détails dans le journal) :
  - [x] Dégâts de toutes les armes ×1,15 (`WEAPON_DAMAGE_MULT`)
  - [x] Armes : Épée (arc 200°, portée 125, recul 170), Fournaise (onde anti-gros), Tourbillon (dégâts ×0,85, recul ×1,3) ; Trait, Givre et Tempête inchangés
  - [x] Boss de 9:00 : vitesse ×2, annonce de charge 0,5 s
  - [x] Sans fin hardcore, XP ×10 au build complet, carte +15 PV / +10 or, soins de fin de partie réduits, or −50 %
  - ↪ 0.3 bloc D : confirmation avec les testeurs (~1 victoire sur 3, aucune arme sous ~10 % du damage meter, boss de 5:00)
  - ↪ 0.3 bloc D : prix de la Boutique, à revoir une fois tout acheté (choix de l'utilisateur)
- [x] **Icône de chaque arme dans le damage meter** de l'écran de fin, à gauche de son nom (icône de la mutation si l'arme est mutée, comme dans le HUD)
- [x] Or lâché (rarement) par les ennemis : basique / rapide 4 %, tank 15 % (objectif : Boutique complète en ~25 parties complètes, à vérifier en jouant : le bot ne casse pas les caisses)
- [x] Mutations de l'Aura ardente repensées : **Aura de givre** (ralentit) et **Fournaise** (souffle en rafale), à la place de Brasier / Aura toxique (avancé de la 0.3 : « le poison c'est nul »). Icônes : flocon de glace (Raven n° 787) pour le givre, explosion de feu (n° 767, ex-Brasier) pour la Fournaise. Rayons +20 % et recul de la Fournaise ×3 → ×1,5 (retour de jeu)
- [x] **Lame d'onde remplacée par l'Estoc** : portée ×2, 30°, dégâts ×2, recul ×1,5 ; traînée de pixels en damier. Icône : épée pointée qui scintille (Raven n° 728). Vise l'ennemi le plus proche (dans la direction de marche, il frappait dans le vide) ; visuel : l'épée du pack se fend + trait d'énergie
- [x] Version 0.2.0 (`package.json`, `CHANGELOG.md`), zip testé sur itch, tag `v0.2.0` poussé (2026-11-21)
- **Finie quand :** métriques du bot stables sur 20 seeds, aucune arme sous ~10 % du damage meter dans les builds où elle est, 5 parties jouées + 2 testeurs : « dur mais juste ».

### 0.3 — Stats avancées et arsenal `[grosse]`
But : des ennemis qui résistent obligent à varier son build (seul vrai choix du joueur dans un jeu à tir automatique), et une nouvelle arme ne demande plus de toucher au moteur. Ordre : refactors → types de dégâts → armes → correctifs de la 0.2. Un plan court à valider avant chaque bloc.

**Bloc A — Refactors (rien de visible en jeu)** : `npm run sim` donne les mêmes chiffres avant et après, sur les mêmes seeds
- [x] Test d'empreinte (`tests/fingerprint.test.ts`) : 4 persos × 3 min + chaque arme imposée, sans mutation et avec chacune (1 min), comparés à un instantané ; vert à chaque commit du bloc
- [x] Registre de comportements d'armes : un module par type dans `src/weapons/` (`init`, `levelBase` / `applyStats`, `update`, `renderGround` / `renderAbove`, `cardStats`) au lieu des `switch` sur `def.kind` (`entities/Weapon.ts`, `WeaponSystem`, `WorldRenderer`, `choiceDetails`)
- [x] Événements de partie typés (`types/RunEvents.ts` : kill, coup reçu, level up, ramassages, boss, coups d'armes…) + module `scenes/game/Feedback.ts` (son, tremblement, particules, flash, nombres de dégâts) qui les écoute ; `killEnemy` ne garde que les règles (`GameScene` 1 042 → 921 lignes)
- [x] Test : une arme neuve de chaque type, faite seulement d'une définition, tire, tue, compte dans le damage meter, se dessine et a sa carte (`tests/newWeapon.test.ts`)
- [x] `npm run sim` (20 seeds) identique avant / après

**Bloc B — Types de dégâts et résistances**
- [x] **2 types de dégâts** : `damageType` sur chaque arme (Épée physique, les 3 autres magiques) ; affichage sur la carte et dans le HUD : voir Lisibilité
- [x] **Résistances des ennemis** : `resistances` (physique / magique) sur chaque type d'ennemi ; réduction = A / (A + 100), A = résistance − pénétration, jamais négatif ; `resistReduction` (`data/combat.ts`) appliqué dans `damageEnemy`, testé (`tests/resistances.test.ts`)
- [x] Valeurs : basique 10 / 10, tank 0 / 50, rapide élite 0 / 40, basique élite 50 / 0, boss 30 / 30 (§ 5.5)
- [x] **Pénétration** : arme + mutation + joueur (`penetration` dans weapons.ts, `Player.penetration`) ; Estoc 30, Fournaise 30, Trait perçant 20 ; passif **Pénétration** +5 / niveau, 5 niveaux (+10 au départ, nerf : « sinon broken ») ; plus tard enchantements (0.4) et persos (0.5)
- [x] Lisibilité : type en tête de la ligne de portée des cartes d'armes (« Magique · … »), coin coloré dans la case de chaque arme du HUD (acier physique, violet magique), nombres de dégâts gris quand la résistance retire 15 % ou plus (`RESISTED_NUMBERS`, data/feel.ts) ; damage meter en dégâts après réduction. **Pas de repère sur les ennemis** (décidé : sur 500 ennemis qui résistent presque tous un peu, ce serait du bruit) ; résistances détaillées dans le bestiaire (0.5)
- [x] Icône du passif Pénétration : Raven 870 (bouclier fendu orange, flèche rouge ; 1214 d'abord)
- [x] **Boucliers des résistances** (idée de l'utilisateur) : à droite de la barre du boss (HUD, avec la valeur) et à gauche de la barre des élites (canvas) ; bouclier gris = armure physique (Raven 597), bleu = résistance magique (598). Couleurs des types alignées sur ces boucliers (`--dmg-physical`, `--dmg-magical`)
- ↪ 0.4 (enchantements) : effet « brise-armure » qui baisse l'armure d'un ennemi quelques secondes ; icônes de malus déjà choisies (621 gris, 622 bleu, flèche rouge), à afficher à côté des boucliers
- [x] Garantie au level up : si toutes les armes sont du même type et qu'il reste une place, une nouvelle arme de l'autre type est proposée à chaque level up (`missingDamageType`, systems/upgrades.ts)
- [x] Bot : part des dégâts physiques / magiques et parties finies avec les deux types dans le bilan. Mesure (20 seeds, Arcaniste) : mort médiane 6:17 → 5:52, niveau médian 13,5 → 11, Épée prise dans 18 parties sur 20 (13 avant) et 30 % du damage meter (24 %), dégâts physiques / magiques 27 % / 73 %

**Bloc C — 4 nouvelles armes** (2 physiques, 2 magiques, 2 mutations chacune, au moins 2 nouveaux comportements)
- [x] Design des 4 armes validé (2026-11-23) : **Arc** (physique, projectile), **Hache de lancer** (physique, `boomerang`), **Chausse-trapes** (physique, `zone` au sol), **Éclair en chaîne** (magique, `chain`) ; chiffres de départ et mutations dans le journal, à ajuster en jouant
- [x] **Arc** : données seulement (`bow` dans weapons.ts) + 2 champs génériques des projectiles : `pierce` de base (traverse 2) et `look: 'arrow'` (sprite `weapon_arrow` du pack, sans teinte). 34 dégâts / 1,8 s, 600 px/s (900 d'abord : « les flèches vont super vite »), ~810 px. Mutations **Flèche lourde** (×1,6, recul ×2, pénétration +40) / **Volée** (5 flèches, ×0,6). Icônes Raven 1564 / 401 / 1136
- [x] **Éclair en chaîne** : nouveau type `chain` (`src/weapons/chain.ts`). 14 dégâts / 1,3 s, première cible à 350 px, 3 sauts de 150 px au plus, −15 % par saut ; jamais deux fois le même ennemi dans une décharge ; Duplicateur = une chaîne de plus, Taille = sauts plus longs. Mutations **Orage** (2 chaînes en plus depuis des ennemis au hasard à 600 px, aléatoire des armes séparé de celui du jeu ; foudre `lightning-strike` du pack sur la cible) / **Arc continu** (+4 sauts, sans perte). Visuel : effets du pack étirés entre les deux bouts de chaque saut, `lightning-whip` au 1er coup (du joueur à la cible) et `chain-lightning` aux ricochets (`CHAIN_FX`, 0,45 s ; demandé par l'utilisateur) ; trait brisé dessiné par le code en secours (`CHAIN_LOOK`). Icônes Raven 1025 (l'éclair, pris à la Hâte, qui passe au grimoire 98) / 1031 / 1037
- [x] **Hache de lancer** : nouveau type `boomerang` (`src/weapons/boomerang.ts`), haches en vol dans des tableaux fixes de l'arme (16 au plus). 20 dégâts / 1,6 s, 420 px/s, aller de 300 px puis retour vers le joueur (là où il est) ; chaque ennemi touché une fois à l'aller et une fois au retour, recul toujours vers l'extérieur. Sprite `weapon_throwing_axe` qui tourne. La 1re hache part droit sur la cible, les autres de part et d'autre (avec un éventail centré, un nombre pair ratait la cible). Mutations **Haches jumelles** (4 haches en éventail, ×0,8) / **Hache du bourreau** (taille ×1,6, dégâts ×1,7, vitesse ×0,7, recul ×1,5 ; sprite `weapon_double_axe` à ses couleurs, champ `sprite` de mutation). Icônes Raven 1457 / 1458 / 1539
- [x] **Chausse-trapes** : nouveau type `zone` (`src/weapons/zone.ts`), zones dans un tableau fixe de l'arme (24 au plus, la plus ancienne remplacée). Une zone de 40 px sous le joueur toutes les 2 s, qui dure 4 s ; 8 dégâts dès l'entrée puis toutes les 0,5 s (horloge par ennemi `nextZoneHitAt`, à part de celle de l'Aura) ; les zones en plus d'une pose tombent autour du joueur (aléatoire des armes). Visuels PVFX (retour : « trop simple, pas dans le thème ») : pointes de terre `earth-spike` qui jaillissent, restent dressées et s'effritent, étincelles `metal-clang` à chaque coup ; Mines = bombe du pack, lumière rouge, mèche, anneau de danger en pointillés, explosion `barrel-explosion` ; ronces = lianes `vine-snare` qui poussent puis sèchent (`ZONE_FX`, `ONE_SHOT_FX` dans data/sprites.ts) ; tuiles `floor_spikes_anim` en secours sans le pack. Mutations **Mines** (explosent au premier contact d'un ennemi : 80 px, ×4) / **Champ de ronces** (×1,6 plus grandes, ×1,5 plus longues, ralentit de 30 %, pas les élites ni les boss). Icônes Raven 1016 / 764 / 241
- [ ] Une arme à la fois : données, module de comportement si nouveau type, visuel, tests ; essai en jeu (F2) avant la suivante
- [x] Outil : planche animée des effets PVFX (`tools/vfx/vfx-preview.html`) : les effets du jeu avec leur usage, et les 253 effets du pack (filtre, catégorie, vitesse, fond ; clic = copie de l'id). Pack dans `tools/vfx/pvfx-pack/` (ignoré par git)
- ↪ 0.3.1 : bot (`SIM_FORCE`) sur chaque nouvelle arme et mutation, puis petite passe d'équilibrage (aucune arme sous ~10 % du damage meter), avec les retours de jeu des testeurs

**Bloc D — Correctifs de la 0.2** (retours des testeurs sur la 0.2 ; peut sortir à part en 0.2.2 si c'est urgent)
- [ ] Équilibrage confirmé avec les testeurs : ~1 victoire sur 3, aucune arme sous ~10 % du damage meter, boss de 5:00
- [ ] Prix de la Boutique revus une fois tout acheté
- [ ] Bugs et retours signalés sur la 0.2 <!-- TODO: liste à compléter avec les retours des testeurs -->
  - [x] Retours de jeu du 2026-11-23 (bot, Aura imposée niv 5, 20 parties : sans mutation 8:51 → 8:51, Givre 9:05 → 8:47, Fournaise 7:13 → 8:30) :
    - [x] **Fournaise trop faible** : une onde toutes les 1,8 → 1,5 s, petits ×0,2 → ×0,5 (+ pénétration 30 du bloc B)
    - [x] **Aura de givre un peu trop forte** : nerfée par l'immunité des élites et du boss, sans toucher à ses chiffres (elle revient au niveau de l'Aura sans mutation)
    - [x] **Élites : 50 % de recul en moins** qu'avant : `knockbackFactor` 0,75 → 0,375 (rapide élite), 0,5 → 0,25 (basique élite)
    - [x] **Élites et boss insensibles au ralentissement** : `slowResist` 1 (boss 0,85 avant, élites 0)
    - [x] **Sans fin : +10 % de résistance au ralentissement par minute**, plafond 80 % (`ENDLESS.slowResistPerMinute`, `Enemy.slowResist`)
- [ ] Limite connue : petits ennemis coincés entre deux tanks, à reprendre seulement si les testeurs le remarquent

**Sortie**
- [x] Version 0.3.0 (`package.json`, `CHANGELOG.md`), zip `release/survivor-0.3.0-itch.zip` (2026-11-23)
- [ ] Zip testé sur itch, tag `v0.3.0` poussé
- Sortie décidée avant l'équilibrage des nouvelles armes et le bloc D : ce sont les testeurs qui donneront les retours (choix de l'utilisateur). Reste pour la **0.3.1** : équilibrage des 4 nouvelles armes au bot et en jeu, bloc D (équilibrage confirmé, prix de la Boutique, retours des testeurs)

**Ce qu'apporte la 0.3 (côté joueur) :** 8 armes au lieu de 4, chaque arme physique ou magique, des ennemis qui résistent à l'un des deux types, la pénétration pour percer leurs défenses, et les correctifs de la 0.2.
- **Finie quand :** une arme d'un type existant s'ajoute en ne touchant que `data/` ; le bot montre qu'aucun type de dégâts ne domine ; les testeurs de la 0.2 confirment l'équilibrage.

### 0.4 — Le niveau en 30 min `[grosse]`
But : passer de 10 à 30 min sans temps mort. Plan détaillé à faire au début de la version (comme pour la 0.3).

**Bloc A — Refactors** (le bot donne les mêmes chiffres avant et après)
- [ ] `StageDef` (`data/stages.ts`) : vagues, boss, élites, rushs, durée, sol, musiques ; `BOSS_TYPE` remplacé par un champ `boss` sur le type d'ennemi
- [ ] `RunFlow` (fin de partie, sans fin, bilan, enregistrement) sorti de `GameScene`

**Bloc B — Bestiaire**
- [ ] 8 à 10 types d'ennemis (dont des blindés), apparences par palier de temps <!-- TODO: quels paliers ? -->
- [x] **Tank redessiné en démon rouge** (avancé en 0.2.2) : l'orc `ogre` du pack repeint aux couleurs des démons, cornes en croissant, yeux blancs (`tools/sprites/tank-demon.mjs`, atlas `sprites/monsters/` collé sous celui du pack, l'ogre en secours). Comparaison : `tools/sprites/variants-preview.html`
- [ ] Plus d'élites, avec leurs propres capacités

**Bloc C — Boss**
- [ ] 3 boss (10:00, 20:00, 30:00) aux sprites différents, nouvelles capacités (projectiles, zones au sol)

**Bloc D — Rythme des 30 min**
- [ ] Vagues jusqu'à 30:00, sans fin après
- [ ] **Objets rares** des caisses : arrêt du temps, 20 or, bombe (tout sauf les boss) <!-- TODO: chance d'apparition, durée de l'arrêt du temps -->
- [ ] Courbe d'XP refaite (build complet vers 25 min)

**Bloc E — Progression longue** (remplace « armes au niveau 12 / emplacements 5 + 5 » : des choix plutôt que des chiffres en plus ; peut sortir à part en 0.4.x)
- [ ] **Enchantements** (avancés de la 0.6) : le niveau 6 d'un passif enchante une arme au choix. L'effet dépend **du passif seul** et passe par des stats communes à toutes les armes (pénétration, type de dégâts, effets d'état, taille…). Un seul enchantement par arme. Effets des passifs existants en 0.4, ceux des nouveaux passifs en 0.6 <!-- TODO: les effets (pistes : Puissance = +pénétration, Duplicateur = change le type de dégâts, Vitalité = soin au kill…) -->
- [ ] **Piste : mutation personnalisée** (idée de l'utilisateur, à concevoir) : après la mutation (niv 6), les niveaux 7 à 11 sont des choix, et le niveau 12 donne une **mutation améliorée** qui dépend de ces choix <!-- TODO: forme des choix, nombre de versions finales, et si on garde les deux (enchantements + niv 12) ou un seul -->
- [ ] Courbe d'XP et « build complet à » revus avec le bot une fois ce bloc fait

**Ce qu'apporte la 0.4 (côté joueur) :** une partie de 30 min, 3 boss, un bestiaire 3 fois plus grand, des objets rares dans les caisses, les enchantements (et peut-être les mutations personnalisées).
- **Finie quand :** une partie de 30 min se joue de bout en bout, sans temps mort ni build complet trop tôt.

### 0.5 — Persos, ultis, bestiaire `[grosse]`
- [ ] 8 persos (un par arme de départ) avec leurs stats : PV, vitesse, dégâts et armures physiques / magiques, pénétration
- [ ] **Ulti par perso** : jauge, bouton dans le HUD, effets faits de briques existantes (zone, rafale, invincibilité, ralentissement…) + effets PVFX, flash, tremblement ; recharge longue, boss peu touchés <!-- TODO: touche manuelle (Espace, recommandé) ou automatique ; jauge remplie par les kills (recommandé) ? -->
- [ ] Sauvegarde v2 : migration testée depuis la v1, copie de secours, export / import en texte ; sauvegarde rangée dans `src/save/`
- [ ] **Bestiaire** : ennemis déjà vus (PV, vitesse, dégâts, résistances) et armes déjà jouées (niveaux, mutations)
- [ ] ~30 déblocages
- **Finie quand :** une sauvegarde 0.4 se charge sans perte ; chaque perso a une raison d'être joué.

### 0.6 — Fin de l'arsenal `[moyenne]`
- [ ] Armes 9 à 12, passifs jusqu'à ~12, avec leurs enchantements (le système arrive en 0.4)
- [ ] **Revue de toutes les icônes** une fois l'arsenal complet (12 armes, leurs mutations, ~12 passifs) : vérifier qu'elles se distinguent toutes d'un coup d'œil (couleurs, formes), en changer si besoin. Choix actuels dans `tools/ui/copy-raven.mjs` ; planche numérotée du pack à refaire pour comparer
- **Finie quand :** tout le contenu de la 1.0 est dans le jeu, même pas encore poli.

### 0.7 — Identité et bêta `[moyenne]`
- [ ] Nom du jeu et pitch (§ 1), logo, écran titre, écran de crédits
- [ ] Tutoriel léger au premier lancement
- [ ] Manette (Gamepad API, sans dépendance), choix des touches
- [ ] **Passe UX complète**, guidée par des testeurs qui découvrent le jeu :
  - infos en partie : armes et passifs avec leurs vraies stats dans le menu pause
  - lisibilité dans la mêlée : nombres de dégâts, effets avec 500 ennemis à l'écran, d'où viennent les coups reçus
  - accessibilité : taille du texte, mode daltonien (cartes et gemmes reposent sur la couleur), réduction des effets
  - souris partout (chaque écran utilisable sans clavier)
  - cohérence : mêmes boutons et raccourcis affichés partout, retour sonore et visuel sur chaque action
  - **refonte UX et UI de l'écran Profil** (demandée le 2026-11-21) : organisation des stats, lisibilité, place du bestiaire et des stats par perso (0.5) <!-- TODO: ce qui ne va pas aujourd'hui, ce qu'on veut y voir -->
- [ ] Son (déplacé de la 0.2 le 2026-11-21 : pas bloquant pour « une partie juste ») : musique de partie plus longue (44 s aujourd'hui) et musiques du niveau de 30 min, reprise là où elle en était après un boss, retouches des bruitages et des jingles
- [ ] Testeurs extérieurs, corrections, équilibrage final, perf
- **Finie quand :** quelqu'un qui découvre le jeu le comprend sans explication ; deux semaines sans bug bloquant signalé.

### 1.0 — Sortie gratuite `[petite]`
- [ ] Licences et crédits vérifiés (Raven gratuit suffit pour un jeu gratuit sans pub ni achats ; **pas de dons** sans revérifier sa licence)
- [ ] Licence du code décidée <!-- TODO: aucune (tous droits réservés) ou MIT -->
- [ ] Tag `v1.0.0`, page itch finale (captures, GIF), annonce

### Après la 1.0
- [ ] 2e niveau (autre bestiaire, morts-vivants envisagés) ; puis d'autres niveaux
- [ ] Version PC (Electron ou Tauri)
- [ ] Langue anglaise (i18n) <!-- TODO: à décider ; si oui, la mettre en place avant d'écrire beaucoup de textes -->

---

### Historique — phases 0 à 7 (avant la roadmap versionnée)

Les tâches ouvertes de cette époque sont reprises dans les versions ci-dessus (↪).

#### Phase 0 — Setup
- [x] Projet Vite + TypeScript strict, ESLint, Prettier, Vitest
- [x] Canvas plein écran avec mise à l'échelle 1280×720
- [x] Game loop fixed timestep + overlay FPS

#### Phase 1 — Bouger
- [x] Input clavier
- [x] Joueur qui se déplace (diagonale normalisée)
- [x] Caméra qui suit le joueur + sol/grille de fond pour voir le mouvement
- [x] Interpolation au rendu + pause simple (Échap / P)

#### Phase 2 — Ennemis
- [x] Spawn hors écran + poursuite du joueur (spawn temporaire, recyclage des ennemis lointains)
- [x] Object pool (+ debug F4 : +100 ennemis)
- [x] Timer de survie en haut à droite (avancé depuis le HUD de la Phase 4)
- [x] SpatialGrid + séparation entre ennemis (+ contact joueur détecté, F3 ×2 = hitboxes)
- [x] Collisions joueur/ennemi, PV, délai de coup par ennemi, mort (barre de PV sous le joueur, écran de mort, R = rejouer)
- [x] Pause automatique quand l'onglet est caché

#### Phase 3 — Combat
- [x] Arme 1 (projectile auto vers l'ennemi le plus proche)
- [x] Dégâts, mort des ennemis, kills (+ stats par arme pour un futur damage meter)
- [x] Feedback visuel (flash blanc des ennemis touchés, nombres de dégâts)
- [x] Gemmes d'XP + aimant (compteur "XP" temporaire sous le timer)

#### Phase 4 — Progression `[MVP atteint ici]`
- [x] Level up + écran de choix (3 upgrades) + barre d'XP et niveau
- [x] Upgrades passifs (Vitalité, Célérité, Attraction, Puissance, Hâte) + niveaux du Trait arcanique
- [x] Armes 2 et 3 (Aura ardente, Orbes runiques) + nouvelle arme garantie au level up tant qu'on a < 3 armes
- [x] Vagues data-driven (`data/waves.ts`) + boss à 5:00 et 9:00
- [x] Timer, écran Game Over / Victoire (+ damage meter), rejouer
- [x] HUD : PV, barre d'XP, niveau, timer, kills

**✅ MVP atteint (2026-11-10)** : run complète de 10 min, 3 armes auto, XP, level up, mort ou victoire, rejouer.

#### Après le MVP — idées validées, à planifier
- [x] **Mutations d'armes** : le niveau 6 de chaque arme ; ses 2 variantes entrent dans le tirage normal du level up une fois l'arme au niveau 5 (choix définitif, ★ dans le HUD et le damage meter). Données : `mutations` dans `data/weapons.ts`
  - [x] Effets d'état : ralentissement, poison (`systems/status.ts`)
  - [x] Aura (les 2 brûlent toutes les 0,6 s), remplacées le 2026-11-21 par Aura de givre / Fournaise : **Brasier** (rayon ×1,6, dégâts ×0,6, ralentit 30 %) / **Aura toxique** (poison pendant 3 s = 60 % des dégâts de l'aura par seconde, soit 6/s au niveau 5 sans bonus)
  - [x] Trait arcanique : **Trait perçant** (traverse 5 ennemis, dégâts ×0,9) / **Trait éclaté** (explosion 75 px, 70 % des dégâts, anneau visuel)
  - [x] Orbes runiques : **Orbes géants** (3 orbes ×2,2, dégâts ×2, rotation ×0,85, recul ×1,6) / **Tempête d'orbes** (9 orbes, rotation ×1,6, recul ×0,3)

#### Phase 5 — Contenu & systèmes (pas de visuel)
- [x] Menu principal fonctionnel (Jouer, Options grisé en attendant l'étape Options), HTML basique ; M sur l'écran de fin = retour au menu
- [x] Menu pause complet (Reprendre, Rejouer, Quitter vers le menu) : boutons + Échap/P, R, M
- [x] Options + sauvegarde des réglages (localStorage) : nombres de dégâts, compteur FPS, pause quand l'onglet est caché (volume et screen shake en Phase 6)
- [x] Emplacements limités (4 armes, 4 passifs) + XP requise revue à la hausse (le build complet arrivait avant le boss de 9:00) + « build complet à mm:ss » sur l'écran de fin
  - ↪ 0.2 / 0.4 : `steepFactor` (0,75), objectif build complet
- ↪ 0.2 : Équilibrage : passe complète armes, mutations, vagues, boss
- [x] **Profil / statistiques** : bouton Profil du menu ; parties, victoires, meilleur temps, temps total, kills totaux, meilleur niveau, arme la plus jouée, et par arme parties / dégâts / kills cumulés (`data/profile.ts`, sauvegarde versionnée). Seules les parties terminées (mort ou victoire) comptent
- [x] **Mode sans fin** après la victoire (C sur l'écran de victoire) : difficulté qui monte chaque minute, boss toutes les 3 min, « SANS FIN » dans le HUD
- [x] Persos de départ (une arme chacun) + défis de déblocage + sauvegarde localStorage (§ 5.9) : écran de choix après Jouer (clic ou 1-2-3), cartes verrouillées avec défi et progression, « Nouveau perso débloqué » sur l'écran de fin (`data/characters.ts`)
- [x] Mobilier cassable : or et nourriture (+20 PV) (§ 5.9) — étape 1 : caisses (type d'ennemi « objet »), pièces et nourriture à l'aimant, or dans le HUD, l'écran de fin et le profil, +100 or dans le menu de test
- [x] Boutique de bonus permanents au menu (§ 5.9) — étape 2 : bouton Boutique, achat rang par rang, bonus appliqués au début de chaque partie (`data/shop.ts`)
  - ↪ 0.2 : les prix, selon l'or gagné par partie
- ↪ 0.4 : Enchantements (design revu : l'effet dépend du passif seul ; avancés de la 0.6 le 2026-11-21)
- [x] **4e arme : l'Épée** : coup en arc dans la direction de marche ; mutations **Tourbillon** (360°, dégâts ×0,75) / **Lame d'onde** (vague perçante ~300 px, 60 % des dégâts, remplacée par l'Estoc le 2026-11-21) ; Duplicateur sans effet sur elle (nerf du 2026-11-12, c'était un combo) ; perso **Lame-mage** (3 000 kills cumulés avec l'Épée)
- [x] Nouveaux passifs : **Taille** (+4 %/niv, 5 niv : projectiles, orbes, aura, explosions ; l'orbite seulement à 30 % du bonus, soit +6 % au max), **Vélocité** (+5 %/niv, 5 niv : vitesse et portée des projectiles, rotation des orbes), **Duplicateur** (+1 projectile et +1 orbe par niveau, 3 niv max, mutations comprises, ni l'aura ni l'Épée)
- [x] **Capacités des boss** : charge annoncée (tous), invocation annoncée (9:00 et sans fin) (§ 5.5)
- [x] **Mini-boss** : rapide élite à 3:00, basique élite à 7:00 (§ 5.5)
- ↪ 0.4 : Autres capacités de boss (projectiles, zones au sol...) et capacités propres aux élites
- ↪ 0.3 / 0.5 : Stats avancées par perso : armure physique / magique, **pénétration** physique / magique, dégâts physiques / magiques, vitesse... Les ennemis pourront aussi avoir de l'armure (tanks qui encaissent), que la pénétration réduit

#### Phase 6 — Visuel & audio
- [x] Design de l'UI (HUD, menus, écrans de fin) : pack **Dark Ages UI** (cadres, barres ; ignoré par git, licence) + **Kenney Fantasy UI Borders** (CC0, à venir pour les cartes et cases)
  - [x] Étape 1 : palette en variables CSS, cadres en 9 morceaux (`border-image`) sur boutons, lignes des menus et cartes, titres dorés
  - [x] Étape 2 : HUD (barres de PV / XP encadrées, niveau sur plaque à couronne, timer centré, crâne et pièce de 0x72, cases d'inventaire du pack)
  - [x] Étape 3 : cartes de level up (cadres Kenney teints par `tools/ui/tint-kenney.mjs` : bleu arme, vert passif, rouge soin, or + lueur mutation ; étiquette « 1 · Passif »)
  - [x] Étape 4 : menus (grand cadre doré autour du contenu, titre qui luit, portrait animé de chaque perso sur sa carte, silhouette si verrouillé)
  - [x] Étape 5 : écran de fin (vignette rouge ou dorée, bilan en tuiles, bandeau doré des déblocages, damage meter dans le grand cadre)
  - [x] Police pixel **DUNGEON.mode** (datagoblin, CC0, accents compris) partout sauf les outils de dev (F2, F3) ; nombres de dégâts aussi ; conteneurs élargis (police large)
  - [x] Icônes d'armes et de passifs : pack **Raven Fantasy Icons** (version gratuite pour développer ; **Premium 35 $ obligatoire avant de vendre le jeu** ; fichiers ignorés par git) : 21 icônes choisies dans `tools/ui/copy-raven.mjs`, dans les cases du HUD (48 px) et sur les cartes de level up, texte de secours si le pack manque
- [x] Sprites et animations : pack **0x72 DungeonTileset II** (CC0) pour les persos, les ennemis, le sol et les objets ; effets Foozle / PVFX Foundry (CC0) ; police m5x7 (CC0). Le script `tools/sprites/build.mjs` ne sert plus qu'à ce qui manque (gemmes d'XP...)
  - [x] Premier essai généré par script : joueur, basique, boss (remplacé par le pack)
  - [x] Pack téléchargé (`public/assets/sprites/0x72/` : atlas + `tile_list_v1.7`), `public/assets/LICENSES.md` ; choix validés : joueur `wizzard_m`, basique `chort`, rapide `imp`, tank `ogre`, boss `big_demon`, élites = basique / rapide teintés, caisse `crate`, pièce `coin_anim`, nourriture `flask_red`, sol `atlas_floor`
  - [x] Branchement dans le rendu (sprites animés, retournés selon la direction, teinte des élites)
    - [x] Étape 1 : `core/SpriteAtlas` (atlas + liste, copies miroir et teintées préparées une fois), `data/sprites.ts`, le mage
    - [x] Étape 2 : ennemis (tournés vers le joueur, flash blanc, élites dorées ×3, animations décalées, barre de PV au-dessus de la tête)
    - [x] Étape 3 : sol (motif de dalles tirées avec la seed, assombri), caisse, pièces animées, potion
  - [x] Visuels des armes (taille des sprites calculée depuis les hitbox / rayons du gameplay)
    - [x] Étape 1 : atlas `fx` généré par le script (gemmes par palier, Trait arcanique orienté, orbe runique ; gris teints à la couleur de l'arme)
    - [x] Étape 2 : effets PVFX Foundry (CC0, style « strict ») : explosion `arcane-burst`, slash `axe-smear` de l'Épée (découpé à la zone qui frappe), `wind-blade` pour la Lame d'onde. L'aura garde son disque (flammes le long du cercle essayées puis retirées : « trop bizarre »). Foozle écarté (rouge-orange, hors thème)
  - ↪ 0.4 : Une apparence par palier de temps pour chaque type d'ennemi
  - ↪ après la 1.0 : Autres bestiaires que les démons (morts-vivants...) pour les prochains niveaux
- [x] Screen shake, particules
  - [x] Étape 1 : screen shake (trauma dans la Camera, chocs dans `data/feel.ts`, option « Tremblement de l'écran »)
  - [x] Étape 2 : particules (`ParticleSystem` en pool de 600 : morts d'ennemis, caisses, level up)
- [x] Retouches (2026-11-18) : 1) écran de fin agrandi et cartes de mutation remises en forme, 2) visuel de l'aura, 3) écran titre et son fond, 4) publication (finalement itch.io, voir Phase 7)
  - [x] Étape 1 : écran de fin (titre 64 px, tuiles en 32 px, damage meter sur une ligne par arme sans chevauchement) ; cartes de mutation (320 px, icône 48 px, nom sans ★ + arme d'origine dessous, « ★ Niveau 6 · définitif ») ; dégradé de la carte de mutation étalé sur tout le cadre (il se répétait : bandes noires) ; plus aucune lueur floue sur les textes (titres, MORT, titre du menu) : ombre dure seule
  - [x] Étape 2 : aura = anneau de braises carrées (pixels de 2 px) sur le bord de la zone, qui tourne et scintille, trait sombre dessous, disque très léger, étincelles qui montent (aléatoire séparé) ; une apparence par aura dans `AURA_LOOKS` (`data/feel.ts`) : feu, Brasier plus dense et vif, Aura toxique verte qui tourne à l'envers avec des bulles lentes
  - [x] Étape 3 : écran titre = fond animé dessiné par MenuScene (sol du donjon qui défile, démons qui passent, vignette ; `MENU_BACKDROP` dans `data/sprites.ts`, sol partagé via `scenes/floor.ts`) ; titre en lettres dorées à 3 bandes nettes et contour noir dur (sans halo), volutes du pack dessous ; voile sombre sur les autres écrans du menu ; « Niv N » centré dans le corps de la plaque (sous la couronne) ; écrans de fin sur un voile sombre neutre (plus de lueur rouge ou dorée)
- [x] Sons et musique + option volume
  - [x] Étape 1 : 18 bruitages générés par `tools/audio/build-sfx.mjs` (synthé rétro maison, WAV, CC0), page d'écoute `tools/audio/preview.html` (bouton « Rafale » pour juger la fatigue) ; sources de la musique dans `docs/sons.md`
  - [x] Étape 2 : 5 musiques choisies (Junkala, Kenney), converties en OGG à −16 LUFS dans `public/assets/audio/music/` (originaux dans `assets-src/`, ignoré par git)
  - [x] Étape 3 : moteur audio (`core/AudioEngine`, Web Audio + compresseur), limiteur par son (`core/SoundLimiter` : délai minimum, copies max, hauteur ±), réglages dans `data/audio.ts` ; sons branchés en jeu et sur les boutons des menus
  - [x] Étape 4 : musique selon l'écran (`core/MusicPlayer` : boucles Web Audio sans blanc, fondus de 0,8 s, chargée au premier besoin) : menu, partie, boss tant qu'un boss est en vie, jingle de victoire / défaite (sans fondu d'entrée, préchargé, volume ×1,8 : avec le fondu de 0,8 s, un jingle de 0,75 s était presque muet) ; plus basse en pause ; son coupé quand l'onglet est caché ; curseurs Volume général / Musique / Effets sonores dans les Options (sauvegardés)

#### Phase 7 — Déploiement
- [x] Déploiement en ligne : jeu sur **itch.io**, code sur **GitHub** (pas GitHub Pages : voir Journal)
  - [x] Build publiable : base relative (`./`), chemins audio via `BASE_URL`, `npm run release:itch` (build + retrait de la planche Dark Ages + zip `release/survivor-itch.zip`), testé servi depuis un sous-dossier ; README
  - [x] Dépôt GitHub créé et code poussé : https://github.com/aGgm0/survivor (branche `main` seulement ; commits signés avec l'adresse anonyme GitHub)
  - [x] Page itch.io (HTML5, 1280 × 720, plein écran) : https://agemo0.itch.io/survivor, lien dans le README. Nouvelle version = `npm run release:itch` (zip `release/survivor-<version>-itch.zip`) puis renvoyer le zip sur la page
- ↪ après la 1.0 : Version PC téléchargeable (Electron ou Tauri autour du jeu web) ; Steam possible ensuite (frais Steam Direct, Steamworks pour les succès)

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
| 2026-11-09 | Spatial hash à seaux (map infinie), cases de 2 × rayon max ennemi | Collisions sans O(n²) ni allocation |
| 2026-11-09 | Le joueur pousse la horde, jamais l'inverse | Le joueur ne doit pas se retrouver coincé |
| 2026-11-09 | Horde en "steering" (vitesse + accélération limitée) au lieu de corrections de position | Les corrections directes faisaient sauter les petits ennemis |
| 2026-11-09 | Répulsion pondérée par la masse (rayon²) ; un gros qui pousse un petit par derrière l'écarte sur le côté et réduit son envie d'avancer (`CROWD` dans `data/physics.ts`) | Demandé : les gros doivent passer devant. Ne s'applique que dans la mêlée, pas de ralentissement global |
| 2026-11-09 | Id d'ennemi = index dans le pool (pas de compteur global) | Même seed → même partie, même après un "rejouer" |
| 2026-11-09 | Le joueur transmet son élan aux ennemis bousculés (au lieu de les téléporter seulement) | Supprime les saccades quand le joueur fonce dans la horde |
| 2026-11-09 | Horde : `massContrast` 2, répulsion raidie (r / (1 - r)), file d'attente (bloqué par un égal devant → arrête de pousser) | Tanks au premier rang autour du joueur, sans se fondre en une seule masse. Version retenue après itérations |
| 2026-11-09 | Délai de coup indépendant par ennemi (0,7 s) au lieu d'une invincibilité globale ; flash blanc au coup reçu | Demandé : la densité de la horde doit être le danger. ⚠️ 20 basiques au contact ≈ 140 dégâts/s, à rééquilibrer en Phase 4 |
| 2026-11-09 | "Rejouer" recrée une GameScene neuve (nouvelle seed) au lieu de réinitialiser l'ancienne | Garantit qu'aucun état ne fuit d'une partie à l'autre (testé) |
| 2026-11-09 | Arme 1 = "Trait arcanique" : 450 px/s, 1,4 s de vie, sans perforation ; sans cible à portée, elle attend (prête) | Réponses aux TODO ; la perforation pourra devenir un upgrade |
| 2026-11-09 | Basique : 10 → 20 PV | Demandé : doit encaisser 2 coups au lieu d'un |
| 2026-11-09 | Chaque arme compte ses dégâts utiles (sans l'excédent) et ses kills | Prépare un futur "damage meter" (classement des armes) demandé pour plus tard |
| 2026-11-09 | Phase 3 : compteur d'XP temporaire sous le timer ; pool de 1000 gemmes ; kills sur l'écran de mort | Validés pour la Phase 3 |
| 2026-11-09 | Pool de gemmes plein : la gemme la plus éloignée du joueur (non attirée) est déplacée sur le kill, avec sa valeur ×0,5 + la nouvelle XP | Version initiale (XP versée à la plus ancienne) rejetée : l'XP restait coincée au loin. Pénalité ×0,5 demandée : ramener l'XP ne doit pas être gratuit. L'XP peut être fractionnaire, le HUD affiche la partie entière |
| 2026-11-10 | Phase 4 validée : noms "Aura ardente" / "Orbes runiques", bonus de niveau d'arme, 5 passifs (5 niv max), soin +30 si tout est max, vagues 0-10 min, boss à 5:00 et 9:00, victoire à 10:00 (ennemis figés) | Tableaux proposés et validés ("ok reco") |
| 2026-11-10 | Spawn temporaire : 2/s → 1,2/s et plus de tanks (40 % basiques, 60 % rapides) | On mourait avant le niveau 2 : tanks et basiques intuables avec une seule arme niv 1. Remplacé par les vagues en 4c |
| 2026-11-10 | Tant que le joueur a < 3 armes, au moins un choix de level up est une nouvelle arme (s'il en reste) | Demandé : sinon on peut enchaîner les passifs et rester coincé avec une seule arme |
| 2026-11-10 | Retours de jeu (3 parties < 5 min) : XP `5 + niv × 7` et XP × multiplicateur de vague ; barre de PV remise sous le joueur (en plus du HUD) ; difficulté des vagues inchangée | "L'XP monte trop lentement" ; "c'est dur mais normal, faut pas que ce soit trop ez" |
| 2026-11-10 | Après les mutations : XP ×4 quand tout est max ; vitesse 6:00/8:00 ×1,25/×1,45 (était 1,15/1,3) ; PV ×2,5/×3,5 (était 2/2,5) ; boss ×3 PV à 5:00, ×8 PV et ×1,2 vitesse à 9:00 | Retour de jeu : "ez victoire", niveau max à 9:00, soins à répétition, ennemis qui n'arrivaient même pas au contact, boss "despawn" |
| 2026-11-10 | Mutations : le level up qui suit le niveau max d'une arme est remplacé par le choix de sa mutation (2 variantes, définitif) | Garanti (pas de carte perdue dans le tirage) ; ça "coûte" un level up, juste vu le gain de puissance |
| 2026-11-10 | Effets d'état = valeur + date de fin en temps de partie ; poison attribué à l'arme (damage meter), renouvelable sans cumul, = 60 % des dégâts actuels de l'aura par seconde (niveaux, mutation et Puissance comptent ; pas Hâte ni Impact) ; 1er tick immédiat, puis toutes les 0,5 s tant qu'on est avant la fin (6/s × 3 s = 6 ticks = 18) | Pas de minuteur à décompter sur chaque ennemi ; pas de poison infini en cumulant ; tick immédiat demandé "comme l'aura de base" |
| 2026-11-10 | Paliers de vitesse (×1,15 à 6:00, ×1,3 à 8:00, pas le boss) ; fin de partie plus dense (9/s à 6:00, 16/s à 8:00, surtout des petits) ; plafond d'ennemis 600 → 900 | Retour d'une partie de 10 min : "trop lents en fin de game", "pas assez de monde". Mesure : un build max tue ~11/s, donc à 11/s il ne restait que ~70 ennemis à l'écran → 16/s validé. Perf : 563 ennemis + 3 armes niv 5 à 116 FPS |
| 2026-11-10 | Inventaire dans le HUD : une case par arme (à sa couleur) et par passif, avec le niveau ; nom complet au survol ; 2 lettres (`short` dans data/) en attendant de vraies icônes | Demandé ("comme dans les jeux du genre") |
| 2026-11-10 | Recul par arme ajouté à la vitesse de l'ennemi (pas à sa position), réduit par sa masse ; passif Impact | Demandé : les orbes doivent pousser plus que l'aura. Via la vitesse : pas de saut. Via la masse : le boss reste dangereux |
| 2026-11-10 | Un seul écran de fin (victoire/défaite) avec bilan + damage meter (dégâts, %, kills par arme) | Le damage meter demandé "pour plus tard" ; les données existaient depuis la Phase 3 |
| 2026-11-10 | PV dans le HUD (barre en haut à gauche), barre sous le joueur retirée ; kills sous le timer | HUD complet du plan Phase 4 |
| 2026-11-10 | Boss : PV fixes (1000, comme le brief), sans le multiplicateur de vague | Respect du brief ; le boss de 9:00 sera peut-être trop faible, à revoir en jouant (→ remplacé : multiplicateurs par boss, voir plus haut) |
| 2026-11-10 | Grille spatiale : cases calées sur le tank (48 px), pas sur le boss (96 px) | Des cases 4× plus grandes pour un seul boss ralentiraient toutes les recherches de voisins |
| 2026-11-10 | Aura : horloge de dégâts par ennemi (brûlé dès l'entrée, puis toutes les 0,5 s) au lieu d'un tick commun | Demandé : avec un tick commun, un ennemi entré juste après un tick traversait ~0,5 s sans dégâts |
| 2026-11-10 | Toutes les armes infligent leurs dégâts via une seule fonction (`damageEnemy`) | Damage meter cohérent, quel que soit le type d'arme |
| 2026-11-10 | Trait arcanique multi-projectiles : éventail de 12° centré sur la cible | Le brief dit "+1 projectile" sans préciser la forme |
| 2026-11-10 | Choix de level up tirés avec l'aléatoire du jeu ; l'UI ne fait que mémoriser le clic, lu par la scène dans son update | Partie reproductible ; toute la logique reste dans la game loop |
| 2026-11-10 | Phase 5 découpée : 5 = contenu & systèmes (menus fonctionnels, options, équilibrage, méta-progression), 6 = visuel & audio (UI, sprites, shake, particules, sons), 7 = déploiement | Finir le fond avant la forme : pas de sprites pour des ennemis/armes qui changeront à l'équilibrage |
| 2026-11-10 | Menu principal = `MenuScene` (une scène neuve à chaque retour) + overlay HTML ; le clic est mémorisé et lu dans l'update ; HUD masqué hors partie ; titre "SURVIVOR" provisoire ; M (code `KeyM` ou `Semicolon` pour AZERTY) = menu depuis l'écran de fin | Même principe que le level up et le "rejouer" : logique dans la game loop, aucun état qui fuit. Nom du jeu toujours en TODO (thème fantasy envisagé) |
| 2026-11-11 | Menu pause : 3 boutons (Reprendre, Rejouer, Menu principal) avec les mêmes raccourcis que l'écran de fin (R, M) ; R et M n'agissent qu'en pause ou en fin de partie | Pas de raccourci qui fait perdre une partie en cours par erreur ; une seule logique de touches pour les deux écrans |
| 2026-11-11 | Méta-progression = persos de départ (seulement l'arme pour l'instant) débloqués par des défis faits avec leur arme ; noms provisoires Arcaniste / Pyromancien / Runiste ; stats avancées (armures et dégâts physiques / magiques) plus tard ; mobilier cassable → or / nourriture | Idées validées ("ok reco"). Persos après l'étape Options (qui met en place la sauvegarde) |
| 2026-11-11 | 4 armes et 4 passifs maximum | La run de 10 min n'est qu'une première partie ; des emplacements limités obligent à choisir son build |
| 2026-11-11 | Courbe d'XP : + 0,6 × (niv − 10)² après le niveau 10 ; « build complet à » sur l'écran de fin | Avec 4 passifs, le build complet demande 37 level up au lieu de 47 (−37 % d'XP avec l'ancienne formule) alors qu'il arrivait déjà avant 9:00. Terme au carré : début de partie inchangé (retour "trop lent" d'avant), ≈ 9 300 XP pour tout maxer |
| 2026-11-11 | Défis : Pyromancien = 5 000 kills avec l'Aura ; Runiste = tuer le boss de 9:00 avec les Orbes niv 5 | Demandé (remplace 500 kills / survivre 5:00). Les 5 000 kills sont cumulés sur toutes les parties |
| 2026-11-11 | Boss −20 % de PV : 5:00 ×3 → ×2,4 (2400), 9:00 ×8 → ×6,4 (6400) ; vitesse ×1,2 du 2e inchangée | Retour de jeu après les emplacements 4+4 et la courbe d'XP : 2e boss pas atteint, build moins fort |
| 2026-11-11 | Orbes : délai de re-touche de 0,5 s **par orbe** et par ennemi (tableau `orbitHitAt` de `MAX_ORBS` cases sur chaque ennemi), dégâts inchangés | Retour de jeu : avec un délai commun à toute l'arme, 9 orbes sur le boss = 2 coups/s, comme 2 orbes (Tempête à 12 % du damage meter). Dégâts gardés tels quels, à rééquilibrer en jouant |
| 2026-11-11 | Victoire = timer atteint **et** aucun boss en vie ; sinon prolongations (timer qui continue, dernière vague active) jusqu'à la mort du boss | Retour de jeu : boss tué à 9:59, la partie aurait pu se gagner sans le tuer. Choix "Prolongations" plutôt que défaite à 10:00 ou boss enragé |
| 2026-11-11 | Rushs (`BONUS_WAVES`) 2:00-2:30 rapides +8/s et 6:00-6:30 basiques +12/s ; boss 3000 / 9000 PV ; Impact 25 % → 8 %/niv, recul de base +15 % (185 / 60 / 370), boss immunisé au recul ; courbe d'XP 0,6 → 0,75 | Retour de jeu (victoire, build complet à 08:44, boss trop faible depuis le délai par orbe) ; rushs demandés pour casser le rythme ; +0,75 pour compenser l'XP des rushs |
| 2026-11-11 | Rushs réduits (rapides 8 → 5/s, basiques 12 → 7/s) ; orbite des orbes 80 → 105 px au niveau 5, ×1,25 (≈ 131 px) pour les Orbes géants | Retour de jeu (mort à 7:14) : rushs trop denses, orbes trop collés au joueur surtout en géants. Le reste "pas mal, plus dur" |
| 2026-11-11 | Orbes géants : rotation ×0,85, recul ×1,8 → ×1,6 ; recul de base des orbes 370 → 350 | Retour de jeu : légèrement trop forts. 4e arme (Épée) ajoutée à la Roadmap |
| 2026-11-11 | Options : 3 réglages (nombres de dégâts, compteur FPS, pause quand l'onglet est caché), enregistrés à chaque clic ; `core/SaveStore` (JSON dans localStorage, ne lève jamais) + `data/settings` (version + validation champ par champ, valeurs par défaut sinon) | Pas encore de son pour un volume : réglages utiles dès maintenant. Sauvegarde versionnée pour les persos et l'or à venir |
| 2026-11-11 | Profil : stats cumulées des parties **terminées** (une partie quittée en cours ne compte pas) ; une arme mutée compte sous son arme de base ; arme la plus jouée = le plus de parties, puis le plus de dégâts ; armes inconnues ignorées à la lecture | Demandé. Prépare les défis des persos (kills cumulés par arme). Quitter ne doit pas permettre de gonfler ou fausser les stats |
| 2026-11-11 | Mode sans fin : C sur l'écran de victoire ; montée continue (PV ×1,25/min, +2/s par min, vitesse +3 %/min plafonnée ×1,8), boss toutes les 3 min (×1,5 PV chacun) ; une partie = un seul enregistrement au profil (victoire enregistrée en quittant l'écran, ou à la mort en sans fin, ou en quittant le sans fin par le menu pause) | Demandé ("mode sans fin dès que tu tues le boss"). Pas de double comptage de la même partie ; quitter le sans fin ne fait pas perdre la victoire |
| 2026-11-11 | Profil : un seul « Meilleur temps » (sans fin compris) ; Aura : +2 dégâts au niveau 2, rayon aux niveaux 3-4 ; Tempête d'orbes : recul ×0,3, dégâts ×0,7 → ×0,8 ; Trait arcanique 10 → 11 dégâts | Retour de jeu (sans fin jusqu'à 16:09) : au-delà du dernier boss c'est forcément du sans fin ; Tempête repoussait tout (immobile 12 min sans contact) car le recul tombe à chaque coup d'orbe |
| 2026-11-11 | Trait arcanique 11 → 14 dégâts ; orbes : recul 350 → 200 et dégâts 8 → 10 ; Tempête dégâts ×0,8 → ×1 ; Brasier et Aura toxique brûlent toutes les 0,6 s au lieu de 0,5 s (`cooldownMult` de mutation, la Hâte compte toujours) | Retour de jeu : Trait toujours dernier du damage meter ; le recul des orbes reste trop fort avec un délai par orbe ; l'aura mutée dominait (62-67 %) |
| 2026-11-11 | Mutation = niveau 6 de l'arme : ses 2 variantes sont des cartes du tirage normal (plus d'écran de mutation forcé), l'arme passe niveau 6 | Demandé. Remplace « le level up qui suit le niveau max est remplacé par la mutation » |
| 2026-11-11 | Persos : écran de choix après Jouer ; perso gardé pour « Rejouer » ; défi Pyromancien lu dans le profil (kills d'Aura cumulés), défi Runiste noté pendant la partie (boss n° 1 de BOSS_SPAWNS tué avec les Orbes niv ≥ 5, mutation comprise) puis gardé dans `profile.challenges` ; déblocage annoncé sur l'écran de fin (calculé sur une copie du profil) | Design validé (§ 5.9). Annonce immédiate même si une victoire n'est enregistrée qu'en quittant l'écran |
| 2026-11-11 | Trait perçant 3 → 5 ennemis (dégâts inchangés) ; Trait éclaté rayon 60 → 75 px ; tank 60 → 66 PV et vitesse 50 → 60 ; rapide vitesse 150 → 135 | Retour de jeu (vitesse du tank : d'abord baissée à 45 par erreur, corrigée à 60) |
| 2026-11-11 | Passifs Taille (+7 %/niv), Vélocité (+10 %/niv), Duplicateur (+1, 3 niv max) ; la Taille éloigne l'orbite de 30 % de son bonus seulement (`SIZE_ORBIT_SHARE`) ; le Duplicateur s'ajoute après la mutation ; les projectiles prennent vitesse et taille de l'arme (`Weapon.projectileSpeed`, `range`, `explosionRadius`) ; enchantements = niveau 6 des passifs | Valeurs proposées puis ajustées ("taille 7 %, duplicateur niv max 3"). Tempête + Duplicateur 3 = 12 orbes = MAX_ORBS |
| 2026-11-11 | Gros nerf : Taille 7 → 4 %/niv, Vélocité 10 → 5 %/niv ; gros buff du tank : 66 → 90 PV, vitesse 60 → 72 | Retour de jeu |
| 2026-11-11 | Boss : résistance de 85 % aux ralentissements (`slowResist`, le Brasier −30 % ne le ralentit plus que de 4,5 %) ; basique 20 → 23 PV et vitesse 80 → 88 | Retour de jeu : le Brasier ralentissait beaucoup trop le boss. Basique toujours tué en 2 coups de Trait (14) |
| 2026-11-11 | Épée (mêlée) : 22 dégâts, 1,2 s, 110 px, 120°, recul 260 ; Tourbillon / Lame d'onde ; Duplicateur = combo de coups enchaînés (0,12 s), y compris pour le Tourbillon (un tour de plus) et la Lame d'onde (une vague de plus) ; Taille = portée (pas l'ouverture) ; direction = dernière direction de marche ; perso Lame-mage (3 000 kills) | Design proposé et validé ; « combo » choisi plutôt que « directions » pour que le Duplicateur ne rende pas le Tourbillon inutile |
| 2026-11-11 | Menu de test F2 (`ui/DevPanel.ts`) : dev seulement (`import.meta.env.DEV`, vérifié absent du build) ; jeu figé pendant le réglage ; actions mémorisées puis appliquées dans l'update ; partie de test jamais enregistrée (stats, défis, déblocages) ; saut dans le temps qui saute les boss déjà passés ; baisser un passif recalcule toutes les stats (`rebuildPassiveStats`) | Demandé pour tester plus vite. Une partie trafiquée ne doit pas débloquer de perso ni fausser le profil |
| 2026-11-11 | Vite : `server.watch.usePolling` (200 ms) | Sous Windows, le serveur de dev a raté des modifications et servait l'ancien code (Lame d'onde « sans effet » en jeu) |
| 2026-11-11 | Épée : dégâts 22 → 16 (niv 2 +8 → +5, niv 5 +10 → +7 : 40 → 28 au niv 5), recul 260 → 140 | Retour de jeu : gros nerf demandé. La vague de la Lame d'onde suit (60 % des dégâts) |
| 2026-11-11 | Mobilier = type d'ennemi `crate` avec `prop: true` (immobile, inoffensif, immunisé au recul, ignoré par la visée, hors kills et damage meter) ; cassé aussi en marchant dessus ; pièces et nourriture dans un `PickupSystem` en pool (même aimant que les gemmes) ; boss tué = +25 or ; or ajouté au profil seulement pour une partie terminée et non test | Réutiliser le type ennemi : toutes les armes le touchent sans code en plus. Marcher dessus : sinon le Trait seul ne pouvait pas le casser. Boutique (prix et rangs réduits validés) = étape 2 |
| 2026-11-11 | Boutique : rangs dans `profile.shop` (bornés au max, bonus inconnus ignorés à la lecture) ; achat = fonction pure `buyShopItem` ; bonus appliqués au début de la partie (`applyShopBonuses`, % de la valeur de base) puis PV pleins ; Sagesse multiplie l'XP des gemmes ; le menu de test les remet après un recalcul des passifs | Design validé (rangs réduits) ; les bonus ne prennent pas d'emplacement de passif |
| 2026-11-11 | Mini-boss = types d'ennemis `fastElite` / `basicElite` (flag `elite`) à 3:00 et 7:00 ; capacités de boss dans `BossAbilitySystem` (état et dates sur l'ennemi, mouvement de charge dans MovementSystem) ; direction de la charge fixée au début de l'annonce ; invocation = 5 basiques + 2 basiques élites ; boss de 5:00 sans invocation | Demandé ; « 5 basiques et 2 élites » à la place de 8 basiques. Annonces obligatoires : une capacité qu'on ne peut pas voir venir n'est pas esquivable |
| 2026-11-12 | Charge : vitesse ×4 → ×5, durée 0,5 → 0,7 s (distance ×1,75) ; invocation : 2 → 1 basique élite | Retour de jeu |
| 2026-11-12 | Élites : plus immunisés au recul ; recul = 50 % de leur version normale (`knockbackFactor` 0,75 / 0,5, au lieu du calcul par la masse qui les aurait rendus ~3× moins sensibles) | Demandé |
| 2026-11-12 | Visuels : pixel art de profil 3/4 (sprites tournés vers la droite, à retourner selon la direction ; la vue de face du 1er essai a été rejetée : « trop bizarre », diablotin « mignon »), 1 pixel d'art = 1 px à l'écran pour plus de détail, contour sombre d'1 pixel, ombrage et traits internes calculés par le script (`shape`), corps sombres + couleur du type en accent ; PNG générés par un script sans dépendance (pas de SVG) ; bestiaire de départ = démons ; variantes = une apparence par palier de temps | Réponses aux questions de style (images de référence en 3/4, monde sombre). Le SVG est fait pour du vectoriel lisse, pas pour une grille de pixels |
| 2026-11-12 | Assets : pack 0x72 DungeonTileset II (CC0, cases de 16 px, profil gauche/droite, démons, sol de donjon sombre) au lieu des sprites générés ; effets Foozle / PVFX Foundry (CC0), police m5x7 (CC0) ; aura et gemmes dessinées par nous. Tiny RPG (Zerie) écarté ; sprites agrandis ×2 (boss et élites ×3 pour remplir leur hitbox), pieds posés sur le bas de la hitbox ; hitboxes inchangées ; atlas chargé en arrière-plan (formes simples tant qu'il n'est pas prêt) | Pas de démons chez Zerie (bestiaire démons gardé), licence qui interdit de republier les fichiers (gênant pour un dépôt public), 2,50 $. 0x72 : CC0, même vue que la décision 3/4, monde sombre |
| 2026-11-12 | Flash des ennemis touchés : 0,1 → 0,08 s, au moins 0,25 s entre deux flashs, blanc à 65 % par-dessus le sprite | Retour de jeu : sous un gros DPS les ennemis restaient entièrement blancs |
| 2026-11-12 | Effets PVFX : lecteur de manifeste (`core/EffectSheet`) ; taille de chaque effet calculée depuis le gameplay (zone visible de l'explosion = son diamètre, arc du slash = portée de l'épée, croissant de la vague = diamètre de sa hitbox, tête du Trait et orbe = leur hitbox) ; animations jouées en accéléré (explosion 0,5 s, slash 0,45 s) ; slash découpé (clip) à la part de disque qui frappe | Demandé : « faire gaffe à leur taille ». Retours de jeu : slash à 0,25 s « à 200 km/h » et plus grand que sa hitbox (le sprite balaie ~200° pour un arc de 120°) ; flammes autour de l'aura retirées (« trop bizarre »). Agrandissement parfois non entier (pixels un peu inégaux) : la taille exacte de la zone de dégâts passe avant |
| 2026-11-12 | Nerf : le Duplicateur ne s'applique plus à l'Épée (plus de combo, ni tour de Tourbillon ni vague en plus) | Demandé (retour de jeu) |
| 2026-11-12 | Screen shake par « trauma » (0 à 1, décalage = trauma² × 14 px, −1,6/s) appliqué au seul dessin ; chocs : coup reçu +0,15 (plafond 0,4), charge du boss +0,3, élite tué +0,4, boss tué +0,7, explosion +0,04 (plafond 0,2) ; coupé en pause / level up / fin ; option activée par défaut (anciennes sauvegardes comprises) | Plan validé (« ok reco »). Le plafond évite un écran qui tremble en continu au contact de la horde |
| 2026-11-12 | Particules : carrés de 4 px (6 pour le boss) qui ralentissent et rétrécissent par paliers de 2 px au lieu de s'effacer ; mort = 4 + rayon / 4 éclats à la couleur du type, boss = 60, caisse = 8, level up = anneau de 28 ; aléatoire séparé de celui du jeu ; réserve de 600, le surplus est sauté | Plan validé (« ok reco »). 400 ennemis tués d'un coup : réserve pleine, 180 FPS |
| 2026-11-12 | UI : packs Dark Ages UI (Hypnobius) + Kenney Fantasy UI Borders (CC0) ; Paper UI (parchemin clair) écarté ; Dark Ages ignoré par git (licence : pas de redistribution), découpé par `tools/ui/slice-darkages.mjs` ; cadres en `border-image` ×2, bordure de couleur en secours si le pack manque | Choix de l'utilisateur parmi 3 packs (« Dark Ages + Kenney »). Dark Ages colle au thème sombre ; Paper UI jurait avec le donjon |
| 2026-11-12 | Apparence des persos : Arcaniste = mage (wizzard_m), Pyromancien = mage femme (wizzard_f), Runiste = elfe (elf_m), Lame-mage = chevalier (knight_m) ; même sprite en jeu et sur la carte (`CHARACTER_SPRITES`) ; icônes du HUD = Raven Fantasy Icons | Proposé (héros du pack 0x72), à changer en jeu si besoin. Raven demandé par l'utilisateur |
| 2026-11-12 | Police DUNGEON.mode (CC0) au lieu de m5x7 ; tailles 12 / 16 / 24 px, pas de faux gras (`font-synthesis: none`) | Choisie par l'utilisateur. Glyphes larges (8 × 8) : boutique, profil, options, cartes et damage meter élargis pour éviter les retours à la ligne |
| 2026-11-18 | Sons : bruitages générés par script (`tools/audio/build-sfx.mjs`) plutôt que faits à la main dans ChipTone ; gardés en WAV (l'OGG peut ajouter du silence au début) ; chaque son a un volume, un délai minimum entre deux lectures, un nombre de copies max et une variation de hauteur (`data/audio.ts`) ; compresseur en sortie | « ChipTone c'est trop galère » ; 500 ennemis = des dizaines d'impacts par seconde : sans limite, les sons s'additionnent et saturent |
| 2026-11-18 | Volumes : 3 curseurs (général 80 %, musique 70 %, effets 80 % par défaut) par pas de 10 %, ajoutés aux réglages sans changer de version (ancienne sauvegarde = valeurs par défaut) ; musique au volume de base ×0,55 pour laisser passer les bruitages ; compresseur sur les effets seulement ; musique du boss tant qu'un boss vit (celle de la partie repart du début ensuite) | Demandé (« réglage son, musique, effets sonores ») |
| 2026-11-18 | Mise en ligne : jeu sur itch.io (zip construit en local), code sur GitHub ; pas GitHub Pages | Dark Ages UI et Raven interdisent de redistribuer leurs fichiers : ignorés par git, un build fait par GitHub ne les aurait pas, et les mettre dans une branche publique reviendrait à les republier. Le zip ne garde que les morceaux utilisés (pas la planche complète) |
| 2026-11-18 | Plus aucun halo flou (textes, titre) : ombres dures seulement ; fond du menu animé à la place du dégradé radial | Retour : « trop IA slop », « l'aura néon des textes ça fait IA de fou » |
| 2026-11-18 | Roadmap versionnée 0.1 → 1.0 à la place des phases ; le jeu actuel = 0.1.0 ; numéro unique dans `package.json`, affiché en jeu, tag git + `CHANGELOG.md` | Bilan d'architecture : chaque version doit être publiable et avoir des critères de sortie. 0.1 plutôt que 0.5 : le numéro compte les versions, pas un pourcentage |
| 2026-11-18 | 1.0 = sortie **gratuite** (pas de vente), **un seul niveau de 30 min** ; 2e niveau et version PC après la 1.0 | Choix de l'utilisateur. Raven gratuit suffit pour un jeu gratuit (pas de dons sans revérifier sa licence). 30 min multiplie le contenu par 3 : un seul niveau bien fait plutôt que plusieurs à moitié |
| 2026-11-18 | Stats avancées gardées pour la 1.0 : physique / magique, résistances des ennemis en % (A / (A + 100)), pénétration, jamais d'immunité, carte de l'autre type garantie si le build n'en a qu'un | Argument de l'utilisateur : des ennemis résistants obligent à varier les armes, seul vrai choix du joueur dans un jeu à tir automatique. Le % évite qu'une armure plate rende une arme inutile ou ne serve plus à rien en fin de partie |
| 2026-11-18 | Ulti par perso (jauge, effets faits de briques existantes, pas d'animation du sprite) ; enchantements revus : l'effet dépend du passif seul, appliqué à une arme au choix, un par arme | Ulti : une vraie décision active dans un genre automatique ; les sprites 0x72 n'ont pas d'animation de sort. Enchantements : 12 effets au lieu de 144 (un par couple passif × arme), intenable seul |
| 2026-11-18 | Nouvelles idées validées : relance des cartes de level up, régénération de base 0,1 PV/s, annonces de boss et barres de PV dans la DA, options modifiables en partie, bestiaire (ennemis vus, armes jouées) ; relance et régénération avancées en 0.1 | Proposées par l'utilisateur : la relance compense la chance du tirage, la régén aide sur 30 min. 0.1 : demandé (« ASAP ») |
| 2026-11-18 | Ordre des refactors : rendu puis menu F2 sortis de `GameScene` (0.2), registre de comportements d'armes et événements de partie avant les nouvelles armes (0.3), `StageDef` avant les 30 min (0.4) ; bot de simulation `npm run sim` pour équilibrer | Bilan : `GameScene` (1 393 lignes) concentre rendu, outils et règles ; ajouter un type d'arme touche 5 fichiers ; vagues et boss sont globaux. Seulement ce qui débloque la suite, pas de refactor « pour faire propre » |
| 2026-11-18 | Relance des cartes en 0.1, sans « bannir » pour l'instant | Avec 4 armes et 9 passifs, le tirage est trop petit pour que bannir soit un vrai choix ; à revoir quand le contenu aura grossi |
| 2026-11-18 | Options en partie : bouton et touche O dans le menu pause ; Échap y ramène au menu pause (pas à la partie) ; HUD masqué pendant l'écran Options ; logique partagée avec le menu (`scenes/options.ts`) | Ne pas relancer la partie par erreur en fermant les options ; le titre de l'écran passait sur le timer |
| 2026-11-18 | Plein écran : touche F + case « Plein écran (F) » des Options, demandé directement dans l'événement (pas dans l'update), jamais sauvegardé ; sortir du plein écran met la partie en pause | Le navigateur n'accepte le plein écran que pendant un clic ou un appui (activation utilisateur) et le refuse au chargement ; en plein écran, Échap est gardé par le navigateur et n'atteint pas le jeu. F plutôt que F11 (plein écran du navigateur, qui n'agrandit pas le cadre itch) |
| 2026-11-18 | « Jouer » grisé (« Chargement… ») jusqu'à la fin des 3 chargements (sprites, atlas fx, effets PVFX), réussis **ou ratés** ; sons non attendus ; Boutique, Profil et Options utilisables pendant ce temps | Un fichier manquant ne doit pas bloquer le jeu pour toujours (il se lance en formes simples) ; un son pas encore prêt est seulement muet |
| 2026-11-18 | Recul : multiplicateur global ×1,2 (`KNOCKBACK.forceMult`) plutôt que de toucher chaque arme | Retour de jeu : « on ne le ressent pas » (≈ 5 px pour un basique touché par le Trait, ≈ 10 px maintenant). Un seul bouton pour régler le ressenti ; ×1,3 et ×1,5 proposés, ×1,2 choisi (« léger ») |
| 2026-11-18 | Équilibrage allégé : gemme verte du basique (50 % de chances, ×2 d'XP) au lieu de +50 % d'XP partout ; 0,8 ennemi/s de 0:00 à 0:30 ; chaque coup arrondi à l'entier supérieur ; Trait arcanique 14 → 16 ; passifs ×0,5 dans le tirage avant le niveau 10. **Reportés** : PV de la vague 6:00 (×2,5 → ×2,3) et buff de l'Épée et des Orbes | Retours de jeu « trop dur ». Tout cumulé (dégâts, arrondi, PV de 6:00, XP) faisait ≈ +25 % de DPS effectif : risque de retomber dans « ez victoire ». Passifs : moins souvent plutôt que plus forts, pour ne pas gonfler la fin de partie. Arrondi : un bonus de +3 % ne changeait rien de visible |
| 2026-11-18 | File d'attente de la horde : un voisin devant ne bloque que s'il n'avance pas lui-même (blocage × part de vitesse qui lui manque) | Bug « horde lente, même sur les côtés » : chacun attendait celui de devant même quand il repartait, toute la horde avançait par à-coups à ~40 % de sa vitesse (mesuré : tanks 49 % → 71 %). Joueur immobile : rien ne change. Reste : les petits sont coincés derrière les tanks (plus lents) ; contourner a été essayé, sans effet dans un paquet aussi serré |
| 2026-11-18 | Ennemis distancés : replacés à un angle au hasard sur le cercle de spawn (au lieu de pile en face), seuil 1,5 → 1,35 × le rayon de spawn ; boss et élites toujours replacés en face | Idée de l'utilisateur : on pouvait tourner en rond avec toute la horde en file derrière soi. Redistribuée tout autour, elle remet la pression de tous les côtés. Une menace (boss, élite) ne doit pas disparaître d'un côté pour réapparaître n'importe où |
| 2026-11-18 | Idées notées : objets rares des caisses (arrêt du temps, 20 or, bombe) en 0.4 ; mutations de l'aura glace / feu en 0.3 | 0.4 : il faut des moments forts sur 30 min. 0.3 : va avec les types de dégâts et les autres mutations de l'arsenal |
| 2026-11-18 | Version : `define` de Vite (`__APP_VERSION__`, lu dans `package.json` par import JSON), affichée en bas à droite du menu et de l'écran de fin, `savedWith` dans les sauvegardes (écrit, ignoré à la lecture, sans changer leur numéro de format) | Une seule source pour la version. Import JSON plutôt que `node:fs` : pas de types Node dans le projet (pas de dépendance ajoutée) |
| 2026-11-20 | 0.1.1 de correctifs (lisibilité, pic de 6:00) avant la 0.2 ; ajouts à la 0.2 : soins, or des ennemis, mutations de l'aura glace / feu (avancées de la 0.3), Lame d'onde repensée ; « manque de dégâts » laissé au bot | Retours de 2 testeurs sur la 0.1.0. Un seul avis sur les dégâts : à mesurer avant d'y toucher (risque « ez victoire ») |
| 2026-11-20 | Pic de 6:00 : vague 9 → 7/s et rush 7 → 4/s, rush gardé à 6:00 | Décaler le rush à 6:30-7:00 (prévu) l'aurait collé au basique élite de 7:00. PV et vitesse de la vague inchangés : le reste attend le bot |
| 2026-11-20 | Ajouts à la 0.2 : soins validés (30 % de nourriture, nourriture sur les élites, Vitalité = PV max + régén), gros nerf du recul des Orbes géants, vrais boutons sur l'écran de fin | Retours de jeu après la 0.1.1 : les soins sont la plainte commune aux 2 testeurs ; avec les Orbes géants plus aucun ennemi n'arrive au contact ; l'écran de fin ne donne que des touches |
| 2026-11-20 | Plan de la 0.2 validé : correctifs (soins, Orbes géants, boutons de fin) d'abord, puis refactors, bot, contenu qui touche l'équilibrage, passe d'équilibrage avec le bot, forme. Vitalité +15 PV max et +0,3 PV/s par niveau ; recul des Orbes géants ×1,6 → ×1 ; barres de PV en DA pour le joueur, les élites et les boss seulement ; Lame d'onde → Estoc | « ok reco », sauf le recul (×1 au lieu de ×0,8 recommandé). Barres sur 500 ennemis : illisible et coûteux à dessiner. Équilibrer après tous les changements de contenu, et mesurer avec le bot plutôt qu'au ressenti d'une partie |
| 2026-11-20 | Écran de fin : 3 boutons en ligne (Continuer en sans fin d'abord, seulement après une victoire), clics ignorés pendant 0,5 s, touches C / R / M sans délai | Le choix le plus intéressant en premier ; un clic en rafale au moment de mourir ne doit pas relancer la partie avant qu'on ait vu le bilan. En ligne : en colonne, ça ne tenait pas sous un damage meter de 4 armes |
| 2026-11-21 | Rendu du monde dans `scenes/game/WorldRenderer.ts` ; il ne lit la partie qu'à travers l'interface `WorldView` (joueur, ennemis, armes, systèmes, caméra, `runTime`) ; HUD et overlay F3 restent dans `GameScene.render()` ; les étincelles d'aura restent dans l'update | Le bot de simulation doit faire tourner une partie sans canvas. L'interface limite ce que le dessin peut toucher. Les étincelles créent des particules : c'est de la logique, même si elle est visuelle |
| 2026-11-21 | Menu F2 : seules les modifications pures (armes, passifs, vue du panneau) sortent de `GameScene` ; temps, niveaux, sans fin, or, boss et élites restent dans son `applyDevAction` | Les sortir aurait obligé à rendre publics une dizaine de champs et de méthodes privés (`elapsed`, `killEnemy`, `startEndless`...) : n'importe quel fichier aurait pu modifier la partie |
| 2026-11-21 | Interface HTML en 1280×720 logiques, mise à l'échelle du canvas (`transform: scale`) plutôt que refaite en tailles relatives | Sur un petit écran, le monde rétrécissait mais pas les menus (pixels fixes) : ils débordaient. Une seule échelle garde l'interface alignée avec le monde ; sur l'embed itch (1280×720) rien ne change. En plein écran sur un grand écran, l'interface grossit avec le jeu |
| 2026-11-21 | Échap quitte toujours le plein écran : le plein écran est remis à la reprise (clic sur « Reprendre » ou P), pas avec Échap | Échap est la touche de sécurité du navigateur, impossible à capturer dans le cadre itch (Keyboard Lock : Chrome seul, page principale seule). Le navigateur ne compte pas Échap comme une activation utilisateur, donc il ne peut pas remettre le plein écran |
| 2026-11-21 | Passe UX complète en 0.7, pas de refonte de l'UI avant | De la 0.3 à la 0.6 le contenu change beaucoup (armes, types de dégâts, ultis, 30 min) : une UI polie maintenant serait à refaire. D'ici là, petits correctifs au fil des retours, comme la 0.1.1 |
| 2026-11-21 | Bot de simulation : lancé par Vitest (config `sim/vitest.config.ts`) plutôt que par Node ; réglages par variables d'environnement (`SIM_SEEDS`, `SIM_PERSO`) ; `process` déclaré à la main dans `sim/` | Le code du jeu dépend de Vite (`import.meta.env`, `__APP_VERSION__`, imports sans extension) : Vitest le lance sans nouvelle dépendance. Pas de `@types/node` (décision du 2026-11-18) |
| 2026-11-21 | Le bot teste 16 directions et prend la moins dangereuse 0,4 s plus loin, avec un bonus vers les gemmes et pour tourner autour de la horde ; cartes au hasard (seedé) | Fuir la horde en ligne droite laissait toutes les gemmes derrière (niveau 3 à 3:00) ; additionner les répulsions le bloquait une fois encerclé (4 morts sur 10 avant 2:00). But : un joueur moyen et régulier, pour comparer deux versions, pas un bon joueur |
| 2026-11-21 | Mesure de référence (0.1.3, Arcaniste, seeds 1 à 20) : 0 victoire, mort entre 4:46 et 6:39 (médiane 6:06), niveau médian 13, jamais de build complet ; damage meter : Trait 62 %, Orbes 27 %, Aura 19 %, Épée 6 %. Bench : 0,57 ms / update à 600 ennemis | Point de départ de la passe d'équilibrage. Le bot meurt surtout entre 6:00 et 6:40 (vague de 6:00 et rush) ; l'Épée est sous les ~10 % visés |
| 2026-11-21 | Mutations de l'Aura : **Aura de givre** (rayon ×1,4, dégâts ×0,6, toutes les 0,6 s, ralentit 45 %) et **Fournaise** (souffle commun toutes les 1,5 s, dégâts ×4, recul ×3, disque qui s'allume + explosion + son). Le poison n'a plus d'arme : code gardé pour les enchantements | Plan validé (« ok reco »). Le souffle demande une horloge commune : avec l'horloge par ennemi, il n'y aurait pas de vraie rafale. Bot (Aura imposée niv 5) : givre 8:58, base 8:04, Fournaise 7:27 |
| 2026-11-21 | **Estoc** à la place de la Lame d'onde : portée ×2, 30°, dégâts ×2 (×1,4 proposé, ×2 demandé), recul ×1,5 ; touche un ennemi qui chevauche le cône ; traînée de pixels en damier dessinée par le code. Code de la vague et effet `wind-blade` retirés | Test d'angle seul : un ennemi proche et un peu décalé était raté alors qu'il touche la lame. Pas d'effet d'estoc dans le pack PVFX. Bot (Épée imposée niv 5) : Tourbillon 7:34, Estoc 6:33, sans mutation 6:23 ; Estoc 23 % du damage meter (frappe dans la direction de marche, souvent opposée à la horde) |
| 2026-11-21 | Or des ennemis : basique / rapide 4 %, tank 15 %, une pièce ; tirage séparé (`goldRng`) | Objectif : Boutique (4 050 or) complète en ~25 parties complètes. Tirage séparé : le bot meurt aux mêmes moments qu'avant sur les mêmes seeds. Bot : ~20 or par partie (mort vers 6:00) au lieu de ~4, mais il ne casse pas les caisses |
| 2026-11-21 | Retouches après essai : rayon des 2 mutations de l'Aura +20 % (givre ×1,68, Fournaise ×1,2) ; recul de la Fournaise ×3 → ×1,5 ; souffle = flammes qui jaillissent + anneau de braises qui s'élargit (plus d'explosion violette) ; Estoc vise l'ennemi le plus proche (attend sans cible) ; visuel de l'Estoc = sprite `weapon_knight_sword` qui se fend + trait d'énergie | Retours de jeu : « le souffle c'est bizarre, on ne voit pas le feu », « l'estoc ne ressemble pas à un coup d'arme ». Recul et visée : mesures du bot (Fournaise sous l'aura de base, Estoc 23 % du damage meter). Pas remesuré au bot (retour : le bot prend du temps, à garder pour la passe d'équilibrage) |
| 2026-11-21 | Passe d'équilibrage, cible : environ 1 victoire sur 3 pour un joueur qui connaît le jeu, sans Boutique ; build complet vers 9:00 dans une partie gagnée. Mesure de départ du bot (20 parties par perso) : mort médiane Arcaniste 6:06, Pyromancien 5:17, Runiste 5:34, Lame-mage 4:39 ; niveau à 6:00 entre 10 et 13 ; **aucune mutation dans aucune partie** ; le bot reste niveau 1 avec le Lame-mage (l'Épée frappe dans la direction de marche, il fuit : coups dans le vide) | Retour : « niveau 13 à 6 min c'est faible, sans mutation il est foutu ». Pas de changement de l'XP (choix de l'utilisateur) |
| 2026-11-21 | **Dégâts de toutes les armes ×1,15** (`WEAPON_DAMAGE_MULT`) plutôt qu'un buff des niveaux d'armes | Un buff des niveaux aide surtout les parties qui ont déjà monté ; les dégâts de base aident d'abord celles en retard (le vrai problème). Un seul réglage, entre 10 et 20 % selon le ressenti. Trait 16 → 19 par coup : basique toujours en 2 coups, tank en 5 au lieu de 6 |
| 2026-11-21 | Retours d'une partie gagnée (niveau 14 à 3:25, 42 à 10:00, build complet à 9:49, 287 or) puis 18:20 en sans fin (niveau 59, 801 or) : sans fin = toutes les stats des ennemis montent chaque minute (PV ×1,2, dégâts ×1,1, vitesse +3 % plafond ×3, recul résisté +8 % plafond 80 %, densité +2/s gardée, boss inchangés) ; XP nécessaire ×10 une fois le build complet (XP gagnée inchangée) ; plus de nourriture sur les élites invoqués ni en sans fin ; carte de fin de build +15 PV ou +10 or ; or −50 % ; objets d'un même ennemi écartés | « Sans fin hardcore », « l'XP en fin de partie c'est n'importe quoi », « on drop du heal de malade » (les élites invoqués toutes les 10 s), 622 or à 14:00. Le joueur monte bien plus vite que le bot (niveau 14 à 3:25 contre 7,5 à 3:00) : ses parties priment |
| 2026-11-21 | Fournaise : le souffle sur place devient une **onde de feu** qui s'étend (×1,6 le rayon en 0,4 s, une brûlure par onde) et frappe ×2 les gros (tank, élites, boss) et ×0,6 les autres. Corrigé au passage : un trait de cercle en trop sur les auras (bug du 2026-11-21, `else` mal placé) | Retour de jeu : 11 % du damage meter, « tous les ennemis meurent avant ». L'onde atteint la horde avant les autres armes ; l'anti-gros lui donne une place à côté du Givre (contrôle de la horde). Pistes écartées : souffles plus fréquents, brûlure sur la durée, charge |
| 2026-11-21 | Fournaise : gros ×2 → ×1,4, petits ×0,6 → ×0,2 ; plus d'anneau ni de disque permanents, seulement l'onde | Retour de jeu après essai (capture) : l'anneau constant n'apportait rien, c'est l'onde qui touche |
| 2026-11-21 | Fournaise : portée de l'onde ×1,6 → ×1,1 (×1,32 le rayon de l'Aura de base), une onde toutes les 1,5 s → 1,8 s | Retour de jeu : « trop fort » |
| 2026-11-21 | Épée : on garde la direction de marche (option D) ; arc 120° → 200° (240° au niv 3+), portée 110 → 125 px (150 au niv 5), recul 140 → 170. L'Estoc suit (portée ×2 : 300 px au niv 5) | En reculant, le coup partait souvent dans le vide (6 à 10 % du damage meter, bot bloqué au niveau 1 avec le Lame-mage). Viser l'ennemi le plus proche a été proposé et écarté : le choix de la direction en marchant fait l'identité de l'Épée |
| 2026-11-21 | Son déplacé de la 0.2 à la 0.7 ; Tempête d'orbes laissée telle quelle | Son : la 0.2 vise « une partie juste », le son actuel marche, et le niveau de 30 min (0.4) demandera d'autres musiques. Tempête : un peu moins forte que les Orbes géants, mais elle les rattrape avec les bons passifs (Duplicateur, Vélocité, Taille) |
| 2026-11-21 | Boss de 9:00 : marche ×1,2 → ×2 (140 px/s, joueur 200), annonce de la charge 0,8 → 0,5 s, charge gardée à ~295 px (`dashSpeedMult` 1,2, séparé de la marche) ; les boss du sans fin reprennent ces réglages. Or inchangé (à revoir une fois la Boutique complète) | Retour de jeu : « il faut de la pression ». Sans vitesse de charge séparée, la charge serait passée à ~525 px, presque tout l'écran |
| 2026-11-21 | Mutations : Tourbillon dégâts ×0,75 → ×0,85 et recul ×1,3 ; Trait perçant / éclaté, Givre et Tempête inchangés. Bot (arme imposée niv 5, 20 parties) : perçant 2 victoires / éclaté 6 ; Tourbillon 3 / Estoc 9 (même boss) ; Givre très au-dessus de la Fournaise, mais mesuré avant ses nerfs | Ressenti : le Tourbillon devient inutile quand tout meurt avant, il sert à se dégager. Les deux Traits se valent en jeu. Fournaise : le ressenti du joueur prime (le bot ne joue pas les moments à élites et à boss) |
| 2026-11-21 | Police du texte courant : monogram (32 px, 24 px pour le secondaire) ; DUNGEON.mode reste pour titres, noms, boutons et chiffres | Choisie sur la page de comparaison. 32 px = pixels ×2 exacts (16 px : 1 pour 1, trop petite). 24 px (×1,5) pour le texte à côté d'un nom en DUNGEON.mode 12 px : en 32 px il passait devant le nom (Boutique) |
| 2026-11-21 | Annonces et barres de PV : chevrons pixel pour la charge, anneau pixel pour l'invocation, barres du pack + traînée des dégâts, barre sous le joueur (seulement blessé), grande barre du boss dans le HUD, contour rouge sous 20 % des PV (plus rapide sous 10 %) | « ok reco » ; seuil en % plutôt qu'en PV fixes : les PV max vont de 100 à ~200, et 15 PV = déjà un coup de boss |
| 2026-11-21 | Survol « RPG » (piste A) : curseur ▶ doré en pixels dans le bouton, carte qui monte de 4 px d'un coup avec un contour doré ; cartes refaites d'après une proposition de Claude Design (badge, touche, crans, avant → après, portée en bas, 300 px de haut au moins) ; animations coupées avec `prefers-reduced-motion` | Retour de jeu : « trop simple, ça ne fait pas trop dans la DA ». `button-hover.png` du pack ne diffère du bouton que d'un pixel. Le curseur est dans le bouton : les boutons remplissent leur panneau, il n'y a pas de place dehors |
| 2026-11-21 | Enchantements avancés de la 0.6 à la 0.4, à la place de « armes au niveau 12 / emplacements 5 + 5 » ; idée notée : niveaux 7 à 11 en choix après la mutation, niveau 12 = mutation améliorée selon ces choix (à concevoir) | Argument de l'utilisateur : c'est en 30 min qu'on en a besoin, pour que le build ne soit pas complet trop tôt. Des choix valent mieux que des chiffres en plus. Les stats communes dont ils dépendent (pénétration, types de dégâts) arrivent en 0.3 |
| 2026-11-21 | Tank : l'ogre du pack transformé en démon par un script (couleurs des démons du pack, cornes en croissant choisies parmi 3 essais, yeux blancs) plutôt que dessiné de zéro ; atlas `monsters` collé sous celui du pack au chargement (`SpriteAtlas.stack`), `fallback` vers l'ogre s'il manque | Un premier essai de sprites dessinés de zéro avait été rejeté (« trop bizarre ») ; partir d'un dessin du pack garde le style et les animations. Une seule image au rendu : rien ne change pour les 500 ennemis. Méthode à reprendre pour les élites et les boss (0.4) |
| 2026-11-22 | Bloc A de la 0.3 : comportements d'armes dans `src/weapons/` (un module par type, registre typé : il manque un module → erreur de compilation) ; champs de `Weapon` gardés à plat ; `HIT_SOUNDS` et `AURA_LOOKS` restent des données ; un seul écouteur des événements (`Feedback`), pas de bus générique ; test d'empreinte plutôt que `npm run sim` à chaque étape | Plan validé (« ok reco »). Ranger les champs par type aurait doublé le chantier pour rien. Un bus d'événements attendra un deuxième écouteur (`RunFlow`, 0.4). L'empreinte (7 s) attrape le moindre écart ; le bot (lent) ne sert qu'à la fin |
| 2026-11-23 | Types de dégâts : Épée physique, Trait / Aura / Orbes magiques ; résistances basique 10 / 10, tank 0 / 50, rapide élite 0 / 40, basique élite 50 / 0, boss 30 / 30 ; pénétration par arme et par mutation (Estoc 30, Fournaise 30, Trait perçant 20, autres 0) + passif Pénétration (+10 / niv, 5 niv ; nerf à +5 le même jour : « sinon broken ») ; une pénétration plus forte que la résistance ne donne pas de bonus | « ok reco » + idée de l'utilisateur (chaque ennemi a les deux stats, chaque arme et mutation sa pénétration). Tank résistant à la magie plutôt que blindé : avec une seule arme physique, une armure physique n'aurait affaibli que l'Épée, déjà la plus faible ; ainsi elle devient l'arme anti-tank. Pénétration sur 3 mutations seulement : l'équilibrage reste gérable. Basique 10 / 10 : léger buff demandé, toujours 2 coups de Trait. Bloc C : viser 3 physiques et 1 magique pour 4 / 4 |
| 2026-11-23 | Lisibilité des types : type sur les cartes et coin coloré dans le HUD, nombres gris à partir de 15 % de réduction, aucun repère sur les ennemis ; nouvelle arme de l'autre type garantie à chaque level up tant que le build n'a qu'un type et qu'il reste une place | « ok reco ». Seuil de 15 % : le basique résiste de 9 % à tout, sans seuil presque tous les nombres seraient gris. Bot : la partie est ~25 s plus courte (armure du basique, résistance des tanks), l'Épée est bien plus prise ; à confirmer en jouant |
| 2026-11-23 | Boucliers des résistances à côté des barres du boss et des élites (icônes Raven 597 / 598) ; malus (621 / 622) gardés pour un futur effet « brise-armure » (0.4) | Idée de l'utilisateur, « ok reco ». Aucun effet ne baisse encore l'armure d'un ennemi : la pénétration est celle de l'arme, pas un état de l'ennemi, et elle change d'une arme à l'autre ; une icône de malus aurait été à moitié fausse |
| 2026-11-23 | Retours de jeu : Fournaise une onde / 1,5 s et ×0,5 sur les petits ; élites et boss insensibles au ralentissement ; sans fin +10 % de résistance au ralentissement par minute (plafond 80 %) ; recul des élites −50 % (0,375 / 0,25) ; Givre inchangé en chiffres | « ok reco ». Bot : la Fournaise faisait moins bien que l'Aura sans mutation (7:13 contre 8:51), elle se faisait déborder par la horde (22 % des dégâts de l'Aura sur les petits). Le Givre brillait surtout en gelant élites et boss : l'immunité suffit à le ramener au niveau de l'Aura de base (8:47). Plafond de 80 % : le Givre garde un effet en sans fin |
| 2026-11-23 | Bloc C : Arc (à la place de l'Arbalète), Hache de lancer (aller-retour), Chausse-trapes (zones au sol), Éclair en chaîne ; 4 physiques / 4 magiques. Ordre : Arc (données seules), Éclair, Hache, Chausse-trapes ; une arme essayée en jeu avant la suivante | « ok reco », Arc demandé à la place de l'Arbalète. Risque noté : les Chausse-trapes demandent de tourner autour de la horde, le bot (qui fuit en ligne) les jouera mal. Arc : un champ `look` plutôt qu'une arme qui ressemble au Trait teint en marron |
| 2026-11-23 | 0.3.0 publiée avant l'équilibrage des 4 nouvelles armes et avant le bloc D, repoussés en 0.3.1 | Choix de l'utilisateur : les testeurs donnent les retours d'équilibrage sur les nouvelles armes ; le bot ne joue pas bien les Chausse-trapes ni la Hache (il fuit en ligne) |
| 2026-11-09 | Limite connue acceptée : quelques petits restent coincés au contact, entre deux tanks | Essai de "recul des petits écrasés" non concluant (ils sont à côté des tanks, pas devant), annulé. À revoir si gênant une fois les ennemis tuables |
| 2026-11-09 | F3 : éteint → stats → stats + hitboxes | Dessiner 1000 hitboxes fait tomber à ~48 FPS et fausse la mesure |

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
| **Sauvegarde versionnée** | Données rangées avec un numéro de version, relues sans leur faire confiance (validées champ par champ) pour ne jamais casser une ancienne sauvegarde |
| **Bullet heaven** | Autre nom du genre Survivor : c'est le joueur qui remplit l'écran de projectiles |
