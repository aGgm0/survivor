import type { Profile } from '../data/profile';
import { SHOP_ITEMS, nextPrice, shopRank } from '../data/shop';
import { formatNumber } from './formatNumber';
import { iconElement } from './icons';

/** Ce que le joueur peut demander depuis la boutique. */
export type ShopAction = { readonly kind: 'buy'; readonly id: string } | { readonly kind: 'back' };

/**
 * Boutique : une ligne par bonus (icône, nom, effet, crans des rangs achetés, prix du rang
 * suivant). L'icône est celle du passif correspondant (pack Raven, copiée sous l'id du bonus).
 * Comme les autres menus, le clic est seulement mémorisé ; la scène achète et sauvegarde.
 */
export class ShopOverlay {
  private action: ShopAction | null = null;

  constructor(
    private readonly el: HTMLElement,
    private readonly goldEl: HTMLElement,
    private readonly listEl: HTMLElement,
    backButton: HTMLButtonElement,
  ) {
    backButton.addEventListener('click', () => (this.action = { kind: 'back' }));
  }

  show(profile: Readonly<Profile>): void {
    this.action = null;
    this.refresh(profile);
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
  }

  /** Reconstruit la liste (seulement à l'ouverture ou après un achat : hors partie). */
  refresh(profile: Readonly<Profile>): void {
    this.goldEl.textContent = `${formatNumber(profile.gold)} or`;
    this.listEl.replaceChildren(
      ...SHOP_ITEMS.map((item) => {
        const rank = shopRank(profile, item.id);
        const price = nextPrice(item, rank);
        const row = document.createElement('div');
        row.className = price === null ? 'shop-row is-max' : 'shop-row';

        const icon = document.createElement('div');
        icon.className = 'slot shop-icon';
        icon.append(iconElement(item.id, item.name.slice(0, 2)));

        const body = document.createElement('div');
        body.className = 'shop-body';
        const name = document.createElement('span');
        name.className = 'shop-name';
        name.textContent = item.name;
        const effect = document.createElement('span');
        effect.className = 'shop-effect';
        const total = rank > 0 ? ` · ${rank} / ${item.prices.length} achetés` : '';
        effect.textContent = `${item.description} par rang${total}`;
        // Crans : un par rang, pleins pour ceux achetés.
        const pips = document.createElement('span');
        pips.className = 'choice-pips shop-pips';
        for (let i = 0; i < item.prices.length; i++) {
          const pip = document.createElement('span');
          pip.className = i < rank ? 'pip pip-on' : 'pip';
          pips.append(pip);
        }
        body.append(name, effect);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'menu-button shop-buy';
        if (price === null) {
          button.textContent = 'MAX';
          button.disabled = true;
        } else {
          button.textContent = `${formatNumber(price)} or`;
          button.disabled = profile.gold < price;
          button.addEventListener('click', () => (this.action = { kind: 'buy', id: item.id }));
        }
        row.append(icon, body, pips, button);
        return row;
      }),
    );
  }

  /** L'action cliquée depuis la dernière lecture, ou null. */
  takeAction(): ShopAction | null {
    const action = this.action;
    this.action = null;
    return action;
  }
}
