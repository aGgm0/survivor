# Prompt : bilan d'architecture et roadmap 0.x → 1.0

À copier dans une **nouvelle discussion Claude Code ouverte dans le dossier du projet**, pour qu'elle
puisse lire le code. Le résultat (bilan + roadmap versionnée) remplacera ensuite la section 9 de
`CLAUDE.md`.

---

Je développe **Survivor** (nom provisoire), un jeu navigateur de type **Survivor / bullet heaven**
(comme Vampire Survivors) : un mage survit 10 minutes à des hordes de démons dans un donjon. Moteur
maison en **TypeScript strict + Canvas 2D + Vite**, sans moteur de jeu. Je suis étudiant en dev web,
c'est mon premier jeu : je veux **comprendre** les choix, pas juste une liste.

- Jeu en ligne : https://agemo0.itch.io/survivor
- Code : https://github.com/aGgm0/survivor (branche `main`)
- **Lis d'abord `CLAUDE.md`** (règles du projet, game design, Roadmap en section 9, Journal des
  décisions en section 11), puis le code dans `src/`.

## Où en est le projet

Phases 0 à 7 de l'ancienne Roadmap faites : MVP (run de 10 min, 4 armes avec mutations, 9 passifs,
vagues, mini-boss, 2 boss avec capacités, mode sans fin), méta-progression (4 persos à débloquer, or,
boutique, profil), visuels (sprites 0x72, effets, UI en cadres pixel, particules, tremblement),
son (bruitages générés par script, musique, volumes), et publication sur itch.io.
Environ 9 200 lignes dans 73 fichiers `src/`, 328 tests Vitest.

Ce qui reste noté mais pas fait :

- **Nom du jeu et pitch** (encore `TODO`).
- **Équilibrage** : passe complète (armes, mutations, vagues, boss), courbe d'XP (`steepFactor`),
  prix de la boutique.
- **Enchantements** : idée de niveau 6 des passifs (comme la mutation pour les armes), design à faire.
- **Apparences d'ennemis par palier de temps** (paliers à décider).
- **Plein écran dans le jeu** (touche + option ; le bouton d'itch.io marche déjà).
- Son à peaufiner : retouches de bruitages, jingles très courts, musique de partie courte (44 s),
  musique qui repart du début après un boss.
- `[LATER]` : autres capacités de boss, stats avancées par perso (armures, pénétration, dégâts
  physiques / magiques), autres bestiaires, version PC (Electron / Tauri) et Steam.

## Ce que je te demande

### 1. Bilan de l'architecture

Lis le code et dis-moi franchement ce qui tient et ce qui va coincer quand le jeu grossira (plus
d'armes, d'ennemis, de niveaux, de modes). Au minimum :

- **`src/scenes/GameScene.ts` fait ~1 400 lignes** : est-ce un problème ? Que sortir, dans quel ordre,
  et comment le faire **par petites étapes** sans tout casser ?
- Le découpage `core/` / `systems/` / `entities/` / `data/` / `ui/` est-il respecté ? Des imports qui
  vont dans le mauvais sens, des responsabilités mélangées ?
- `main.ts` (~290 lignes) : faut-il le découper ?
- Ce qui manque pour la suite : par exemple des événements de jeu plutôt que des appels directs, la
  gestion de plusieurs niveaux / cartes, la sauvegarde qui grossit.
- Les tests : ce qui est bien couvert, ce qui ne l'est pas.

Pour chaque problème : **pourquoi c'en est un**, ce que tu proposes, et **quand** le faire (maintenant,
avant telle version, ou jamais si ça ne vaut pas le coup). Pas de gros refactor « pour faire propre » :
seulement ce qui débloque la suite.

### 2. Roadmap versionnée 0.x → 1.0

Propose des versions **0.1, 0.2, … jusqu'à 1.0**, chacune publiable sur itch.io. Pour chaque version :

- un **thème** en une phrase (ce que le joueur gagne) ;
- la **liste des tâches**, petites et testables une par une ;
- les **critères de sortie** (quand peut-on dire que la version est finie ?) ;
- une estimation grossière de la taille (petite / moyenne / grosse).

Ce que j'attends de la 1.0 : un jeu **fini et cohérent** qu'on peut montrer ou vendre, avec un vrai
nom, un équilibrage testé, assez de contenu pour plusieurs heures, et un code qui tient. Aide-moi à
définir ce que « assez de contenu » veut dire pour un jeu du genre (combien d'armes, de persos, de
niveaux, d'ennemis, de durée de partie ?), en comparant avec ce que font les jeux du genre, sans
copier un jeu existant.

Dis aussi :

- quelle version de départ donner au jeu tel qu'il est aujourd'hui (0.1 ? 0.5 ?) ;
- comment numéroter (sens de 0.x, 0.x.y pour les correctifs) et où l'écrire (`package.json`, affichage
  dans le menu, notes de version sur itch.io, tags git) ;
- ce qui doit être fait **avant** de vendre le jeu (licences des packs : Raven Premium 35 $
  obligatoire pour un jeu payant, voir `public/assets/LICENSES.md` ; pages store ; etc.).

### 3. Questions à me poser

Ne devine pas les choix de game design marqués `TODO` (nom, paliers, enchantements, niveaux, durée
des runs au-delà de 10 min…) : **pose-moi les questions** et propose des options avec ta
recommandation.

## Comment travailler avec moi

- Réponds en **français**, avec des tableaux quand c'est plus lisible.
- Sois **critique** : si une partie de l'archi ou du design est mauvaise, dis-le.
- **Ne modifie aucun fichier** dans cette discussion : c'est un bilan et un plan. On mettra la
  Roadmap de `CLAUDE.md` à jour une fois que j'aurai validé.
- Termine par un **résumé d'une dizaine de lignes** : les 3 problèmes d'archi les plus urgents et le
  contenu de la prochaine version.
