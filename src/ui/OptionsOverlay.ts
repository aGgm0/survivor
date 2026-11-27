import type { Fullscreen } from '../core/Fullscreen';
import {
  SETTING_LABELS,
  VOLUME_LABELS,
  VOLUME_STEP,
  type SettingKey,
  type Settings,
  type VolumeKey,
} from '../data/settings';

/** Ce que le joueur peut demander depuis l'écran Options. */
export type OptionsAction =
  | { readonly kind: 'toggle'; readonly key: SettingKey }
  | { readonly kind: 'volume'; readonly key: VolumeKey; readonly value: number }
  | { readonly kind: 'back' };

/**
 * Écran Options : une case à cocher par réglage + Retour. Comme les autres menus, un clic est
 * seulement mémorisé ; la scène le lit pendant son update, change le réglage et le sauvegarde.
 */
export class OptionsOverlay {
  private action: OptionsAction | null = null;
  private readonly boxes = new Map<SettingKey, HTMLInputElement>();
  private readonly sliders = new Map<VolumeKey, { input: HTMLInputElement; value: HTMLElement }>();
  private readonly fullscreenBox: HTMLInputElement | null = null;

  constructor(
    private readonly el: HTMLElement,
    listEl: HTMLElement,
    backButton: HTMLButtonElement,
    fullscreen?: Fullscreen,
  ) {
    // Plein écran : exception à la règle « le clic est seulement mémorisé ». Le navigateur
    // n'accepte le plein écran que pendant le clic lui-même, donc on le demande ici. Ce n'est
    // pas un réglage sauvegardé : la case suit l'état réel (voir `setFullscreen`).
    if (fullscreen?.isAvailable) {
      const row = document.createElement('label');
      row.className = 'option-row';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.addEventListener('change', () => {
        // La case reprend l'état actuel ; l'événement `fullscreenchange` la mettra à jour
        // si le navigateur accepte (sinon elle reste juste).
        box.checked = fullscreen.isActive;
        fullscreen.toggle();
      });
      const text = document.createElement('span');
      text.textContent = 'Plein écran';
      row.append(box, text);
      listEl.append(row);
      this.fullscreenBox = box;
    }
    // Les cases sont créées une seule fois, à partir de la liste des réglages (data/settings.ts).
    for (const [key, label] of SETTING_LABELS) {
      const row = document.createElement('label');
      row.className = 'option-row';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.addEventListener('change', () => (this.action = { kind: 'toggle', key }));
      const text = document.createElement('span');
      text.textContent = label;
      row.append(box, text);
      listEl.append(row);
      this.boxes.set(key, box);
    }
    // Curseurs de volume (0 à 100 %, par pas de 10). 'input' : le son change pendant qu'on glisse.
    const steps = Math.round(1 / VOLUME_STEP);
    for (const [key, label] of VOLUME_LABELS) {
      const row = document.createElement('label');
      row.className = 'option-row option-volume';
      const text = document.createElement('span');
      text.textContent = label;
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = String(steps);
      input.step = '1';
      input.addEventListener('input', () => {
        this.action = { kind: 'volume', key, value: Number(input.value) / steps };
      });
      const value = document.createElement('span');
      value.className = 'option-value';
      row.append(text, input, value);
      listEl.append(row);
      this.sliders.set(key, { input, value });
    }
    backButton.addEventListener('click', () => (this.action = { kind: 'back' }));
  }

  show(settings: Readonly<Settings>): void {
    this.action = null;
    this.refresh(settings);
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
  }

  /** Recoche les cases selon les réglages réels (la source de vérité, c'est la scène). */
  refresh(settings: Readonly<Settings>): void {
    for (const [key, box] of this.boxes) box.checked = settings[key];
    const steps = Math.round(1 / VOLUME_STEP);
    for (const [key, slider] of this.sliders) {
      slider.input.value = String(Math.round(settings[key] * steps));
      slider.value.textContent = `${Math.round(settings[key] * 100)} %`;
    }
  }

  /** Coche la case « Plein écran » selon l'état réel (entrée/sortie par F, Échap, clic…). */
  setFullscreen(active: boolean): void {
    if (this.fullscreenBox) this.fullscreenBox.checked = active;
  }

  /** L'action cliquée depuis la dernière lecture, ou null. */
  takeAction(): OptionsAction | null {
    const action = this.action;
    this.action = null;
    return action;
  }
}
