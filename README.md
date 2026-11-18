# Survivor

Jeu navigateur de type **Survivor / bullet heaven** : un mage survit 10 minutes à des hordes de démons dans un donjon. Il se déplace, ses armes tirent toutes seules, et il choisit une amélioration à chaque niveau.

**▶ Jouer : _lien itch.io à venir_**

Projet perso pour apprendre l'architecture d'un jeu : boucle de jeu, rendu, collisions, performances. Le moteur est écrit à la main (Canvas 2D + TypeScript), sans moteur de jeu.

## Contenu

- 4 armes automatiques (projectile, aura, orbes, épée), 5 niveaux chacune, puis une mutation au choix au niveau 6
- 9 passifs, 4 emplacements d'arme et 4 de passif
- Vagues sur 10 minutes, rushs, mini-boss, 2 boss avec capacités annoncées (charge, invocation), mode sans fin
- 4 persos à débloquer par des défis, or, boutique de bonus permanents, profil et statistiques
- Pixel art, effets (tremblement de l'écran, particules), bruitages générés par script, musique

Contrôles : **ZQSD / WASD / flèches** pour se déplacer, **Échap / P** pour la pause, **1-2-3** ou clic pour choisir une amélioration.

## Technique

|         |                                                            |
| ------- | ---------------------------------------------------------- |
| Langage | TypeScript strict                                          |
| Rendu   | Canvas 2D natif (pas de moteur) ; menus et HUD en HTML/CSS |
| Build   | Vite                                                       |
| Tests   | Vitest (logique pure : dégâts, XP, vagues, sauvegardes...) |

Quelques choix d'architecture :

- **Boucle à pas fixe** (60 mises à jour/s) et rendu interpolé : le jeu tourne pareil quel que soit l'écran (60, 144 ou 240 Hz).
- **Object pooling** et **zéro allocation** dans la boucle de jeu : 500+ ennemis à l'écran sans saccade du ramasse-miettes.
- **Grille spatiale** pour les collisions et le ciblage : pas de test « tous contre tous ».
- **Data-driven** : armes, ennemis, vagues et sons sont décrits dans `src/data/`. Ajouter une arme, c'est ajouter une entrée de config.
- **Aléatoire seedé** : une même seed rejoue exactement la même partie (pratique pour reproduire un bug).
- **Son** : Web Audio API, avec un limiteur par bruitage pour que des centaines d'impacts par minute ne saturent pas.

```
src/
├── core/      moteur maison (boucle, rendu, pool, grille spatiale, audio), sans gameplay
├── scenes/    menu et partie
├── entities/  joueur, ennemis, projectiles, armes
├── systems/   logique qui agit sur des groupes d'entités (tir, collisions, vagues, XP...)
├── data/      toutes les valeurs de gameplay
└── ui/        HUD et menus (HTML)
```

## Lancer le projet

```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # tests
npm run release:itch   # build + zip pour itch.io (release/survivor-itch.zip)
```

En mode dev, **F2** ouvre un menu de test (armes, temps, boss...) et **F3** affiche les FPS et les hitboxes.

### Assets absents du dépôt

Deux packs ont une licence qui interdit de republier leurs fichiers : **Dark Ages UI** (Hypnobius) et **Raven Fantasy Icons** (Clockwork Raven Studios). Ils ne sont donc pas dans ce dépôt. Sans eux, le jeu marche mais affiche des cadres et des icônes de secours. Pour les installer, voir [`public/assets/LICENSES.md`](public/assets/LICENSES.md).

## Crédits

Sprites : **0x72** (DungeonTileset II, CC0) · effets : **Pixel VFX Studio** (PVFX Foundry, CC0) · interface : **Hypnobius** (Dark Ages UI), **Kenney** (Fantasy UI Borders, CC0) · icônes : **Clockwork Raven Studios** · police : **datagoblin** (DUNGEON.mode, CC0) · musique : **Juhani Junkala** (CC0), **Kenney** (Music Jingles, CC0).

Détail des licences : [`public/assets/LICENSES.md`](public/assets/LICENSES.md).
