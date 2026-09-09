/**
 * Full-screen damage feedback over the game canvas:
 * - Red flash when health drops
 * - Increasing desaturation as health falls
 */
export class DamageOverlay {
  private root: HTMLElement;
  private vignetteEl: HTMLElement;
  private flashEl: HTMLElement;
  private lastHealth: number | null = null;
  private flashOpacity = 0;

  constructor(gameParent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.id = "damage-overlay";

    this.vignetteEl = document.createElement("div");
    this.vignetteEl.id = "damage-overlay-vignette";

    this.flashEl = document.createElement("div");
    this.flashEl.id = "damage-overlay-flash";

    this.root.appendChild(this.vignetteEl);
    this.root.appendChild(this.flashEl);
    gameParent.appendChild(this.root);
  }

  update(health: number, maxHealth: number, deltaMs: number) {
    if (this.lastHealth !== null && health < this.lastHealth) {
      const damage = this.lastHealth - health;
      const severity = damage / maxHealth;
      this.flashOpacity = Math.min(0.72, 0.28 + severity * 0.9);
    }
    this.lastHealth = health;

    const fadeRate = 0.0022;
    this.flashOpacity = Math.max(0, this.flashOpacity - deltaMs * fadeRate);

    const healthRatio = Math.max(0, Math.min(1, health / maxHealth));
    const grayscale = 1 - healthRatio;
    const filter = `grayscale(${Math.round(grayscale * 100)}%)`;
    this.vignetteEl.style.backdropFilter = filter;
    (this.vignetteEl.style as unknown as Record<string, string>)["webkitBackdropFilter"] = filter;

    this.flashEl.style.opacity = this.flashOpacity.toFixed(3);
  }

  destroy() {
    this.root.remove();
  }
}
