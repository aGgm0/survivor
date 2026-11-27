import { CHARACTERS } from '../data/characters';
import {
  NO_MUTATION,
  favoriteWeapon,
  type HistoryEntry,
  type Profile,
  type VariantStats,
} from '../data/profile';
import { CHARACTER_SPRITES } from '../data/sprites';
import { PASSIVES } from '../data/upgrades';
import { WEAPON_LIST, type WeaponDef } from '../data/weapons';
import { formatNumber } from './formatNumber';
import { formatTime } from './formatTime';
import { iconElement } from './icons';

export type ProfileTab = 'stats' | 'history';
/** Clic dans la grille des armes : une arme (son détail), ou retour à toutes les armes */
export type WeaponClick = { readonly weapon: string } | { readonly weapon: null };

/**
 * Écran Profil, en 2 onglets : Statistiques (cumuls + une carte par arme jouée) et Dernières
 * parties (historique). Lecture seule. Comme les autres menus, les clics sont seulement mémorisés
 * et la scène les lit pendant son update.
 */
export class ProfileOverlay {
  private backClicked = false;
  private tabClicked: ProfileTab | null = null;
  private weaponClicked: WeaponClick | null = null;
  /** Profil affiché (pour reconstruire la grille ou le détail d'une arme) */
  private profile: Readonly<Profile> | null = null;
  /** Arme dont le détail est ouvert, ou null : grille de toutes les armes */
  private openWeapon: string | null = null;

  constructor(
    private readonly el: HTMLElement,
    private readonly summaryEl: HTMLElement,
    private readonly weaponsEl: HTMLElement,
    private readonly historyEl: HTMLElement,
    private readonly statsPanel: HTMLElement,
    private readonly tabs: Readonly<Record<ProfileTab, HTMLButtonElement>>,
    backButton: HTMLButtonElement,
  ) {
    backButton.addEventListener('click', () => (this.backClicked = true));
    tabs.stats.addEventListener('click', () => (this.tabClicked = 'stats'));
    tabs.history.addEventListener('click', () => (this.tabClicked = 'history'));
  }

  /** Créer des éléments ici est sans risque : seulement à l'ouverture de l'écran, hors partie. */
  show(profile: Readonly<Profile>, tab: ProfileTab = 'stats'): void {
    this.backClicked = false;
    this.tabClicked = null;
    this.weaponClicked = null;
    this.profile = profile;
    this.openWeapon = null;
    this.renderSummary(profile);
    this.renderWeapons(profile);
    this.renderHistory(profile.history);
    this.showTab(tab);
    this.el.hidden = false;
  }

  /** Affiche un onglet (clic ou flèches, lu par la scène). */
  showTab(tab: ProfileTab): void {
    this.statsPanel.hidden = tab !== 'stats';
    this.historyEl.hidden = tab !== 'history';
    this.tabs.stats.classList.toggle('is-active', tab === 'stats');
    this.tabs.history.classList.toggle('is-active', tab === 'history');
  }

  hide(): void {
    this.el.hidden = true;
  }

  /** Vrai une seule fois après un clic sur Retour. */
  takeBack(): boolean {
    const clicked = this.backClicked;
    this.backClicked = false;
    return clicked;
  }

  /** Clic sur une carte d'arme ou sur « Toutes les armes » depuis le dernier appel, ou null. */
  takeWeaponClick(): WeaponClick | null {
    const click = this.weaponClicked;
    this.weaponClicked = null;
    return click;
  }

  /** Vrai quand le détail d'une arme est ouvert (Échap le referme avant de quitter l'écran). */
  get weaponOpen(): boolean {
    return this.openWeapon !== null;
  }

  /** Ouvre le détail d'une arme, ou revient à la grille (null). */
  showWeapon(id: string | null): void {
    if (!this.profile) return;
    this.openWeapon = id;
    const def = id ? WEAPON_LIST.find((w) => w.id === id) : undefined;
    if (def) this.renderWeaponDetail(def, this.profile);
    else this.renderWeapons(this.profile);
  }

  /** Onglet cliqué depuis le dernier appel, ou null. */
  takeTab(): ProfileTab | null {
    const tab = this.tabClicked;
    this.tabClicked = null;
    return tab;
  }

  private renderSummary(profile: Readonly<Profile>): void {
    const winRate = profile.runs > 0 ? Math.round((profile.victories / profile.runs) * 100) : 0;
    const favorite = favoriteWeapon(profile);
    const favoriteName = WEAPON_LIST.find((w) => w.id === favorite)?.name ?? '—';
    this.summaryEl.replaceChildren(
      ...[
        ['Parties', formatNumber(profile.runs)],
        ['Victoires', `${formatNumber(profile.victories)} (${winRate} %)`],
        ['Meilleur temps', formatTime(profile.bestTime)],
        ['Temps total', formatTime(profile.totalTime)],
        ['Kills totaux', formatNumber(profile.totalKills)],
        ['Meilleur niveau', formatNumber(profile.bestLevel)],
        ['Arme favorite', favoriteName],
      ].map(([label, value]) => {
        const row = document.createElement('div');
        row.className = 'profile-row';
        row.append(text('span', label ?? ''), text('span', value ?? '', 'profile-value'));
        return row;
      }),
    );
  }

  /** Une carte par arme jouée (icône, nom, cumuls), de la plus jouée à la moins jouée. */
  private renderWeapons(profile: Readonly<Profile>): void {
    const rows = WEAPON_LIST.map((def) => ({ def, stats: profile.weapons[def.id] }))
      .filter((r) => r.stats && r.stats.runs > 0)
      .sort((a, b) => (b.stats?.runs ?? 0) - (a.stats?.runs ?? 0));
    if (rows.length === 0) {
      this.weaponsEl.replaceChildren(
        text('p', 'Termine une partie pour remplir ton profil.', 'overlay-hint'),
      );
      return;
    }
    this.weaponsEl.replaceChildren(
      ...rows.map(({ def, stats }) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'profile-weapon';
        card.title = 'Voir le détail des mutations';
        card.addEventListener('click', () => (this.weaponClicked = { weapon: def.id }));
        card.style.borderLeftColor = def.color;
        const runs = stats?.runs ?? 0;
        const body = document.createElement('div');
        body.className = 'profile-weapon-body';
        body.append(
          text('span', def.name, 'profile-weapon-name'),
          text(
            'span',
            `${runs} partie${runs > 1 ? 's' : ''} · ${formatNumber(stats?.kills ?? 0)} kills`,
            'profile-weapon-detail',
          ),
          text(
            'span',
            `${formatNumber(Math.round(stats?.damage ?? 0))} dégâts`,
            'profile-weapon-detail',
          ),
        );
        card.append(iconElement(def.id, def.short), body);
        return card;
      }),
    );
  }

  /**
   * Détail d'une arme : une colonne par variante (sans mutation, puis chaque mutation) avec son
   * icône, sa description et ses cumuls. Une variante jamais jouée est grisée.
   */
  private renderWeaponDetail(def: WeaponDef, profile: Readonly<Profile>): void {
    const variants = profile.weapons[def.id]?.variants ?? {};
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'menu-button profile-detail-back';
    back.textContent = '← Toutes les armes';
    back.addEventListener('click', () => (this.weaponClicked = { weapon: null }));

    const head = document.createElement('div');
    head.className = 'profile-detail-head';
    head.append(
      iconElement(def.id, def.short),
      text('span', def.name, 'profile-weapon-name'),
      back,
    );

    const columns = document.createElement('div');
    columns.className = 'profile-detail-columns';
    columns.append(
      variantColumn(def.id, def.short, 'Sans mutation', def.description, variants[NO_MUTATION]),
      ...(def.mutations ?? []).map((m) =>
        variantColumn(m.id, m.short, `★ ${m.name}`, m.description, variants[m.id]),
      ),
    );
    const note = text(
      'p',
      'Détail compté depuis la 0.3.7 : les parties plus anciennes ne sont que dans le total.',
      'overlay-hint',
    );
    const detail = document.createElement('div');
    detail.className = 'profile-detail';
    detail.style.borderLeftColor = def.color;
    detail.append(head, columns, note);
    this.weaponsEl.replaceChildren(detail);
  }

  /** Une ligne par partie, la plus récente en haut. */
  private renderHistory(history: readonly HistoryEntry[]): void {
    if (history.length === 0) {
      this.historyEl.replaceChildren(
        text(
          'p',
          'Aucune partie enregistrée pour l’instant : termine une partie pour la voir ici.',
          'overlay-hint',
        ),
      );
      return;
    }
    const now = Date.now();
    this.historyEl.replaceChildren(...history.map((entry) => historyRow(entry, now)));
  }
}

function text(tag: string, content: string, className?: string): HTMLElement {
  const el = document.createElement(tag);
  el.textContent = content;
  if (className) el.className = className;
  return el;
}

function variantColumn(
  icon: string,
  short: string,
  name: string,
  description: string,
  stats: VariantStats | undefined,
): HTMLElement {
  const col = document.createElement('div');
  col.className = stats && stats.runs > 0 ? 'profile-variant' : 'profile-variant is-empty';
  const title = document.createElement('div');
  title.className = 'profile-variant-title';
  title.append(iconElement(icon, short), text('span', name, 'profile-weapon-name'));
  col.append(title, text('span', description, 'profile-weapon-detail profile-variant-desc'));
  if (!stats || stats.runs === 0) {
    col.append(text('span', 'Pas encore jouée', 'profile-weapon-detail'));
    return col;
  }
  const lines: [string, string][] = [
    ['Parties', formatNumber(stats.runs)],
    ['Kills', formatNumber(stats.kills)],
    ['Dégâts', formatNumber(Math.round(stats.damage))],
    ['Dégâts / partie', formatNumber(Math.round(stats.damage / stats.runs))],
  ];
  for (const [label, value] of lines) {
    const row = document.createElement('div');
    row.className = 'profile-row';
    row.append(text('span', label), text('span', value, 'profile-value'));
    col.append(row);
  }
  return col;
}

function historyRow(entry: HistoryEntry, now: number): HTMLElement {
  const row = document.createElement('div');
  row.className = 'history-row';

  // Perso : portrait animé (même ligne d'atlas que sur l'écran de choix) + nom.
  const character = CHARACTERS.find((c) => c.id === entry.character);
  const who = document.createElement('div');
  who.className = 'history-who';
  const portrait = document.createElement('span');
  portrait.className = 'history-portrait';
  const look = CHARACTER_SPRITES[entry.character];
  if (look) portrait.style.setProperty('--portrait-y', String(look.portraitY));
  else portrait.hidden = true;
  who.append(portrait, text('span', character?.name ?? '—', 'history-name'));

  const [result, resultClass] = entry.endless
    ? ['Sans fin', 'is-endless']
    : entry.victory
      ? ['Victoire', 'is-victory']
      : ['Défaite', 'is-defeat'];

  const stats = document.createElement('div');
  stats.className = 'history-stats';
  stats.append(
    stat('Temps', formatTime(entry.time)),
    stat('Niv', formatNumber(entry.level)),
    stat('Kills', formatNumber(entry.kills)),
    stat('Or', formatNumber(entry.gold)),
  );

  // Armes : icône (de la mutation si l'arme est mutée), niveau, part des dégâts.
  const weapons = document.createElement('div');
  weapons.className = 'history-icons';
  for (const w of entry.weapons) {
    const slot = document.createElement('div');
    slot.className = 'history-slot';
    const def = WEAPON_LIST.find((d) => d.id === w.id);
    slot.title = def?.name ?? w.id;
    slot.append(
      iconElement(w.icon, w.short),
      text('span', `${Math.round(w.share * 100)} %`, 'history-slot-value'),
    );
    weapons.append(slot);
  }

  const passives = document.createElement('div');
  passives.className = 'history-icons';
  for (const p of entry.passives) {
    const def = PASSIVES.find((d) => d.id === p.id);
    const slot = document.createElement('div');
    slot.className = 'history-slot';
    slot.title = def?.name ?? p.id;
    slot.append(
      iconElement(p.id, def?.short ?? ''),
      text('span', `niv ${p.level}`, 'history-slot-value'),
    );
    passives.append(slot);
  }

  const when = document.createElement('div');
  when.className = 'history-when';
  when.append(text('span', timeAgo(now - entry.at)));
  if (entry.maxedAt !== null) {
    when.append(text('span', `build complet ${formatTime(entry.maxedAt)}`, 'history-maxed'));
  }

  row.append(
    who,
    text('span', result, `history-result ${resultClass}`),
    stats,
    weapons,
    passives,
    when,
  );
  return row;
}

function stat(label: string, value: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'history-stat';
  el.append(text('span', value, 'profile-value'), text('span', label, 'history-stat-label'));
  return el;
}

/** « à l'instant », « il y a 5 min », « il y a 2 h », « il y a 3 j » */
function timeAgo(ms: number): string {
  const min = Math.floor(Math.max(0, ms) / 60_000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}
