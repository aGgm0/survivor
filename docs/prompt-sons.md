# Prompt : sons et musique du jeu

À copier dans une autre discussion. Le résultat (fichiers + licences) sera ensuite branché dans le jeu.

---

Je fais un jeu navigateur de type **Survivor / bullet heaven** (comme Vampire Survivors) : un mage
survit 10 minutes à des hordes de **démons** dans un **donjon sombre**. Graphismes en **pixel art**
(sprites 16 × 16 agrandis), interface or et pierre sombre. Le jeu pourrait être publié gratuitement
sur le web (GitHub Pages, itch.io), peut-être vendu plus tard.

**Aide-moi à obtenir la musique et les bruitages**, soit en me trouvant des packs gratuits, soit en
m'expliquant comment les créer moi-même (ex. jsfxr / ChipTone pour les bruitages rétro).

## Style

- Ambiance **dark fantasy rétro** : chiptune / 16 bits, ou orchestral sombre en basse fidélité.
- Pas de son trop réaliste : il doit coller au pixel art.
- Les bruitages sont **courts et secs** : il y en a des centaines par minute (500 ennemis à l'écran),
  ils ne doivent jamais devenir fatigants.

## Licences (obligatoire)

- **CC0 de préférence**, CC-BY accepté (je créditerai). Pas de « non commercial », rien d'extrait
  d'un jeu existant.
- Musique générée par IA : seulement si la licence de l'outil autorise clairement l'usage commercial.
- Pour chaque fichier : lien, auteur, licence exacte.

## Format

- **OGG** (Vorbis), 44,1 kHz ; bruitages en mono ; musique en stéréo.
- Musiques : **boucles parfaites** (aucun blanc ni clic au raccord).
- Bruitages : sans silence au début (le son doit partir à l'instant du coup).
- Volume homogène : musique autour de −16 LUFS, bruitages sans saturation (crête ≤ −1 dB).
- Noms de fichiers en minuscules avec tirets, comme dans les listes ci-dessous.

## Musiques (dossier `music/`)

| Fichier | Moment | Durée | Notes |
|---|---|---|---|
| `menu.ogg` | Écran titre et menus | 1-2 min, en boucle | Calme, mystérieux |
| `run.ogg` | Pendant la partie | 2-3 min, en boucle | Rythmé, tendu, pas trop chargé (beaucoup de bruitages par-dessus) |
| `boss.ogg` | Quand un boss apparaît (5:00, 9:00) | 1-2 min, en boucle | Plus intense |
| `victory.ogg` | Écran de victoire | 3-6 s, sans boucle | Fanfare courte |
| `defeat.ogg` | Écran de mort | 3-6 s, sans boucle | Sombre, court |

## Bruitages (dossier `sfx/`)

| Fichier | Quand | Durée max |
|---|---|---|
| `bolt-shoot.ogg` | Le Trait arcanique tire (projectile magique bleu) | 0,2 s |
| `bolt-burst.ogg` | Explosion du Trait éclaté | 0,4 s |
| `aura-burn.ogg` | L'aura de feu brûle un ennemi (très fréquent, très discret) | 0,15 s |
| `orb-hit.ogg` | Un orbe runique touche un ennemi | 0,15 s |
| `sword-slash.ogg` | Coup d'épée en arc | 0,3 s |
| `enemy-hit.ogg` | Un ennemi prend un coup | 0,1 s |
| `enemy-death.ogg` | Un ennemi meurt (petit « pop ») | 0,2 s |
| `player-hurt.ogg` | Le joueur prend un coup | 0,3 s |
| `gem-pickup.ogg` | Ramasser une gemme d'XP (très fréquent, aigu, léger) | 0,1 s |
| `coin-pickup.ogg` | Ramasser une pièce d'or | 0,2 s |
| `heal.ogg` | Ramasser une potion de soin | 0,4 s |
| `crate-break.ogg` | Casser une caisse en bois | 0,3 s |
| `level-up.ogg` | Montée de niveau | 0,8 s |
| `boss-charge.ogg` | Le boss annonce sa charge (avertissement) | 0,6 s |
| `boss-summon.ogg` | Le boss annonce une invocation (avertissement) | 0,8 s |
| `boss-death.ogg` | Mort d'un boss | 1,5 s |
| `ui-hover.ogg` | Survol d'un bouton | 0,05 s |
| `ui-click.ogg` | Clic sur un bouton, choix d'une carte | 0,1 s |

## Ce que j'attends en sortie

1. Pour chaque fichier ci-dessus : la source (lien) ou la méthode pour le créer, et sa licence.
2. Si un pack couvre beaucoup de lignes d'un coup, dis-le (style plus cohérent).
3. Un petit tableau récapitulatif « fichier → source → licence → crédit à afficher ».
