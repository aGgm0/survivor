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
| Délai de coup par ennemi | 0,7 s | Pas d'invincibilité globale : chaque ennemi au contact frappe, puis attend 0,7 s (`data/combat.ts`) |

<!-- TODO: plusieurs personnages jouables ? [LATER] -->

### 5.3 Contrôles

| Action | Touche |
|---|---|
| Déplacement | ZQSD / WASD / flèches (diagonale normalisée) |
| Pause | Échap / P |
| Choisir un upgrade | Clic ou touches 1-2-3 |

### 5.4 Armes `[MVP : 3 armes, 4 depuis l'Épée]`

Toutes les armes tirent automatiquement. Chaque arme a des niveaux 1 → 5. **Emplacements limités : 4 armes et 4 passifs maximum** en même temps (décidé le 2026-11-11 : la run de 10 min n'est qu'une première partie, les runs s'allongeront).

| Arme | Comportement | Dégâts | Cooldown | Notes |
|---|---|---|---|---|
| **Trait arcanique** (projectile) | Tire vers l'ennemi le plus proche à portée ; 450 px/s, 1,4 s de vie (~630 px), disparaît au 1er impact | 14 | 1 s | +1 projectile aux niv 3 et 5 |
| **Aura ardente** (aura) | Brûle chaque ennemi dont le bord touche le cercle (rayon 70 px) : dès qu'il entre, puis toutes les 0,5 s tant qu'il reste dedans (horloge par ennemi) | 5/tick | 0,5 s par ennemi | Niv 2 : +2 dégâts ; niv 3 et 4 : rayon +15 px ; niv 5 : +3 dégâts, rayon +20 px |
| **Épée** (mêlée) | Coup en arc devant le joueur, dans sa direction de marche (gardée à l'arrêt) : 110 px, 120°, chaque ennemi touché une fois par coup | 16 | 1,2 s | Niv 2 +5 dégâts, niv 3 arc +40°, niv 4 délai −20 %, niv 5 +7 dégâts et portée +25 px (28 au niv 5). Recul 140. Duplicateur = combo (+1 coup enchaîné à 0,12 s) |
| **Orbes runiques** (orbite) | 2 orbes de 13 px à 80 px du joueur, 3 rad/s | 10 | contact, 0,5 s de délai de re-touche par orbe et par ennemi | +1 orbe par niveau, +3 dégâts au niv 4, orbite 80 → 105 px au niv 5 (Orbes géants : ×1,25 ≈ 131 px) |

**Recul** (stat par arme, px/s donnés à l'ennemi touché) : Trait arcanique 185 (sens du tir), Aura ardente 60 (depuis le joueur), Orbes runiques 200 (depuis le joueur : jamais renvoyé vers lui). Plus l'ennemi est lourd, moins il recule (tank ~3× moins) ; **le boss ne recule jamais** (`knockbackImmune`). Passif **Impact** : +8 % de recul par niveau.

Détail des niveaux de chaque arme : `src/data/weapons.ts`. Règle de dégâts : **1 dégât minimum** par coup, même avec l'armure. La Hâte accélère les tirs et les ticks d'aura, pas les orbes.

`[LATER]` : évolutions d'armes (arme niv max + objet passif = arme évoluée).

### 5.5 Ennemis `[MVP : 3 types + 1 boss]`

| Ennemi | PV | Vitesse | Dégâts contact | XP | Comportement |
|---|---|---|---|---|---|
| Basique | 23 | 88 | 5 | 1 | Fonce sur le joueur (2 coups de Trait arcanique) |
| Rapide | 5 | 135 | 3 | 1 | Fonce, fragile |
| Tank | 90 | 72 | 10 | 5 | Résistant, presque aussi rapide qu'un basique |
| Boss | 1000 | 70 | 20 | 50 | Apparaît à 5:00 (**×3 PV = 3000**) et 9:00 (**×9 PV = 9000, vitesse ×1,2**) ; rayon 48 px, barre de PV, aucun recul, ne subit que 15 % des ralentissements (`BOSS_SPAWNS` dans waves.ts) |

**Mini-boss (élites)** : anneau doré pulsant, barre de PV, recul 50 % plus faible que leur version normale (`knockbackFactor`), +10 or, XP ×20 (`ELITE_SPAWNS` dans waves.ts) :

| Élite | Arrive à | PV (base) | Vitesse | Dégâts | Rayon |
|---|---|---|---|---|---|
| Rapide élite (orange) | 3:00 | 300 (×60) × vague | 135 | 12 (×4) | 18 |
| Basique élite (rouge) | 7:00 | 1150 (×50) × vague | 97 | 20 (×4) | 25 |

**Capacités des boss** (`BOSS_ABILITIES`), toujours annoncées pour pouvoir les esquiver :
- **Charge** (tous les boss) : toutes les 6 s, arrêt de 0,8 s avec une ligne rouge sur la trajectoire, puis ligne droite à 5× la vitesse pendant 0,7 s (environ 245 px pour le boss de 5:00, 295 px pour celui de 9:00).
- **Invocation** (boss de 9:00 et du sans fin) : toutes les 10 s, cercle violet pendant 1 s, puis 5 basiques et 1 basique élite autour du boss.
- Boss du sans fin : délais ×0,9 à chaque nouveau boss.

Les ennemis spawn **hors écran**, en cercle autour du joueur.

### 5.6 XP & level up

- Les ennemis lâchent des gemmes d'XP, attirées par le joueur quand il est dans le rayon de ramassage.
- XP requise : `xpToNext(level) = 5 + level × 7 + 0,75 × max(0, level − 10)²`, arrondi (`XP_CURVE` dans `data/progression.ts`). Les 10 premiers niveaux gardent l'ancienne courbe ; ensuite elle se durcit (niv 20 : 220, niv 30 : 515).
- L'écran de fin affiche **« build complet à mm:ss »** (moment où plus rien n'est améliorable) pour régler la courbe sur du concret.
- Un ennemi rapporte `XP de base × multiplicateur de PV de sa vague` (plus dur à tuer = plus d'XP).
- Quand tout est au maximum (armes, mutations, passifs), l'XP requise est **×4** (les level up ne donnent plus qu'un soin).
- Au level up : **pause du jeu**, 3 choix aléatoires parmi : nouvelle arme, niveau d'arme (ou sa mutation au niveau 6), passif (9 passifs pour 4 emplacements : Vitalité, Célérité, Attraction, Puissance, Hâte, Impact, Taille, Vélocité, Duplicateur).

### 5.7 Vagues & difficulté

- Défini dans `src/data/waves.ts` : par tranche de temps → types d'ennemis, taux de spawn, multiplicateur de PV.
- Courbe : nombre d'ennemis à l'écran qui monte progressivement (objectif perf : **500+ ennemis à 60 FPS**).
- **Rushs** (`BONUS_WAVES`) : en plus de la vague normale, 2:00-2:30 = +5 rapides/s (≈ 150), 6:00-6:30 = +7 basiques/s (≈ 210). PV et vitesse de la vague en cours.

### 5.8 Fin de run

- **Défaite** : PV à 0 → écran Game Over (temps survécu, kills, niveau atteint, damage meter).
- **Victoire** : survivre jusqu'au timer (10 min pour le MVP) **et** que le boss de 9:00 soit mort → tout se fige, écran de victoire avec le même bilan. Boss encore en vie à 10:00 → **prolongations** : le timer continue (vagues de fin toujours actives) jusqu'à la mort du boss (victoire) ou du joueur (défaite).
- **Mode sans fin** : sur l'écran de victoire, **C** = continuer. Le timer continue, et chaque minute (depuis le début du sans fin) la dernière vague se durcit : PV ×1,25 cumulés, +2 ennemis/s, vitesse +3 % (plafond ×1,8). Un boss toutes les 3 min, 50 % plus résistant à chaque fois (`ENDLESS` dans waves.ts). Seule la mort termine la partie, qui compte comme **victoire + sans fin** (le meilleur temps du profil compte le sans fin).
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
- **Mobilier** : tonneaux / caisses immobiles, cassés par n'importe quelle arme (10 PV) **ou en marchant dessus** (la visée automatique du Trait les ignore). Un nouveau toutes les 15 s hors écran, 8 au maximum. Lâche **85 % or** (1 à 3 pièces, un peu plus en fin de partie) ou **15 % nourriture** (+20 PV), ramassés à l'aimant. **Boss tué = +25 or.** Ne compte ni comme kill, ni dans le damage meter.
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
- [x] SpatialGrid + séparation entre ennemis (+ contact joueur détecté, F3 ×2 = hitboxes)
- [x] Collisions joueur/ennemi, PV, délai de coup par ennemi, mort (barre de PV sous le joueur, écran de mort, R = rejouer)
- [x] Pause automatique quand l'onglet est caché

### Phase 3 — Combat
- [x] Arme 1 (projectile auto vers l'ennemi le plus proche)
- [x] Dégâts, mort des ennemis, kills (+ stats par arme pour un futur damage meter)
- [x] Feedback visuel (flash blanc des ennemis touchés, nombres de dégâts)
- [x] Gemmes d'XP + aimant (compteur "XP" temporaire sous le timer)

### Phase 4 — Progression `[MVP atteint ici]`
- [x] Level up + écran de choix (3 upgrades) + barre d'XP et niveau
- [x] Upgrades passifs (Vitalité, Célérité, Attraction, Puissance, Hâte) + niveaux du Trait arcanique
- [x] Armes 2 et 3 (Aura ardente, Orbes runiques) + nouvelle arme garantie au level up tant qu'on a < 3 armes
- [x] Vagues data-driven (`data/waves.ts`) + boss à 5:00 et 9:00
- [x] Timer, écran Game Over / Victoire (+ damage meter), rejouer
- [x] HUD : PV, barre d'XP, niveau, timer, kills

**✅ MVP atteint (2026-11-10)** : run complète de 10 min, 3 armes auto, XP, level up, mort ou victoire, rejouer.

### Après le MVP — idées validées, à planifier
- [x] **Mutations d'armes** : le niveau 6 de chaque arme ; ses 2 variantes entrent dans le tirage normal du level up une fois l'arme au niveau 5 (choix définitif, ★ dans le HUD et le damage meter). Données : `mutations` dans `data/weapons.ts`
  - [x] Effets d'état : ralentissement, poison (`systems/status.ts`)
  - [x] Aura (les 2 brûlent toutes les 0,6 s) : **Brasier** (rayon ×1,6, dégâts ×0,6, ralentit 30 %) / **Aura toxique** (poison pendant 3 s = 60 % des dégâts de l'aura par seconde, soit 6/s au niveau 5 sans bonus)
  - [x] Trait arcanique : **Trait perçant** (traverse 5 ennemis, dégâts ×0,9) / **Trait éclaté** (explosion 75 px, 70 % des dégâts, anneau visuel)
  - [x] Orbes runiques : **Orbes géants** (3 orbes ×2,2, dégâts ×2, rotation ×0,85, recul ×1,6) / **Tempête d'orbes** (9 orbes, rotation ×1,6, recul ×0,3)

### Phase 5 — Contenu & systèmes (pas de visuel)
- [x] Menu principal fonctionnel (Jouer, Options grisé en attendant l'étape Options), HTML basique ; M sur l'écran de fin = retour au menu
- [x] Menu pause complet (Reprendre, Rejouer, Quitter vers le menu) : boutons + Échap/P, R, M
- [x] Options + sauvegarde des réglages (localStorage) : nombres de dégâts, compteur FPS, pause quand l'onglet est caché (volume et screen shake en Phase 6)
- [x] Emplacements limités (4 armes, 4 passifs) + XP requise revue à la hausse (le build complet arrivait avant le boss de 9:00) + « build complet à mm:ss » sur l'écran de fin
  - [ ] À régler en jouant : `steepFactor` (0,75), objectif build complet vers 9:00-9:30
- [ ] Équilibrage : passe complète armes, mutations, vagues, boss (après parties de test)
- [x] **Profil / statistiques** : bouton Profil du menu ; parties, victoires, meilleur temps, temps total, kills totaux, meilleur niveau, arme la plus jouée, et par arme parties / dégâts / kills cumulés (`data/profile.ts`, sauvegarde versionnée). Seules les parties terminées (mort ou victoire) comptent
- [x] **Mode sans fin** après la victoire (C sur l'écran de victoire) : difficulté qui monte chaque minute, boss toutes les 3 min, « SANS FIN » dans le HUD
- [x] Persos de départ (une arme chacun) + défis de déblocage + sauvegarde localStorage (§ 5.9) : écran de choix après Jouer (clic ou 1-2-3), cartes verrouillées avec défi et progression, « Nouveau perso débloqué » sur l'écran de fin (`data/characters.ts`)
- [x] Mobilier cassable : or et nourriture (+20 PV) (§ 5.9) — étape 1 : caisses (type d'ennemi « objet »), pièces et nourriture à l'aimant, or dans le HUD, l'écran de fin et le profil, +100 or dans le menu de test
- [x] Boutique de bonus permanents au menu (§ 5.9) — étape 2 : bouton Boutique, achat rang par rang, bonus appliqués au début de chaque partie (`data/shop.ts`)
  - [ ] À régler en jouant : les prix, selon l'or gagné par partie
- [ ] Enchantements (idée) : le **niveau 6 d'un passif** = un enchantement spécialisé sur une arme au choix (variante du bonus propre à cette arme), comme la mutation est le niveau 6 d'une arme <!-- TODO: effets par couple passif × arme, niveau max des passifs (6 ? 12 ?), coût en XP -->
- [x] **4e arme : l'Épée** : coup en arc dans la direction de marche ; mutations **Tourbillon** (360°, dégâts ×0,75) / **Lame d'onde** (vague perçante ~300 px, 60 % des dégâts) ; Duplicateur = combo ; perso **Lame-mage** (3 000 kills cumulés avec l'Épée)
- [x] Nouveaux passifs : **Taille** (+4 %/niv, 5 niv : projectiles, orbes, aura, explosions ; l'orbite seulement à 30 % du bonus, soit +6 % au max), **Vélocité** (+5 %/niv, 5 niv : vitesse et portée des projectiles, rotation des orbes), **Duplicateur** (+1 projectile et +1 orbe par niveau, 3 niv max, mutations comprises, pas l'aura)
- [x] **Capacités des boss** : charge annoncée (tous), invocation annoncée (9:00 et sans fin) (§ 5.5)
- [x] **Mini-boss** : rapide élite à 3:00, basique élite à 7:00 (§ 5.5)
- [ ] `[LATER]` Autres capacités de boss (projectiles, zones au sol...) et capacités propres aux élites
- [ ] `[LATER]` Stats avancées par perso : armure physique / magique, **pénétration** physique / magique, dégâts physiques / magiques, vitesse... Les ennemis pourront aussi avoir de l'armure (tanks qui encaissent), que la pénétration réduit

### Phase 6 — Visuel & audio
- [ ] Design de l'UI (HUD, menus, écrans de fin)
- [ ] Sprites et animations : pack **0x72 DungeonTileset II** (CC0) pour les persos, les ennemis, le sol et les objets ; effets Foozle / PVFX Foundry (CC0) ; police m5x7 (CC0). Le script `tools/sprites/build.mjs` ne sert plus qu'à ce qui manque (gemmes d'XP...)
  - [x] Premier essai généré par script : joueur, basique, boss (remplacé par le pack)
  - [x] Pack téléchargé (`public/assets/sprites/0x72/` : atlas + `tile_list_v1.7`), `public/assets/LICENSES.md` ; choix validés : joueur `wizzard_m`, basique `chort`, rapide `imp`, tank `ogre`, boss `big_demon`, élites = basique / rapide teintés, caisse `crate`, pièce `coin_anim`, nourriture `flask_red`, sol `atlas_floor`
  - [x] Branchement dans le rendu (sprites animés, retournés selon la direction, teinte des élites)
    - [x] Étape 1 : `core/SpriteAtlas` (atlas + liste, copies miroir et teintées préparées une fois), `data/sprites.ts`, le mage
    - [x] Étape 2 : ennemis (tournés vers le joueur, flash blanc, élites dorées ×3, animations décalées, barre de PV au-dessus de la tête)
    - [x] Étape 3 : sol (motif de dalles tirées avec la seed, assombri), caisse, pièces animées, potion
  - [ ] Gemmes d'XP, aura, orbes, projectiles, effets (Foozle / PVFX)
  - [ ] `[LATER]` Icônes du HUD : pack Raven Fantasy Icons envisagé (version gratuite = jeux gratuits seulement, Premium 35 $ pour un jeu payant ; fichiers à ne pas republier)
  - [ ] Une apparence par palier de temps pour chaque type d'ennemi <!-- TODO: quels paliers (6:00 / 8:00 ?) -->
  - [ ] `[LATER]` Autres bestiaires que les démons (morts-vivants...) pour les prochains niveaux
- [ ] Screen shake, particules (plan déjà proposé : trauma dans la Camera, `ParticleSystem` en pool)
- [ ] Sons et musique + option volume

### Phase 7 — Déploiement
- [ ] Déploiement en ligne (itch.io, GitHub Pages...)
- [ ] `[LATER]` Version PC téléchargeable (Electron ou Tauri autour du jeu web) ; Steam possible ensuite (frais Steam Direct, Steamworks pour les succès)

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
