// Faux contexte canvas, partagé par les tests de rendu.

/**
 * Faux contexte canvas : accepte n'importe quel appel ou réglage sans rien dessiner. Vitest
 * tourne sans navigateur ; ce test n'attrape pas un dessin faux, mais une erreur pendant le
 * rendu (champ undefined, méthode absente) : le vrai risque quand on déplace du code de rendu.
 */
export function fakeCanvasContext(): CanvasRenderingContext2D {
  const anything: object = new Proxy(function () {}, {
    get: (_t, prop) => (prop === Symbol.toPrimitive ? () => 0 : prop === 'width' ? 0 : anything),
    apply: () => anything,
    set: () => true,
  });
  const values = new Map<PropertyKey, unknown>();
  return new Proxy({} as CanvasRenderingContext2D, {
    get: (_t, prop) => (values.has(prop) ? values.get(prop) : anything),
    set: (_t, prop, value) => {
      values.set(prop, value);
      return true;
    },
  });
}
