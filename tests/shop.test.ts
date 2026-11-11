import { describe, expect, it } from 'vitest';
import { PLAYER_BASE } from '../src/data/player';
import { emptyProfile, parseProfile, serializeProfile } from '../src/data/profile';
import { SHOP_ITEMS, applyShopBonuses, buyShopItem, nextPrice } from '../src/data/shop';

describe('boutique — données', () => {
  it('rangs et effets validés (réduits)', () => {
    const byId = Object.fromEntries(SHOP_ITEMS.map((i) => [i.id, i]));
    expect(byId.startVitality).toMatchObject({ amount: 5, prices: [50, 100, 150, 200, 250] });
    expect(byId.startPower).toMatchObject({ amount: 0.03, prices: [80, 160, 240, 320, 400] });
    expect(byId.startSwiftness).toMatchObject({ amount: 0.02, prices: [60, 120, 180] });
    expect(byId.startAttraction).toMatchObject({ amount: 0.1, prices: [40, 80, 120] });
    expect(byId.wisdom).toMatchObject({ amount: 0.03, prices: [100, 200, 300, 400, 500] });
  });

  it('chaque rang coûte plus cher que le précédent', () => {
    for (const item of SHOP_ITEMS) {
      for (let r = 1; r < item.prices.length; r++) {
        expect(item.prices[r]).toBeGreaterThan(item.prices[r - 1] ?? 0);
      }
    }
  });
});

describe('boutique — achat', () => {
  it('jusqu’au rang max, puis plus rien (MAX)', () => {
    const profile = emptyProfile();
    profile.gold = 10_000;
    for (let i = 0; i < 3; i++) expect(buyShopItem(profile, 'startAttraction')).toBe(true);
    expect(buyShopItem(profile, 'startAttraction')).toBe(false);
    expect(profile.shop.startAttraction).toBe(3);
    expect(profile.gold).toBe(10_000 - 40 - 80 - 120);
    const item = SHOP_ITEMS.find((i) => i.id === 'startAttraction');
    if (!item) throw new Error();
    expect(nextPrice(item, 3)).toBeNull();
  });

  it('bonus inconnu ou pas assez d’or : refusé, rien ne change', () => {
    const profile = emptyProfile();
    profile.gold = 30;
    expect(buyShopItem(profile, 'triche')).toBe(false);
    expect(buyShopItem(profile, 'startVitality')).toBe(false);
    expect(profile.gold).toBe(30);
    expect(profile.shop).toEqual({});
  });

  it('sauvegarde : rangs gardés, bornés au max, bonus inconnus ignorés', () => {
    const profile = emptyProfile();
    profile.gold = 1000;
    buyShopItem(profile, 'wisdom');
    const raw = JSON.parse(JSON.stringify(serializeProfile(profile)));
    expect(parseProfile(raw).shop).toEqual({ wisdom: 1 });
    expect(parseProfile({ shop: { startSwiftness: 99, triche: 3, wisdom: -1 } }).shop).toEqual({
      startSwiftness: 3,
    });
  });
});

describe('boutique — bonus de départ', () => {
  it('appliqués aux stats de base, et renvoie le bonus d’XP', () => {
    const target = {
      maxHp: PLAYER_BASE.maxHp,
      speed: PLAYER_BASE.speed,
      pickupRadius: PLAYER_BASE.pickupRadius,
      damageMult: 1,
    };
    const xp = applyShopBonuses(target, {
      startVitality: 5,
      startPower: 2,
      startSwiftness: 3,
      startAttraction: 1,
      wisdom: 4,
    });
    expect(target.maxHp).toBe(PLAYER_BASE.maxHp + 25);
    expect(target.damageMult).toBeCloseTo(1.06);
    expect(target.speed).toBeCloseTo(PLAYER_BASE.speed * 1.06);
    expect(target.pickupRadius).toBeCloseTo(PLAYER_BASE.pickupRadius * 1.1);
    expect(xp).toBeCloseTo(1.12);
  });
});
