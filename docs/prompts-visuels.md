# Prompts pour les visuels (Phase 6)

Deux pistes à comparer avant de choisir :

1. **Prompt A** : faire générer les visuels par Claude Fable 5.2.
2. **Prompt B** : trouver des assets libres (itch.io, Kenney, OpenGameArt) ou les dessiner soi-même, avec une liste précise de ce qu'il faut.

Conseil : teste le prompt A sur **3 éléments seulement** d'abord (le joueur, un basique, le boss). Si le style te plaît et reste cohérent, demande le reste. Sinon, passe au prompt B.

---

## Prompt A — Fable 5.2

> Copie tout le bloc ci-dessous dans un nouveau chat avec Fable 5.2.

```text
Je développe un jeu navigateur de type "Survivor" / bullet heaven (comme Vampire Survivors) en
TypeScript + Canvas 2D, vue de dessus, résolution logique 1280×720. Thème : magie / fantasy
sombre (un mage qui survit à des hordes). Jusqu'ici tout est dessiné avec des cercles de couleur ;
je veux de vrais visuels, cohérents entre eux.

CONTRAINTES (importantes) :
- Format : un fichier SVG par élément (fond transparent, viewBox carré), pour que je puisse
  les charger dans le canvas. Pas de texte dans les sprites.
- Vue de dessus (top-down), lisible en TRÈS PETIT : jusqu'à 500 ennemis à l'écran en même temps.
  Silhouettes simples, contour sombre de 2 px, peu de détails, couleurs franches.
- Garde la couleur principale de chaque élément (indiquée ci-dessous) : c'est ce qui les
  distingue en jeu.
- Style unique pour tout le jeu : choisis-en un et décris-le en 3 lignes avant de dessiner
  (palette, épaisseur des contours, ombrage).
- Fond du jeu : #14141c (presque noir bleuté), grille #2c2c3d. Les sprites doivent ressortir dessus.

ÉLÉMENTS (taille = diamètre affiché à l'écran, en px) :
Personnages et ennemis
- Joueur (mage) : 32 px, violet #8a6cff
- Basique (petit démon / goule) : 28 px, rouge #d9534f
- Rapide (petite créature vive) : 20 px, orange #f0ad4e
- Tank (golem / brute) : 48 px, vert #5cb85c
- Boss : 96 px, violet profond #8e2de2 (doit impressionner)
- Rapide élite : 36 px, orange #f0ad4e, version « blindée / couronnée » du rapide
- Basique élite : 50 px, rouge #d9534f, version « blindée / couronnée » du basique
Objets
- Caisse / tonneau cassable : 28 px, brun #8d6e63
- Gemmes d'XP (3 tailles) : 14 px bleu #4fc3f7, 18 px violet #b388ff, 24 px or #ffd54f
- Pièce d'or : 12 px, #ffd54f
- Nourriture (soigne) : 16 px, rouge corail #ff6f61
Armes
- Projectile du Trait arcanique : 12 px, bleu #5ab0ff (variantes : perçant #9ad7ff, éclaté #ff8fd6)
- Orbe runique : 26 px, violet #c77dff (variantes : géant #e040fb, tempête #b388ff)
- Aura ardente : un anneau / cercle de flammes autour du joueur, orange #ff7a3d (variantes :
  brasier #ffb347, toxique #7cfc00), pensé pour être étiré à n'importe quel rayon
- Arc de coup d'épée : une demi-lune / traînée blanche #e8e8f0 (variantes : tourbillon #b0e0ff,
  lame d'onde #9ff0d0)

COMMENCE PAR : la description du style, puis seulement le joueur, le basique et le boss.
J'attends mon retour avant de faire le reste.
```

---

## Prompt B — assets libres ou à faire soi-même

> Copie ce bloc dans un chat pour te faire aider à chercher, ou garde-le comme liste de courses.

```text
Je cherche des assets 2D pour un jeu navigateur de type Survivor / bullet heaven (comme Vampire
Survivors), vue de dessus, thème magie / fantasy sombre. C'est un projet portfolio qui pourrait
être publié (itch.io, peut-être Steam) : il me faut des licences qui l'autorisent.

LICENCES : de préférence CC0 (aucune obligation). CC-BY accepté (je créditerai l'auteur).
Pas de licence "non commerciale", pas d'assets extraits de jeux existants.

OÙ CHERCHER (dans cet ordre) :
- kenney.nl (tout en CC0, style très cohérent)
- itch.io/game-assets/free (filtrer par "top-down", "fantasy", "pixel art")
- opengameart.org (vérifier la licence de CHAQUE fichier)

CE QU'IL ME FAUT (tout dans le MÊME style, vue de dessus, lisible en petit) :
- 1 mage joueur (idéalement animé : marche 4 directions)
- 3 ennemis de base : petit démon / goule, petite créature rapide, brute / golem lourde
- 1 boss imposant
- variantes "élite" possibles (ou je teinterai moi-même)
- caisse ou tonneau, pièce d'or, nourriture, gemmes / cristaux
- projectile magique, orbe, anneau de feu, effet de coup d'épée (slash)
- un sol / tileset sombre pour le fond
- (bonus) une police d'écriture fantasy lisible pour le HUD, et une UI (cadres, boutons)

POUR CHAQUE PACK PROPOSÉ, donne-moi : le lien, la licence exacte, ce qu'il couvre dans ma liste,
la taille des sprites (en px) et si un pack complet existe pour éviter de mélanger les styles.
```

**Si tu dessines toi-même** : un outil gratuit et simple pour le pixel art est [Piskel](https://www.piskelapp.com) (dans le navigateur). [Aseprite](https://www.aseprite.org) est la référence, payant, ou gratuit si tu le compiles toi-même. Garde les tailles et couleurs de la liste du prompt A.
