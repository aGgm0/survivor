// Touches par action, en `event.code` (position physique) :
// KeyW/KeyA/KeyS/KeyD = ZQSD sur AZERTY, WASD sur QWERTY.
export const CONTROLS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  pause: ['Escape', 'KeyP'],
  restart: ['KeyR'],
  /** Valider (menu principal) */
  confirm: ['Enter', 'NumpadEnter', 'Space'],
  // Retour au menu. Le M d'un clavier AZERTY est à la place du ; QWERTY (code `Semicolon`).
  menu: ['KeyM', 'Semicolon'],
  // Choix au level up. Touches physiques : sur AZERTY, ce sont les touches & é " (sans Maj).
  choice1: ['Digit1', 'Numpad1'],
  choice2: ['Digit2', 'Numpad2'],
  choice3: ['Digit3', 'Numpad3'],
  /** debug : ajoute un paquet d'ennemis (test de perf) */
  debugSpawn: ['F4'],
} as const;
