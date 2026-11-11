import { PASSIVES } from '../data/upgrades';
import { WEAPON_LIST } from '../data/weapons';

/** Ce que le menu de test peut demander à la partie. */
export type DevAction =
  | { readonly kind: 'god' }
  | { readonly kind: 'heal' }
  | { readonly kind: 'levels'; readonly count: number }
  | { readonly kind: 'weaponToggle'; readonly id: string }
  | { readonly kind: 'weaponLevel'; readonly id: string; readonly delta: number }
  /** index -1 = retirer la mutation */
  | { readonly kind: 'mutation'; readonly id: string; readonly index: number }
  | { readonly kind: 'passive'; readonly id: string; readonly delta: number }
  | { readonly kind: 'time'; readonly seconds: number }
  | { readonly kind: 'endless' }
  | { readonly kind: 'spawn'; readonly count: number }
  | { readonly kind: 'killAll' }
  | { readonly kind: 'boss' }
  | { readonly kind: 'close' };

/** État affiché par le panneau (fourni par la scène après chaque action). */
export interface DevView {
  readonly god: boolean;
  readonly weapons: readonly {
    readonly id: string;
    readonly owned: boolean;
    readonly level: number;
    /** -1 = pas de mutation */
    readonly mutation: number;
  }[];
  readonly passives: readonly { readonly id: string; readonly level: number }[];
}

/** Sauts dans le temps proposés : [libellé, secondes] */
const TIME_JUMPS: readonly (readonly [string, number])[] = [
  ['2:00 rush', 120],
  ['5:00 boss', 300],
  ['6:00 rush', 360],
  ['9:00 boss', 540],
  ['10:00', 600],
];

/**
 * Menu de test (F2), présent seulement en dev (`npm run dev`), jamais dans le build.
 * Construit à partir des données : une nouvelle arme ou un nouveau passif y apparaît tout seul.
 * Comme les autres menus, les clics sont seulement mémorisés ; la scène les applique dans son
 * update. Toute action transforme la partie en « partie de test » (pas enregistrée au profil).
 */
export class DevPanel {
  private readonly actions: DevAction[] = [];
  /** Éléments à mettre à jour par `refresh`, par clé (ex. "w:sword", "p:size") */
  private readonly labels = new Map<string, HTMLElement>();
  private godButton: HTMLButtonElement | null = null;

  constructor(private readonly el: HTMLElement) {
    this.build();
    // Un seul écouteur pour tous les boutons : chacun porte son action en JSON (data-action).
    el.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const raw = target.closest<HTMLElement>('[data-action]')?.dataset.action;
      if (raw) this.actions.push(JSON.parse(raw) as DevAction);
    });
  }

  setVisible(visible: boolean): void {
    this.el.hidden = !visible;
  }

  /** Actions cliquées depuis la dernière lecture (le tableau est vidé). */
  takeActions(): DevAction[] {
    return this.actions.splice(0, this.actions.length);
  }

  refresh(view: DevView): void {
    if (this.godButton) this.godButton.textContent = `Invincible : ${view.god ? 'OUI' : 'non'}`;
    for (const w of view.weapons) {
      const label = this.labels.get(`w:${w.id}`);
      if (!label) continue;
      const mutation = WEAPON_LIST.find((d) => d.id === w.id)?.mutations?.[w.mutation];
      label.textContent = w.owned ? `niv ${w.level}${mutation ? ` ★ ${mutation.name}` : ''}` : '—';
    }
    for (const p of view.passives) {
      const label = this.labels.get(`p:${p.id}`);
      if (label) label.textContent = p.level > 0 ? `niv ${p.level}` : '—';
    }
  }

  private build(): void {
    const title = document.createElement('p');
    title.className = 'dev-title';
    title.textContent = 'MENU DE TEST (F2) — partie non enregistrée';

    const player = this.section('Joueur');
    this.godButton = this.button('Invincible : non', { kind: 'god' });
    player.append(
      this.godButton,
      this.button('Soigner', { kind: 'heal' }),
      this.button('+1 niveau', { kind: 'levels', count: 1 }),
      this.button('+5 niveaux', { kind: 'levels', count: 5 }),
    );

    const weapons = this.section('Armes');
    for (const def of WEAPON_LIST) {
      const row = this.row(def.name, `w:${def.id}`);
      row.append(
        this.button('±', { kind: 'weaponToggle', id: def.id }, 'Ajouter / retirer'),
        this.button('−', { kind: 'weaponLevel', id: def.id, delta: -1 }),
        this.button('+', { kind: 'weaponLevel', id: def.id, delta: 1 }),
      );
      (def.mutations ?? []).forEach((m, index) =>
        row.append(this.button(`★${index + 1}`, { kind: 'mutation', id: def.id, index }, m.name)),
      );
      row.append(this.button('✕★', { kind: 'mutation', id: def.id, index: -1 }, 'Sans mutation'));
      weapons.append(row);
    }

    const passives = this.section('Passifs');
    for (const p of PASSIVES) {
      const row = this.row(p.name, `p:${p.id}`);
      row.append(
        this.button('−', { kind: 'passive', id: p.id, delta: -1 }),
        this.button('+', { kind: 'passive', id: p.id, delta: 1 }),
      );
      passives.append(row);
    }

    const time = this.section('Temps');
    for (const [label, seconds] of TIME_JUMPS) {
      time.append(this.button(label, { kind: 'time', seconds }));
    }
    time.append(this.button('Sans fin', { kind: 'endless' }));

    const enemies = this.section('Ennemis');
    enemies.append(
      this.button('+100', { kind: 'spawn', count: 100 }),
      this.button('Tuer tout (sauf boss)', { kind: 'killAll' }),
      this.button('Boss', { kind: 'boss' }),
    );

    this.el.append(
      title,
      player,
      weapons,
      passives,
      time,
      enemies,
      this.button('Fermer (F2)', { kind: 'close' }),
    );
  }

  private section(name: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'dev-section';
    const title = document.createElement('p');
    title.className = 'dev-section-title';
    title.textContent = name;
    section.append(title);
    return section;
  }

  /** Une ligne : nom, état (mis à jour par refresh), puis les boutons ajoutés ensuite. */
  private row(name: string, key: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'dev-row';
    const label = document.createElement('span');
    label.className = 'dev-name';
    label.textContent = name;
    const state = document.createElement('span');
    state.className = 'dev-state';
    this.labels.set(key, state);
    row.append(label, state);
    return row;
  }

  private button(text: string, action: DevAction, title?: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dev-button';
    b.textContent = text;
    b.dataset.action = JSON.stringify(action);
    if (title) b.title = title;
    return b;
  }
}
