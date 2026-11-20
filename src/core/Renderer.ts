/** Résolution logique : tout le jeu dessine dans ce repère, quelle que soit la taille de la fenêtre. */
export const LOGICAL_WIDTH = 1280;
export const LOGICAL_HEIGHT = 720;

/**
 * Wrapper du canvas. Gère le letterbox : on garde le ratio 16:9 et on ajoute des
 * bandes noires plutôt que de déformer l'image.
 */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;

  /**
   * `uiLayer` : l'interface HTML, construite en 1280×720 ; elle reçoit la même échelle que le
   * canvas pour garder ses proportions quelle que soit la taille de la fenêtre.
   */
  constructor(
    canvas: HTMLCanvasElement,
    private readonly uiLayer: HTMLElement | null = null,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D non supporté');
    this.canvas = canvas;
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Efface l'écran. Appelé au début de chaque frame de rendu. */
  clear(): void {
    this.ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  private resize(): void {
    // Plus grand facteur d'échelle qui fait tenir 1280×720 dans la fenêtre.
    const scale = Math.min(window.innerWidth / LOGICAL_WIDTH, window.innerHeight / LOGICAL_HEIGHT);
    const cssWidth = Math.floor(LOGICAL_WIDTH * scale);
    const cssHeight = Math.floor(LOGICAL_HEIGHT * scale);

    // Le buffer interne suit les vrais pixels de l'écran (devicePixelRatio),
    // sinon l'image est floue sur les écrans haute densité.
    const dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    if (this.uiLayer) this.uiLayer.style.transform = `scale(${cssWidth / LOGICAL_WIDTH})`;
    this.canvas.width = Math.floor(cssWidth * dpr);
    this.canvas.height = Math.floor(cssHeight * dpr);

    // Cette transformation permet au reste du code de dessiner en coordonnées logiques.
    const ratio = (cssWidth * dpr) / LOGICAL_WIDTH;
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    // Pixel art : agrandir sans lisser (sinon les sprites deviennent flous). Redimensionner le
    // canvas remet ce réglage à vrai, d'où sa place ici.
    this.ctx.imageSmoothingEnabled = false;
  }
}
