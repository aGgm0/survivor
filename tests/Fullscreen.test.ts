import { describe, expect, it } from 'vitest';
import { Fullscreen, type FullscreenDocument } from '../src/core/Fullscreen';

/** Faux document : compte les demandes, sans navigateur. */
function fakeDoc(enabled = true) {
  const calls = { request: 0, exit: 0 };
  const root = {} as Element;
  const doc = {
    fullscreenElement: null as Element | null,
    fullscreenEnabled: enabled,
    documentElement: {
      requestFullscreen: () => {
        calls.request++;
        doc.fullscreenElement = root;
        return Promise.resolve();
      },
    },
    exitFullscreen: () => {
      calls.exit++;
      doc.fullscreenElement = null;
      return Promise.resolve();
    },
  } satisfies FullscreenDocument;
  return { doc, calls };
}

describe('Fullscreen', () => {
  it('toggle entre puis sort du plein écran', () => {
    const { doc, calls } = fakeDoc();
    const fs = new Fullscreen(doc);
    expect(fs.isActive).toBe(false);
    fs.toggle();
    expect(fs.isActive).toBe(true);
    expect(calls.request).toBe(1);
    fs.toggle();
    expect(fs.isActive).toBe(false);
    expect(calls.exit).toBe(1);
  });

  it('ne demande rien si le navigateur l’interdit', () => {
    const { doc, calls } = fakeDoc(false);
    const fs = new Fullscreen(doc);
    fs.toggle();
    expect(calls.request).toBe(0);
    expect(fs.isActive).toBe(false);
  });

  it('un refus du navigateur ne fait pas planter le jeu', async () => {
    const { doc } = fakeDoc();
    doc.documentElement.requestFullscreen = () => Promise.reject(new Error('refusé'));
    const fs = new Fullscreen(doc);
    expect(() => fs.toggle()).not.toThrow();
    await Promise.resolve();
    expect(fs.isActive).toBe(false);
  });
});
