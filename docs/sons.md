# Sons et musique : sources retenues

Réponse au prompt de `docs/prompt-sons.md` (recherche du 2026-11-18). Licences vérifiées sur la page de chaque source ; aucun fichier téléchargé ni écouté à ce stade : **choisir les pistes à l'écoute**.

## Choix général

- **Musique** : un seul compositeur, **Juhani Junkala** (compte SubspaceAudio sur OpenGameArt), tout en **CC0**, pistes annoncées « seamlessly looping ».
- **Bruitages** : créés nous-mêmes dans **ChipTone** (sons générés = **CC0**, usage commercial compris, d'après la page de l'outil). Un seul synthé pour les 18 sons = style cohérent, durée et attaque maîtrisées.
- Packs CC0 en secours (voir plus bas).

⚠️ Junkala a deux familles de son : « JRPG » (synthé / orchestral) et « Chiptunes » (8-bit). En choisir **une** pour `menu` / `run` / `boss`, sinon le passage au boss sautera aux oreilles.

## Musique (`music/`)

| Fichier | Source | Licence |
|---|---|---|
| `menu.ogg` | [JRPG Pack 4 Calm](https://opengameart.org/content/jrpg-pack-4-calm) ou piste lente de [JRPG Pack 3 Evil](https://opengameart.org/content/jrpg-pack-3-evil) (tagué dark / horror) | CC0 |
| `run.ogg` | [5 Chiptunes (Action)](https://opengameart.org/content/5-chiptunes-action) : la piste la moins chargée | CC0 |
| `boss.ogg` | [Boss Battle Music](https://opengameart.org/content/boss-battle-music) (« Epic Boss Battle », orchestral) ou la piste la plus intense de 5 Chiptunes | CC0 |
| `victory.ogg`, `defeat.ogg` | [Kenney Music Jingles](https://kenney.nl/assets/music-jingles) (85 jingles, dont une série 8-bit) | CC0 |

## Bruitages (`sfx/`) : recettes ChipTone

Outil : [ChipTone](https://sfbgames.itch.io/chiptone) (alternative : [jsfxr](https://sfxr.me)). Règle : attaque à 0, court, peu de basses pour les sons fréquents.

| Fichier | Recette |
|---|---|
| `bolt-shoot` | Sinus ou triangle, hauteur qui descend vite, 0,1 s |
| `bolt-burst` | Bruit blanc + carré grave, descente, 0,3 s |
| `aura-burn` | Bruit filtré très court (0,05-0,08 s), volume bas |
| `orb-hit` | Triangle aigu, petite descente, 0,08 s (« tink ») |
| `sword-slash` | Bruit, passe-haut qui balaie vers le bas, 0,2 s |
| `enemy-hit` | Carré, 0,05 s, très sec |
| `enemy-death` | Carré qui descend vite (« pop »), 0,12 s |
| `player-hurt` | Dent de scie grave + bruit, 0,25 s (doit trancher avec le reste) |
| `gem-pickup` | Sinus très aigu, 2 notes rapides, 0,06 s |
| `coin-pickup` | Carré, 2 notes montantes, 0,15 s |
| `heal` | Arpège montant en triangle, 0,35 s |
| `crate-break` | Bruit + carré grave, craquement, 0,25 s |
| `level-up` | Arpège majeur montant en carré, 0,7 s |
| `boss-charge` | Montée de hauteur menaçante (sirène courte), 0,6 s |
| `boss-summon` | Vibrato grave + bruit qui monte, 0,8 s |
| `boss-death` | Longue explosion en bruit + descente grave, 1,5 s |
| `ui-hover` | Clic carré très aigu, 0,03 s, volume bas |
| `ui-click` | Même son, plus grave et un peu plus long |

**Secours (CC0)** : [512 Sound Effects (8-bit style)](https://opengameart.org/content/512-sound-effects-8-bit-style) (Junkala : pièces, gemmes, level up, coups, interface) ; [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) (UI) ; [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) et [RPG Audio](https://kenney.nl/assets/rpg-audio) (réalistes : seulement `crate-break` à la rigueur).

**Écarté** : [1000 Retro Sound Effects](https://subspaceaudio.itch.io/1000-retro-sound-effects) (CC-BY d'après sa page ; les 512 gratuits en CC0 suffisent).

## Mise au format (ffmpeg)

Bruitage : silence du début coupé, mono, 44,1 kHz, crête ≈ −1 dB :

```bash
ffmpeg -i in.wav -af "silenceremove=start_periods=1:start_threshold=-50dB,alimiter=limit=0.89" -ac 1 -ar 44100 -c:a libvorbis -q:a 4 enemy-hit.ogg
```

Musique : −16 LUFS, stéréo. `linear=true` = gain fixe, ne casse pas la boucle (donner les mesures d'une 1re passe `print_format=json`) :

```bash
ffmpeg -i in.wav -af "loudnorm=I=-16:TP=-1.5:LRA=11:linear=true" -ac 2 -ar 44100 -c:a libvorbis -q:a 5 run.ogg
```

## À prévoir au branchement

- **Boucles** : `<audio loop>` laisse un blanc au raccord → Web Audio API (`AudioBufferSourceNode.loop = true`).
- **Fatigue** : limiter chaque son fréquent (ex. 1 `enemy-hit` max toutes les 30-50 ms), hauteur aléatoire ±5 %, volume bas ; réglages dans `src/data/`.

## Récapitulatif

| Fichier | Source | Licence | Crédit à afficher |
|---|---|---|---|
| `menu.ogg`, `run.ogg`, `boss.ogg` | Juhani Junkala (OpenGameArt) | CC0 | Facultatif : « Musique : Juhani Junkala » |
| `victory.ogg`, `defeat.ogg` | Kenney Music Jingles | CC0 | Facultatif : « Kenney (kenney.nl) » |
| 18 fichiers `sfx/` | Créés avec ChipTone | CC0 (création perso) | Facultatif : « Bruitages faits avec ChipTone (SFB Games) » |
| (secours) sfx | 512 Sound Effects / Kenney | CC0 | Facultatif, comme ci-dessus |

À reporter dans `public/assets/LICENSES.md` (avec la piste exacte choisie) quand les fichiers seront dans le projet.
