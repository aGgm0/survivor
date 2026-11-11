import { favoriteWeapon, type Profile } from '../data/profile';
import { WEAPON_LIST } from '../data/weapons';
import { formatTime } from './formatTime';

/** Écran Profil : statistiques cumulées + tableau par arme. Lecture seule, bouton Retour. */
export class ProfileOverlay {
  private backClicked = false;

  constructor(
    private readonly el: HTMLElement,
    private readonly summaryEl: HTMLElement,
    private readonly weaponsEl: HTMLElement,
    backButton: HTMLButtonElement,
  ) {
    backButton.addEventListener('click', () => (this.backClicked = true));
  }

  /** Créer des éléments ici est sans risque : seulement à l'ouverture de l'écran, hors partie. */
  show(profile: Readonly<Profile>): void {
    this.backClicked = false;
    const winRate = profile.runs > 0 ? Math.round((profile.victories / profile.runs) * 100) : 0;
    const favorite = favoriteWeapon(profile);
    const favoriteName = WEAPON_LIST.find((w) => w.id === favorite)?.name ?? '—';
    this.summaryEl.replaceChildren(
      ...[
        ['Parties', String(profile.runs)],
        ['Victoires', `${profile.victories} (${winRate} %)`],
        ['Meilleur temps', formatTime(profile.bestTime)],
        ['Temps total survécu', formatTime(profile.totalTime)],
        ['Kills totaux', String(profile.totalKills)],
        ['Meilleur niveau', String(profile.bestLevel)],
        ['Arme la plus jouée', favoriteName],
      ].map(([label, value]) => {
        const row = document.createElement('div');
        row.className = 'profile-row';
        const l = document.createElement('span');
        l.textContent = label ?? '';
        const v = document.createElement('span');
        v.className = 'profile-value';
        v.textContent = value ?? '';
        row.append(l, v);
        return row;
      }),
    );

    // Tableau par arme, de la plus jouée à la moins jouée.
    const rows = WEAPON_LIST.map((def) => ({ def, stats: profile.weapons[def.id] }))
      .filter((r) => r.stats && r.stats.runs > 0)
      .sort((a, b) => (b.stats?.runs ?? 0) - (a.stats?.runs ?? 0));
    if (rows.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'overlay-hint';
      empty.textContent = 'Termine une partie pour remplir ton profil.';
      this.weaponsEl.replaceChildren(empty);
    } else {
      this.weaponsEl.replaceChildren(
        ...rows.map(({ def, stats }) => {
          const row = document.createElement('div');
          row.className = 'profile-weapon';
          row.style.borderLeftColor = def.color;
          const name = document.createElement('span');
          name.textContent = def.name;
          const detail = document.createElement('span');
          detail.className = 'profile-value';
          const runs = stats?.runs ?? 0;
          detail.textContent = `${runs} partie${runs > 1 ? 's' : ''} · ${Math.round(stats?.damage ?? 0)} dégâts · ${stats?.kills ?? 0} kills`;
          row.append(name, detail);
          return row;
        }),
      );
    }
    this.el.hidden = false;
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
}
