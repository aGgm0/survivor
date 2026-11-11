import { describe, expect, it } from 'vitest';
import { MenuScene } from '../src/scenes/MenuScene';

/** Faux menu et faux clavier : on simule un clic ou une touche, puis une update. */
function newMenu() {
  const pressed = new Set<string>();
  const ui = { menuVisible: false, hudVisible: true, plays: 0, click: false };
  const scene = new MenuScene({
    input: { wasPressed: (codes) => codes.some((c) => pressed.has(c)) },
    menuOverlay: {
      show: () => (ui.menuVisible = true),
      hide: () => (ui.menuVisible = false),
      takePlay: () => {
        const c = ui.click;
        ui.click = false;
        return c;
      },
    },
    hud: { setVisible: (v) => (ui.hudVisible = v) },
    onPlay: () => ui.plays++,
  });
  const press = (code: string) => {
    pressed.add(code);
    scene.update();
    pressed.clear();
  };
  return { scene, ui, press };
}

describe('MenuScene', () => {
  it("affiche le menu et masque le HUD à l'entrée, masque le menu à la sortie", () => {
    const { scene, ui } = newMenu();
    scene.enter();
    expect(ui.menuVisible).toBe(true);
    expect(ui.hudVisible).toBe(false);
    scene.exit();
    expect(ui.menuVisible).toBe(false);
  });

  it('attend sans rien faire tant que le joueur ne valide pas', () => {
    const { scene, ui, press } = newMenu();
    scene.enter();
    for (let i = 0; i < 60; i++) scene.update();
    press('KeyR');
    expect(ui.plays).toBe(0);
  });

  it('lance une partie au clic sur Jouer, une seule fois', () => {
    const { scene, ui } = newMenu();
    scene.enter();
    ui.click = true;
    scene.update();
    scene.update();
    expect(ui.plays).toBe(1);
  });

  it('lance une partie avec Entrée ou Espace', () => {
    const { scene, ui, press } = newMenu();
    scene.enter();
    press('Enter');
    press('Space');
    expect(ui.plays).toBe(2);
  });
});
