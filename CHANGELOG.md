# Journal des versions

Toutes les versions publiées du jeu. Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), numérotation `MAJEUR.MINEUR.CORRECTIF` (voir CLAUDE.md § 9). Tant que la version commence par `0.`, le contenu, l'équilibrage et la sauvegarde peuvent encore changer.

## [Non publié]

### Ajouté

- **Sons des nouvelles armes** : grésillement électrique de l'Éclair en chaîne, tonnerre de l'Orage, sifflement de la Hache qui tourne, corde de l'Arc, pointes qui sortent de terre, impacts métalliques. Avant, elles reprenaient le « piou » du Trait arcanique.

### Modifié

- **Arc continu** moins fort : +3 sauts au lieu de +4, et chaque saut perd 8 % des dégâts (avant : aucune perte).
- **Fournaise** : l'onde de feu est maintenant un vrai anneau de flammes qui s'élargit jusqu'à sa portée (effet du pack Pixel Spells: Inferno, Odd Jelly Games).
- **Champ de ronces** plus lisible : des buissons de ronces remplissent toute la zone qui ralentit.
- **Chausse-trapes** : juste avant de disparaître, un grand pic sort et frappe fort tous les ennemis dans la zone (30 dégâts au niveau 1).
- Nouveaux effets (packs Pixel Spells, Odd Jelly Games) : éclairs bleus de l'Éclair en chaîne, foudre de l'Orage, pointes d'os des Chausse-trapes.

## [0.3.0] — 2026-11-23

Stats avancées et arsenal : les armes sont physiques ou magiques, des ennemis résistent à l'un des deux, et 4 nouvelles armes.

### Ajouté

- **4 nouvelles armes**, chacune avec 2 mutations :
  - **Arc** (physique) : une flèche rapide qui porte loin et traverse 2 ennemis. Mutations **Flèche lourde** (perce les blindés) et **Volée** (5 flèches en éventail).
  - **Hache de lancer** (physique) : elle part vers l'ennemi le plus proche et **revient vers toi**, en frappant à l'aller et au retour. Mutations **Haches jumelles** et **Hache du bourreau**.
  - **Chausse-trapes** (physique) : des pointes posées au sol sous toi, qui blessent ce qui marche dessus. Mutations **Mines** (explosent au premier ennemi) et **Champ de ronces** (ralentissent).
  - **Éclair en chaîne** (magique) : frappe l'ennemi le plus proche puis saute de proche en proche. Mutations **Orage** (la foudre tombe aussi au hasard) et **Arc continu** (plus de sauts, sans perte).
- **Dégâts physiques et magiques** : chaque arme a son type, affiché sur sa carte et par un coin de couleur dans sa case (gris acier : physique, bleu : magique).
- **Résistances des ennemis** : le tank résiste à la magie (l'Épée et les armes physiques en viennent à bout), le basique élite au physique, le rapide élite à la magie, le boss un peu aux deux, et le basique très légèrement aux deux. Les boucliers à côté des barres de PV du boss et des mini-boss montrent leurs résistances, et les nombres de dégâts deviennent **gris** quand un coup est bien réduit.
- **Pénétration** : nouveau passif (+5 par niveau) qui perce les résistances ; l'Estoc, la Fournaise et le Trait perçant en ont aussi.
- Quand toutes tes armes sont du même type, chaque level up te propose une nouvelle arme de l'autre type.
- Nouveaux effets visuels (pack PVFX Foundry) : pointes de terre, explosion de mine, ronces, foudre de l'Orage, éclairs étirés entre les ennemis, neige dans l'Aura de givre, flèches animées qui se fichent.

### Modifié

- **Fournaise** plus forte : une onde toutes les 1,5 s (au lieu de 1,8 s), et bien plus de dégâts sur les petits ennemis.
- Les **mini-boss et les boss** ne sont plus ralentis par rien, et les mini-boss reculent moitié moins.
- Mode sans fin : les ennemis résistent de plus en plus aux ralentissements (+10 % par minute, jusqu'à 80 %).
- Icône de la Hâte : un grimoire (l'éclair va à l'Éclair en chaîne).

## [0.2.2] — 2026-11-21

### Modifié

- Le tank n'est plus un orc vert : c'est maintenant un **démon rouge** à cornes, comme le reste du bestiaire (mêmes animations).

### Corrigé

- Barres de PV (joueur et boss) et barre d'XP : il restait un petit trou sombre à chaque bout et une ligne sombre en bas quand elles étaient pleines.
- Les cartes **Soin** et **Bourse** (quand tout est au maximum) n'avaient pas d'icône : potion rouge et bourse.

## [0.2.1] — 2026-11-21

### Modifié

- Nouvelle police pour le texte courant (descriptions des cartes, défis des persos, noms et effets de la Boutique, Profil, Options, aides en bas des écrans) : **monogram**, plus fine et plus lisible. Les titres, noms, boutons et chiffres gardent la police pixel du jeu.

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
