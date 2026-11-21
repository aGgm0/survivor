/** Charge une image et attend qu'elle soit décodée. Rejette si elle est introuvable. */
export async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}
