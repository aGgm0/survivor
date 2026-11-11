import type { Profile } from '../data/profile';
import { SHOP_ITEMS, nextPrice, shopRank } from '../data/shop';

/** Ce que le joueur peut demander depuis la boutique. */
export type ShopAction = { readonly kind: 'buy'; readonly id: string } | { readonly kind: 'back' };

/**
 * Boutique : une ligne par bonus (rang actuel, effet, prix du rang suivant, bouton Acheter).
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
    this.goldEl.textContent = `${profile.gold} or`;
    this.listEl.replaceChildren(
      ...SHOP_ITEMS.map((item) => {
        const rank = shopRank(profile, item.id);
        const price = nextPrice(item, rank);
        const row = document.createElement('div');
        row.className = 'shop-row';

        const name = document.createElement('span');
        name.className = 'shop-name';
        name.textContent = `${item.name} (${rank}/${item.prices.length})`;
        const effect = document.createElement('span');
        effect.className = 'shop-effect';
        effect.textContent = `${item.description} par rang`;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'menu-button shop-buy';
        if (price === null) {
          button.textContent = 'MAX';
          button.disabled = true;
        } else {
          button.textContent = `${price} or`;
          button.disabled = profile.gold < price;
          button.addEventListener('click', () => (this.action = { kind: 'buy', id: item.id }));
        }
        row.append(name, effect, button);
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
