// Touches par action, en `event.code` (position physique) :
// KeyW/KeyA/KeyS/KeyD = ZQSD sur AZERTY, WASD sur QWERTY.
export const CONTROLS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  pause: ['Escape', 'KeyP'],
  restart: ['KeyR'],
  /** debug : ajoute un paquet d'ennemis (test de perf) */
  debugSpawn: ['F4'],
} as const;
