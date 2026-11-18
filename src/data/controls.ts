// Touches par action, en `event.code` (position physique) :
// KeyW/KeyA/KeyS/KeyD = ZQSD sur AZERTY, WASD sur QWERTY.
export const CONTROLS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  pause: ['Escape', 'KeyP'],
  restart: ['KeyR'],
  /** Relancer les cartes (écran de level up seulement : R n'y relance pas la partie) */
  reroll: ['KeyR'],
  /** Continuer en mode sans fin depuis l'écran de victoire (même touche en AZERTY et QWERTY) */
  continue: ['KeyC'],
  /** Revenir en arrière (écran Options → menu principal) */
  back: ['Escape'],
  /** Valider (menu principal) */
  confirm: ['Enter', 'NumpadEnter', 'Space'],
  // Retour au menu. Le M d'un clavier AZERTY est à la place du ; QWERTY (code `Semicolon`).
  menu: ['KeyM', 'Semicolon'],
  /** Options depuis le menu pause (même touche en AZERTY et QWERTY) */
  options: ['KeyO'],
  // Choix au level up. Touches physiques : sur AZERTY, ce sont les touches & é " (sans Maj).
  choice1: ['Digit1', 'Numpad1'],
  choice2: ['Digit2', 'Numpad2'],
  choice3: ['Digit3', 'Numpad3'],
  /** Écran de choix du perso seulement (le level up n'a que 3 cartes) */
  choice4: ['Digit4', 'Numpad4'],
  /** debug : ajoute un paquet d'ennemis (test de perf) */
  debugSpawn: ['F4'],
  /** dev : menu de test */
  devPanel: ['F2'],
} as const;
