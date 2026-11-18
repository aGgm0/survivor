import type { Settings } from '../data/settings';
import type { OptionsAction } from '../ui/OptionsOverlay';

/**
 * Applique une action de l'écran Options (case cochée, curseur de volume) aux réglages.
 * Partagé par le menu principal et le menu pause : une seule logique pour le même écran.
 * Renvoie vrai si un réglage a changé (il faut alors l'appliquer et le sauvegarder).
 */
export function applyOptionsAction(action: OptionsAction | null, settings: Settings): boolean {
  if (action?.kind === 'toggle') {
    settings[action.key] = !settings[action.key];
    return true;
  }
  if (action?.kind === 'volume') {
    settings[action.key] = action.value;
    return true;
  }
  return false;
}
