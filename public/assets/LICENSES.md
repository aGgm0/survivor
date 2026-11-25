# Licences des assets

Chaque asset externe utilisé par le jeu, avec sa source et sa licence.
Avant d'ajouter un pack : vérifier la licence sur sa page (pas de "non commercial", pas d'assets extraits de jeux).

| Dossier | Pack | Auteur | Source | Licence | Ajouté le |
|---|---|---|---|---|---|
| `sprites/0x72/` | 16x16 DungeonTileset II v1.7 | 0x72 | https://0x72.itch.io/dungeontileset-ii | CC0 1.0 (crédit facultatif) | 2026-11-12 |
| `sprites/pvfx/` | PVFX Foundry Thirteen 1.0.0 (9 effets : arcane-burst, axe-smear, metal-clang, barrel-explosion, thorn-wall, snowfall, lightning-whip, arrow-flight, arrow-impact ; style « strict », export « grid ») | Pixel VFX Studio (nerijs) | https://nerijs.itch.io/pvfx-foundry-thirteen | CC0 1.0 pour les `sprite-sheet.png` et `manifest.json` (crédit apprécié : "VFX from PVFX Foundry by Pixel VFX Studio") | 2026-11-12 |
| `sprites/pixel-spells/` | Pixel Spells: Inferno, Storm, Unholy (Free Samples) 1.0 (4 effets : Inferno/Fire/FlameNova, Storm/Azure/ChainLightning, Storm/Azure/LightningStrike, Unholy/Gold/BoneSpikes ; convertis par `tools/vfx/import-pixel-spells.mjs`) | Odd Jelly Games | https://oddjellygames.itch.io/ | Licence Odd Jelly Games v1 : usage dans le jeu permis, **pas de redistribution des fichiers** (ignorés par git, seulement dans le zip itch) ; crédit apprécié : "Art by Odd Jelly Games" | 2026-11-25 |
| `ui/darkages/` | Dark Ages UI v1.0 (planche + découpes de `tools/ui/slice-darkages.mjs`) | Hypnobius | https://hypnobius.itch.io/ | Licence de l'auteur : jeu commercial gratuit ou payant autorisé, modification autorisée, crédit facultatif ; **interdit de redistribuer les fichiers** (ni IA, ni NFT). **Ignoré par git** : copier la planche du pack dans ce dossier puis lancer le script | 2026-11-12 |
| `ui/kenney/` | Fantasy UI Borders 1.0 (cadres 012 et 026, teints par `tools/ui/tint-kenney.mjs`) | Kenney | https://kenney.nl/assets/fantasy-ui-borders | CC0 1.0 (crédit facultatif) | 2026-11-12 |
| `fonts/dungeon-mode.ttf` | DUNGEON.mode (police pixel 8 × 8) | datagoblin | https://datagoblin.itch.io/dungeonmode | CC0 1.0 | 2026-11-12 |
| `fonts/monogram-extended.ttf` | monogram extended (police pixel du texte courant) | datagoblin | https://datagoblin.itch.io/monogram | CC0 1.0 | 2026-11-21 |
| `audio/music/menu.ogg` | JRPG Music Pack #3 [Evil], piste « Evil2 - Catacombs » | Juhani Junkala (SubspaceAudio) | https://opengameart.org/content/jrpg-pack-3-evil | CC0 1.0 (crédit facultatif) | 2026-11-18 |
| `audio/music/run.ogg` | 5 Chiptunes (Action) (« Retro Game Music Pack ») | Juhani Junkala (SubspaceAudio) | https://opengameart.org/content/5-chiptunes-action | CC0 1.0 (crédit facultatif) | 2026-11-18 |
| `audio/music/boss.ogg` | Boss Battle Music (« Epic Boss Battle [Seamlessly Looping] ») | Juhani Junkala (SubspaceAudio) | https://opengameart.org/content/boss-battle-music | CC0 1.0 (crédit facultatif) | 2026-11-18 |
| `audio/music/victory.ogg`, `defeat.ogg` | Music Jingles (jingles_HIT10, jingles_HIT11) | Kenney | https://kenney.nl/assets/music-jingles | CC0 1.0 (crédit facultatif) | 2026-11-18 |
| `ui/raven/` | Raven Fantasy Icons, version gratuite (21 icônes 16 × 16 copiées par `tools/ui/copy-raven.mjs`) | Clockwork Raven Studios | https://clockworkraven.itch.io/raven-fantasy-icons | Version gratuite : usage personnel / jeu gratuit sans pub ni achats intégrés ; **Premium (35 $) obligatoire pour vendre le jeu** ; interdit de redistribuer les fichiers. **Ignoré par git** : relancer le script avec le pack | 2026-11-12 |

Les fichiers de `sprites/` hors des sous-dossiers de packs (`player.png`, `basic.png`, `boss.png`) et le dossier `sprites/fx/` sont générés par `tools/sprites/build.mjs` (création du projet).

Le dossier `sprites/monsters/` est généré par `tools/sprites/tank-demon.mjs` à partir du sprite `ogre` du pack 0x72 (CC0) : repeint et retouché (cornes, yeux). Le CC0 autorise la modification et la publication.

Les bruitages de `audio/sfx/` sont générés par `tools/audio/build-sfx.mjs` (création du projet, CC0). Écoute : `tools/audio/preview.html`.
