/**
 * Icônes des armes, mutations et passifs (pack Raven Fantasy Icons, copiées par
 * tools/ui/copy-raven.mjs sous le nom de leur id). Le dossier est ignoré par git (licence) :
 * si une icône manque, on affiche le texte de secours à la place.
 */
export function iconElement(id: string, fallback: string): HTMLElement {
  const img = document.createElement('img');
  img.className = 'icon';
  img.src = `${import.meta.env.BASE_URL}assets/ui/raven/${id}.png`;
  img.alt = fallback;
  img.draggable = false;
  img.addEventListener('error', () => {
    const text = document.createElement('span');
    text.className = 'icon-fallback';
    text.textContent = fallback;
    img.replaceWith(text);
  });
  return img;
}
