import { describe, expect, it } from 'vitest';
import { emptyProfile } from '../src/data/profile';
import { DEFAULT_SETTINGS, type Settings } from '../src/data/settings';
import { MenuScene } from '../src/scenes/MenuScene';
import type { MenuAction } from '../src/ui/MenuOverlay';
import type { OptionsAction } from '../src/ui/OptionsOverlay';

/** Faux menus et faux clavier : on simule un clic ou une touche, puis une update. */
function newMenu() {
  const pressed = new Set<string>();
  const settings: Settings = { ...DEFAULT_SETTINGS };
  const ui = {
    menuVisible: false,
    optionsVisible: false,
    profileVisible: false,
    profileBack: false,
    hudVisible: true,
    plays: 0,
    saves: 0,
    menuClick: null as MenuAction | null,
    optionsClick: null as OptionsAction | null,
    /** Dernier état des cases affiché par l'écran Options */
    shown: null as Settings | null,
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
      takeBack: () => {
        const b = ui.profileBack;
        ui.profileBack = false;
        return b;
      },
    },
    hud: { setVisible: (v) => (ui.hudVisible = v) },
    settings,
    profile: emptyProfile(),
    onSettingsChanged: () => ui.saves++,
    onPlay: () => ui.plays++,
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

  it('attend sans rien faire tant que le joueur ne valide pas', () => {
    const { scene, ui, press } = newMenu();
    for (let i = 0; i < 60; i++) scene.update();
    press('KeyR');
    expect(ui.plays).toBe(0);
  });

  it('lance une partie au clic sur Jouer, une seule fois', () => {
    const { scene, ui } = newMenu();
    ui.menuClick = 'play';
    scene.update();
    scene.update();
    expect(ui.plays).toBe(1);
  });

  it('lance une partie avec Entrée ou Espace', () => {
    const { ui, press } = newMenu();
    press('Enter');
    press('Space');
    expect(ui.plays).toBe(2);
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
});
