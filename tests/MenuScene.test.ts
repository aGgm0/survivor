import { describe, expect, it } from 'vitest';
import { CHARACTERS, type CharacterDef } from '../src/data/characters';
import { emptyProfile, type Profile } from '../src/data/profile';
import { DEFAULT_SETTINGS, type Settings } from '../src/data/settings';
import { MenuScene } from '../src/scenes/MenuScene';
import type { MenuAction } from '../src/ui/MenuOverlay';
import type { OptionsAction } from '../src/ui/OptionsOverlay';
import type { ShopAction } from '../src/ui/ShopOverlay';

/** Faux menus et faux clavier : on simule un clic ou une touche, puis une update. */
function newMenu(profile: Profile = emptyProfile()) {
  const pressed = new Set<string>();
  const settings: Settings = { ...DEFAULT_SETTINGS };
  const ui = {
    menuVisible: false,
    optionsVisible: false,
    profileVisible: false,
    profileBack: false,
    profileTab: '',
    profileWeapon: null as string | null,
    profileWeaponClick: null as { weapon: string | null } | null,
    hudVisible: true,
    plays: 0,
    /** Perso de la dernière partie lancée */
    played: null as CharacterDef | null,
    charactersVisible: false,
    characterClick: null as number | null,
    characterBack: false,
    shopVisible: false,
    shopRefreshes: 0,
    profileSaves: 0,
    shopClick: null as ShopAction | null,
    saves: 0,
    menuClick: null as MenuAction | null,
    optionsClick: null as OptionsAction | null,
    /** Dernier état des cases affiché par l'écran Options */
    shown: null as Settings | null,
    /** État du bouton Jouer (null = jamais signalé) */
    playReady: null as boolean | null,
    /** Faux chargement des sprites et effets */
    assetsReady: true,
  };
  const scene = new MenuScene({
    input: { wasPressed: (codes) => codes.some((c) => pressed.has(c)) },
    menuOverlay: {
      show: () => (ui.menuVisible = true),
      hide: () => (ui.menuVisible = false),
      takeAction: () => {
        const a = ui.menuClick;
        ui.menuClick = null;
        return a;
      },
      setPlayReady: (r) => (ui.playReady = r),
    },
    optionsOverlay: {
      show: (s) => {
        ui.optionsVisible = true;
        ui.shown = { ...s };
      },
      hide: () => (ui.optionsVisible = false),
      refresh: (s) => (ui.shown = { ...s }),
      takeAction: () => {
        const a = ui.optionsClick;
        ui.optionsClick = null;
        return a;
      },
    },
    profileOverlay: {
      show: () => (ui.profileVisible = true),
      hide: () => (ui.profileVisible = false),
      takeTab: () => null,
      takeWeaponClick: () => {
        const c = ui.profileWeaponClick;
        ui.profileWeaponClick = null;
        return c;
      },
      showWeapon: (id: string | null) => (ui.profileWeapon = id),
      get weaponOpen() {
        return ui.profileWeapon !== null;
      },
      showTab: (tab: string) => (ui.profileTab = tab),
      takeBack: () => {
        const b = ui.profileBack;
        ui.profileBack = false;
        return b;
      },
    },
    characterOverlay: {
      show: () => (ui.charactersVisible = true),
      hide: () => (ui.charactersVisible = false),
      takeChoice: () => {
        const c = ui.characterClick;
        ui.characterClick = null;
        return c;
      },
      takeBack: () => {
        const b = ui.characterBack;
        ui.characterBack = false;
        return b;
      },
    },
    shopOverlay: {
      show: () => (ui.shopVisible = true),
      hide: () => (ui.shopVisible = false),
      refresh: () => ui.shopRefreshes++,
      takeAction: () => {
        const a = ui.shopClick;
        ui.shopClick = null;
        return a;
      },
    },
    hud: { setVisible: (v) => (ui.hudVisible = v) },
    settings,
    profile,
    onProfileChanged: () => ui.profileSaves++,
    onSettingsChanged: () => ui.saves++,
    onPlay: (c) => {
      ui.plays++;
      ui.played = c;
    },
    assetsReady: () => ui.assetsReady,
  });
  const press = (code: string) => {
    pressed.add(code);
    scene.update();
    pressed.clear();
  };
  scene.enter();
  return { scene, ui, press, settings };
}

describe('MenuScene', () => {
  it("affiche le menu et masque le HUD à l'entrée, masque tout à la sortie", () => {
    const { scene, ui } = newMenu();
    expect(ui.menuVisible).toBe(true);
    expect(ui.optionsVisible).toBe(false);
    expect(ui.hudVisible).toBe(false);
    scene.exit();
    expect(ui.menuVisible).toBe(false);
  });

  it('sprites pas chargés : Jouer grisé, ni clic ni Entrée ne lancent rien ; le reste marche', () => {
    const { scene, ui, press } = newMenu();
    ui.assetsReady = false;
    scene.update();
    expect(ui.playReady).toBe(false);
    ui.menuClick = 'play';
    scene.update();
    press('Enter');
    expect(scene.currentScreen).toBe('main');
    // Options reste accessible pendant le chargement.
    ui.menuClick = 'options';
    scene.update();
    expect(scene.currentScreen).toBe('options');
  });

  it('chargement fini pendant que le menu est affiché : Jouer se débloque', () => {
    const { scene, ui, press } = newMenu();
    ui.assetsReady = false;
    scene.update();
    ui.assetsReady = true;
    scene.update();
    expect(ui.playReady).toBe(true);
    press('Enter');
    expect(scene.currentScreen).toBe('characters');
  });

  it('attend sans rien faire tant que le joueur ne valide pas', () => {
    const { scene, ui, press } = newMenu();
    for (let i = 0; i < 60; i++) scene.update();
    press('KeyR');
    expect(ui.plays).toBe(0);
  });

  it('Jouer (clic, Entrée ou Espace) ouvre le choix du perso, sans lancer de partie', () => {
    for (const how of ['click', 'Enter', 'Space']) {
      const { scene, ui, press } = newMenu();
      if (how === 'click') {
        ui.menuClick = 'play';
        scene.update();
      } else press(how);
      expect(scene.currentScreen).toBe('characters');
      expect(ui.charactersVisible).toBe(true);
      expect(ui.plays).toBe(0);
    }
  });
});

describe('MenuScene — choix du perso', () => {
  function inCharacters(profile?: Profile) {
    const ctx = newMenu(profile);
    ctx.ui.menuClick = 'play';
    ctx.scene.update();
    return ctx;
  }

  it('touche 1 ou clic : lance la partie avec ce perso, une seule fois', () => {
    const { scene, ui, press } = inCharacters();
    press('Digit1');
    expect(ui.plays).toBe(1);
    expect(ui.played).toBe(CHARACTERS[0]);

    const other = inCharacters();
    other.ui.characterClick = 0;
    other.scene.update();
    other.scene.update();
    expect(other.ui.plays).toBe(1);
    expect(scene.currentScreen).toBe('characters');
  });

  it('un perso verrouillé ne se lance pas', () => {
    const { ui, press } = inCharacters();
    press('Digit2'); // Pyromancien, profil vide
    press('Digit3'); // Runiste
    expect(ui.plays).toBe(0);
  });

  it('un perso débloqué se lance avec son arme', () => {
    const profile = emptyProfile();
    profile.challenges.push('runistBoss');
    const { ui, press } = inCharacters(profile);
    press('Digit3');
    expect(ui.played?.weapon.id).toBe('runicOrbs');
  });

  it('Retour ou Échap revient au menu principal', () => {
    const { scene, ui, press } = inCharacters();
    ui.characterBack = true;
    scene.update();
    expect(scene.currentScreen).toBe('main');
    ui.menuClick = 'play';
    scene.update();
    press('Escape');
    expect(scene.currentScreen).toBe('main');
  });
});

describe('MenuScene — Options', () => {
  function inOptions() {
    const ctx = newMenu();
    ctx.ui.menuClick = 'options';
    ctx.scene.update();
    return ctx;
  }

  it('le bouton Options ouvre l’écran Options avec les réglages actuels', () => {
    const { scene, ui, settings } = inOptions();
    expect(scene.currentScreen).toBe('options');
    expect(ui.optionsVisible).toBe(true);
    expect(ui.menuVisible).toBe(false);
    expect(ui.shown).toEqual(settings);
  });

  it('cocher une case change le réglage, met l’affichage à jour et sauvegarde', () => {
    const { scene, ui, settings } = inOptions();
    ui.optionsClick = { kind: 'toggle', key: 'damageNumbers' };
    scene.update();
    expect(settings.damageNumbers).toBe(false);
    expect(ui.shown?.damageNumbers).toBe(false);
    expect(ui.saves).toBe(1);
  });

  it('Entrée ne lance pas de partie depuis les Options', () => {
    const { ui, press } = inOptions();
    press('Enter');
    expect(ui.plays).toBe(0);
  });

  it('Retour (bouton ou Échap) revient au menu principal', () => {
    const { scene, ui, press } = inOptions();
    ui.optionsClick = { kind: 'back' };
    scene.update();
    expect(scene.currentScreen).toBe('main');
    expect(ui.menuVisible).toBe(true);
    expect(ui.optionsVisible).toBe(false);

    ui.menuClick = 'options';
    scene.update();
    press('Escape');
    expect(scene.currentScreen).toBe('main');
  });
});

describe('MenuScene — Profil', () => {
  it('le bouton Profil ouvre l’écran Profil ; Retour ou Échap revient au menu', () => {
    const { scene, ui, press } = newMenu();
    ui.menuClick = 'profile';
    scene.update();
    expect(scene.currentScreen).toBe('profile');
    expect(ui.profileVisible).toBe(true);
    expect(ui.menuVisible).toBe(false);

    ui.profileBack = true;
    scene.update();
    expect(scene.currentScreen).toBe('main');
    expect(ui.menuVisible).toBe(true);

    ui.menuClick = 'profile';
    scene.update();
    press('Escape');
    expect(scene.currentScreen).toBe('main');
    expect(ui.plays).toBe(0);
  });

  it('flèche droite : onglet Dernières parties ; flèche gauche : Statistiques', () => {
    const { scene, ui, press } = newMenu();
    ui.menuClick = 'profile';
    scene.update();
    press('ArrowRight');
    expect(ui.profileTab).toBe('history');
    press('ArrowLeft');
    expect(ui.profileTab).toBe('stats');
    expect(scene.currentScreen).toBe('profile');
  });

  it('clic sur une arme : son détail ; Échap le ferme, puis quitte le Profil', () => {
    const { scene, ui, press } = newMenu();
    ui.menuClick = 'profile';
    scene.update();
    ui.profileWeaponClick = { weapon: 'burningAura' };
    scene.update();
    expect(ui.profileWeapon).toBe('burningAura');
    press('Escape');
    expect(ui.profileWeapon).toBe(null);
    expect(scene.currentScreen).toBe('profile');
    press('Escape');
    expect(scene.currentScreen).toBe('main');
  });
});

describe('MenuScene — boutique', () => {
  it('acheter retire l’or, monte le rang, sauvegarde ; trop cher : rien ne se passe', () => {
    const profile = emptyProfile();
    profile.gold = 60;
    const { scene, ui } = newMenu(profile);
    ui.menuClick = 'shop';
    scene.update();
    expect(scene.currentScreen).toBe('shop');
    expect(ui.shopVisible).toBe(true);

    ui.shopClick = { kind: 'buy', id: 'startVitality' }; // 50 or
    scene.update();
    expect(profile.gold).toBe(10);
    expect(profile.shop.startVitality).toBe(1);
    expect(ui.profileSaves).toBe(1);

    ui.shopClick = { kind: 'buy', id: 'startVitality' }; // rang 2 : 100 or, pas assez
    scene.update();
    expect(profile.gold).toBe(10);
    expect(profile.shop.startVitality).toBe(1);
    expect(ui.profileSaves).toBe(1);
  });

  it('Retour ou Échap revient au menu', () => {
    const { scene, ui, press } = newMenu();
    ui.menuClick = 'shop';
    scene.update();
    press('Escape');
    expect(scene.currentScreen).toBe('main');
  });
});
