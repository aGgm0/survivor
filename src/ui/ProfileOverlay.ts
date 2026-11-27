import { CHARACTERS } from '../data/characters';
import { favoriteWeapon, type HistoryEntry, type Profile } from '../data/profile';
import { CHARACTER_SPRITES } from '../data/sprites';
import { PASSIVES } from '../data/upgrades';
import { WEAPON_LIST } from '../data/weapons';
import { formatNumber } from './formatNumber';
import { formatTime } from './formatTime';
import { iconElement } from './icons';

export type ProfileTab = 'stats' | 'history';

/**
 * Écran Profil, en 2 onglets : Statistiques (cumuls + une carte par arme jouée) et Dernières
 * parties (historique). Lecture seule. Comme les autres menus, les clics sont seulement mémorisés
 * et la scène les lit pendant son update.
 */
export class ProfileOverlay {
  private backClicked = false;
  private tabClicked: ProfileTab | null = null;

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
        const card = document.createElement('div');
        card.className = 'profile-weapon';
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
