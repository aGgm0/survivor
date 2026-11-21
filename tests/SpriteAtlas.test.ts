import { describe, expect, it } from 'vitest';
import {
  frameAt,
  groupAnimations,
  mirroredX,
  parseTileList,
  stackAnimations,
} from '../src/core/SpriteAtlas';

describe('parseTileList', () => {
  it('lit nom x y largeur hauteur, ignore les lignes vides ou mal formées', () => {
    const frames = parseTileList(
      'crate 288 408 16 24\n\nimp_run_anim_f0 432 64 16 16 \r\ncassé 1 2\nnégatif -1 0 16 16\nvide 0 0 0 16\n',
    );
    expect([...frames.keys()]).toEqual(['crate', 'imp_run_anim_f0']);
    expect(frames.get('crate')).toEqual({ x: 288, y: 408, w: 16, h: 24 });
  });
});

describe('groupAnimations', () => {
  it('regroupe les images numérotées dans l’ordre, même mélangées', () => {
    const anims = groupAnimations(
      parseTileList('imp_run_anim_f1 16 0 16 16\nimp_run_anim_f0 0 0 16 16\ncrate 0 16 16 24\n'),
    );
    expect(anims.get('imp_run_anim')?.map((f) => f.x)).toEqual([0, 16]);
    expect(anims.get('crate')).toHaveLength(1);
  });
});

describe('frameAt', () => {
  const anim = [
    { x: 0, y: 0, w: 1, h: 1 },
    { x: 1, y: 0, w: 1, h: 1 },
    { x: 2, y: 0, w: 1, h: 1 },
  ];

  it('avance d’une image tous les frameTime et boucle', () => {
    expect(frameAt(anim, 0, 0.1)?.x).toBe(0);
    expect(frameAt(anim, 0.15, 0.1)?.x).toBe(1);
    expect(frameAt(anim, 0.35, 0.1)?.x).toBe(0);
  });

  it('ne renvoie rien pour une animation vide', () => {
    expect(frameAt([], 1, 0.1)).toBeUndefined();
  });
});

describe('mirroredX', () => {
  it('inverse la position dans un atlas retourné', () => {
    expect(mirroredX({ x: 0, y: 0, w: 16, h: 16 }, 512)).toBe(496);
    expect(mirroredX({ x: 496, y: 0, w: 16, h: 16 }, 512)).toBe(0);
  });
});

describe('stackAnimations', () => {
  it('descend les sprites du 2e atlas sous le 1er, sans toucher au 1er', () => {
    const pack = groupAnimations(parseTileList('ogre_run_anim_f0 16 380 32 36\n'));
    const monsters = groupAnimations(
      parseTileList('tank_demon_run_anim_f0 0 0 32 36\ntank_demon_run_anim_f1 32 0 32 36\n'),
    );
    const anims = stackAnimations(pack, monsters, 512);
    expect(anims.get('ogre_run_anim')).toEqual([{ x: 16, y: 380, w: 32, h: 36 }]);
    expect(anims.get('tank_demon_run_anim')?.map((f) => [f.x, f.y])).toEqual([
      [0, 512],
      [32, 512],
    ]);
    expect(monsters.get('tank_demon_run_anim')?.[0]?.y).toBe(0);
  });
});
