// Touches par action, en `event.code` (position physique) :
// KeyW/KeyA/KeyS/KeyD = ZQSD sur AZERTY, WASD sur QWERTY.
/**
 * s pendant lesquelles les boutons de l'écran de fin ignorent les clics : on cliquait
 * peut-être en rafale au moment de mourir, sans avoir vu le bilan. Les touches C / R / M
 * ne sont pas concernées (on ne les tape pas par hasard en jouant).
 */
export const END_SCREEN_CLICK_DELAY = 0.5;

/** Reprendre la partie ET remettre le plein écran (une des touches de `pause`, mais pas Échap) */
export const RESUME_FULLSCREEN_KEY = 'KeyP';

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
  /** Plein écran (partout : menu, partie, pause) */
  fullscreen: ['KeyF'],
  // Choix au level up. Touches physiques : sur AZERTY, ce sont les touches & é " (sans Maj).
  choice1: ['Digit1', 'Numpad1'],
  choice2: ['Digit2', 'Numpad2'],
  choice3: ['Digit3', 'Numpad3'],
  /** Écran de choix du perso seulement (le level up n'a que 3 cartes) : 8 persos */
  choice4: ['Digit4', 'Numpad4'],
  choice5: ['Digit5', 'Numpad5'],
  choice6: ['Digit6', 'Numpad6'],
  choice7: ['Digit7', 'Numpad7'],
  choice8: ['Digit8', 'Numpad8'],
  /** debug : ajoute un paquet d'ennemis (test de perf) */
  debugSpawn: ['F4'],
  /** dev : menu de test */
  devPanel: ['F2'],
} as const;
