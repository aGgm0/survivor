# Journal des versions

Toutes les versions publiées du jeu. Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), numérotation `MAJEUR.MINEUR.CORRECTIF` (voir CLAUDE.md § 9). Tant que la version commence par `0.`, le contenu, l'équilibrage et la sauvegarde peuvent encore changer.

## [0.1.2] — 2026-11-20

Soins revus et retours de jeu sur la 0.1.1.

### Ajouté

- Écran de fin : vrais boutons « Continuer en sans fin » (après une victoire), « Rejouer » et « Menu principal ». Les touches C, R et M marchent toujours.
- Chaque mini-boss tué lâche de la nourriture (+20 PV).

### Modifié

- Caisses : 30 % de nourriture au lieu de 15 %.
- Vitalité : +15 PV max et +0,3 PV/s de régénération par niveau (au lieu de +20 PV max).
- Orbes géants : recul nettement réduit (×1,6 → ×1), les ennemis arrivent de nouveau au contact ; dégâts ×2 → ×1,8.

## [0.1.1] — 2026-11-20

Correctifs suite aux retours de deux testeurs sur la 0.1.0. Pas de nouveau contenu.

### Modifié

- Sol plus clair : les ennemis s'en détachent mieux.
- Cartes de level up plus grandes, texte agrandi, bonus chiffrés (« +10 % », « +20 PV ») en vert vif.
- Barre d'XP plus haute, cyan vif, avec un flash à chaque gain d'XP.
- Aura ardente (et ses mutations) : anneau plus fin, intérieur et étincelles plus discrets. La zone de dégâts ne change pas.
- Cartes de mutation : le nom et le contour de l'icône prennent la couleur de la mutation, pour distinguer les 2 variantes d'une arme.
- Pic de difficulté à 6:00 adouci : la vague de 6:00 passe de 9 à 7 ennemis/s et le rush de basiques de 7 à 4 par seconde.

## [0.1.0] — 2026-11-18

Première version numérotée. Le jeu tel qu'il était déjà publié sur itch.io, plus les nouveautés ci-dessous.

### Contenu de base

- Une partie de 10 minutes : déplacement au clavier (ZQSD / WASD / flèches), armes qui tirent seules, gemmes d'XP, level up avec 3 cartes au choix.
- 4 armes (Trait arcanique, Aura ardente, Orbes runiques, Épée), 5 niveaux et 2 mutations chacune ; 9 passifs ; 4 emplacements d'arme et 4 de passif.
- 3 types d'ennemis, 2 mini-boss (3:00 et 7:00), 2 boss (5:00 et 9:00) avec charge et invocation annoncées, rushs à 2:00 et 6:00.
- Victoire au timer si le boss de 9:00 est mort (sinon prolongations), puis mode sans fin.
- 4 persos à débloquer par des défis, mobilier cassable (or et nourriture), boutique de bonus permanents, profil et statistiques.
- Sprites, effets, interface, musiques et bruitages ; options (nombres de dégâts, compteur FPS, pause onglet caché, tremblement, volumes).

### Ajouté

- Version du jeu affichée dans le menu et sur l'écran de fin, écrite dans les sauvegardes.
- Régénération de base : 0,1 PV par seconde.
- Relance des cartes de level up : 2 par partie (touche R ou bouton). Les cartes affichées ne reviennent pas tant qu'il en reste d'autres.
- Options modifiables en partie : bouton « Options (O) » du menu pause.
- Plein écran : touche F ou case « Plein écran » des Options. Le quitter met la partie en pause.
- Gemme verte : un basique sur deux lâche une gemme qui vaut le double d'XP.

### Modifié

- « Jouer » reste grisé (« Chargement… ») tant que les sprites et effets ne sont pas chargés.
- Début de partie plus calme : moins d'ennemis pendant les 30 premières secondes.
- Dégâts arrondis à l'entier supérieur : un petit bonus en % compte toujours.
- Trait arcanique : 14 → 16 dégâts.
- Passifs proposés 2 fois moins souvent avant le niveau 10 (plus de cartes d'arme au début).
- Recul de toutes les armes ×1,2.
- Les ennemis distancés reviennent de tous les côtés (et plus seulement de face) : on ne peut plus tourner en rond avec la horde derrière soi.

### Corrigé

- La horde tassée se figeait en bouchon et suivait le joueur à ~40 % de sa vitesse.
