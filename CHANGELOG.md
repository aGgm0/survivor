# Journal des versions

Toutes les versions publiées du jeu. Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), numérotation `MAJEUR.MINEUR.CORRECTIF` (voir CLAUDE.md § 9). Tant que la version commence par `0.`, le contenu, l'équilibrage et la sauvegarde peuvent encore changer.

## [0.2.1] — 2026-11-21

### Modifié

- Nouvelle police pour le texte courant (descriptions des cartes, défis des persos, Boutique, Profil, Options, aides en bas des écrans) : **monogram**, plus fine et plus lisible. Les titres, noms, boutons et chiffres gardent la police pixel du jeu.

## [0.2.0] — 2026-11-21

Une partie plus juste : nouvelles mutations, équilibrage complet des 10 minutes, cartes et annonces de boss dans le style du jeu.

### Ajouté

- Aura ardente : deux nouvelles mutations. **Aura de givre** (grand rayon, ralentit les ennemis de 45 %) et **Fournaise** (une onde de feu part du joueur toutes les 1,8 s, très forte contre les gros ennemis).
- Épée : nouvelle mutation **Estoc** (vise l'ennemi le plus proche, portée ×2, dégâts ×2), à la place de la Lame d'onde.
- Les ennemis lâchent parfois une pièce d'or (2 % pour les basiques et les rapides, 7,5 % pour les tanks).
- Grande barre de PV du boss en haut de l'écran, et petite barre sous le joueur quand il est blessé.
- Contour rouge quand il reste moins de 20 % des PV (il pulse plus vite sous 10 %).
- Quand tout le build est au maximum, chaque niveau propose **+15 PV** ou **+10 or**.

### Modifié

- Cartes de level up refaites : sorte de la carte, touche du clavier, crans de niveau, effet avant → après, ce que l'amélioration touche ; elles arrivent une par une.
- Survol de tous les boutons : curseur doré en pixels.
- Annonces des boss : la charge est marquée par des chevrons en pixels qui s'allument puis clignotent de plus en plus vite, avec une fissure au point d'arrivée ; l'invocation par un anneau violet qui se resserre.
- Barres de PV des mini-boss dans le cadre doré du jeu ; la part perdue reste claire un instant (on voit les gros coups). Le boss n'a plus de barre au-dessus de lui : la sienne est en haut de l'écran.
- Dégâts de toutes les armes +15 %.
- Épée : arc 200°, portée 125 px, plus de recul. Tourbillon : dégâts ×0,85 (au lieu de ×0,75), plus de recul.
- Boss de 9:00 : marche deux fois plus vite, charge annoncée en 0,5 s.
- Mode sans fin bien plus dur : chaque minute, les ennemis ont plus de PV, frappent plus fort, vont plus vite et reculent moins.
- XP nécessaire ×10 une fois le build complet. Moins de soins et d'or en fin de partie (or −50 %, plus de nourriture sur les mini-boss invoqués ni en sans fin). Les objets lâchés par un même ennemi ne se superposent plus.

### Corrigé

- La ligne d'annonce de la charge du boss de 9:00 était presque deux fois trop longue : elle montre maintenant la vraie trajectoire.

## [0.1.3] — 2026-11-21

Confort sur petit écran et en plein écran.

### Ajouté

- Écran de fin : l'icône de chaque arme devant son nom dans le damage meter (celle de la mutation si l'arme est mutée).

### Corrigé

- Petits écrans : le HUD, les menus et les écrans de fin rétrécissent maintenant avec le jeu au lieu de déborder.
- Écrans qui dépassaient même en 1280 × 720 : choix du perso (les 4 cartes sortaient sur les côtés), Options, Boutique et Profil (trop hauts). Lignes des Options et du Profil allégées, liseré à la couleur de l'arme dans le Profil.
- Plein écran : Échap le quitte toujours (le navigateur l'impose), mais la pause qui suit propose « Reprendre en plein écran (P) » ; un clic sur Reprendre ou la touche P le remet.

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
