import Phaser from 'phaser';
import { ADVANCE, GLYPH_H, GLYPH_W, glyph, shifted } from './font';
import { COLORS, H, PHYS, W } from './config';

export type Align = 'left' | 'center' | 'right';

export function textWidth(text: string, scale: number) {
  return Math.max(0, text.length * ADVANCE - 1) * scale;
}

/** Draws text with the game font into a Graphics object at (x, y) = top-left. */
export function drawText(g: Phaser.GameObjects.Graphics, text: string, x: number, y: number, scale: number, color: number, alpha = 1) {
  g.fillStyle(color, alpha);
  let cx = x;
  for (const ch of text) {
    const gl = glyph(ch);
    if (gl)
      for (let r = 0; r < GLYPH_H; r++)
        for (let c = 0; c < GLYPH_W; c++) if (gl[r][c] === '#') g.fillRect(cx + c * scale, y + r * scale, scale, scale);
    cx += ADVANCE * scale;
  }
}

/** A line of pixel text that can be re-drawn, re-colored and shifted. */
export class PixelText {
  readonly g: Phaser.GameObjects.Graphics;
  private _text: string;
  private _color: number;
  private _shift = false;

  constructor(
    scene: Phaser.Scene,
    public x: number,
    public y: number,
    text: string,
    public scale = 1,
    color = COLORS.ui,
    public align: Align = 'left',
  ) {
    this.g = scene.add.graphics();
    this._text = text;
    this._color = color;
    this.redraw();
  }

  get width() {
    return textWidth(this._text, this.scale);
  }
  get height() {
    return 7 * this.scale;
  }
  get left() {
    return this.align === 'left' ? this.x : this.align === 'center' ? this.x - this.width / 2 : this.x - this.width;
  }

  setText(t: string) {
    if (t !== this._text) {
      this._text = t;
      this.redraw();
    }
    return this;
  }
  setColor(c: number) {
    if (c !== this._color) {
      this._color = c;
      this.redraw();
    }
    return this;
  }
  /** Show the text as if Shift were held. */
  setShift(on: boolean) {
    if (on !== this._shift) {
      this._shift = on;
      this.redraw();
    }
    return this;
  }
  setAlpha(a: number) {
    this.g.setAlpha(a);
    return this;
  }
  setDepth(d: number) {
    this.g.setDepth(d);
    return this;
  }
  setScrollFactor(f: number) {
    this.g.setScrollFactor(f);
    return this;
  }
  setVisible(v: boolean) {
    this.g.setVisible(v);
    return this;
  }
  destroy() {
    this.g.destroy();
  }

  private redraw() {
    this.g.clear();
    const t = this._shift ? [...this._text].map(shifted).join('') : this._text;
    drawText(this.g, t, Math.round(this.left), Math.round(this.y), this.scale, this._color);
  }
}

/** Paper background: flat color, dot grid and a red margin line. Returns a setter for the shift tint. */
export function addPaper(scene: Phaser.Scene) {
  const cam = scene.cameras.main;
  cam.setBackgroundColor(COLORS.paper);
  const g = scene.add.graphics().setScrollFactor(0).setDepth(-100);
  g.fillStyle(COLORS.dot, 1);
  for (let y = 12; y < H; y += 24) for (let x = 12; x < W; x += 24) g.fillRect(x, y, 1, 1);
  g.fillStyle(COLORS.margin, 0.6);
  g.fillRect(28, 0, 1, H);
  let t = 0;
  return (target: number, dt: number) => {
    t = Phaser.Math.Clamp(t + (target ? 1 : -1) * dt * 14, 0, 1);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(COLORS.paper),
      Phaser.Display.Color.ValueToColor(COLORS.paperShift),
      1,
      t,
    );
    cam.setBackgroundColor(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
  };
}

/** The player character, drawn once into a texture: a little ink-orange block with eyes. */
export function ensureTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('player')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const w = PHYS.w;
  const h = PHYS.h;
  g.fillStyle(COLORS.player, 1);
  g.fillRect(1, 0, w - 2, h);
  g.fillRect(0, 1, w, h - 2);
  g.fillStyle(COLORS.playerDark, 1);
  g.fillRect(1, h - 2, w - 2, 2);
  g.fillStyle(COLORS.white, 1);
  g.fillRect(4, 3, 2, 4);
  g.fillRect(7, 3, 2, 4);
  g.fillStyle(COLORS.ink, 1);
  g.fillRect(5, 4, 1, 2);
  g.fillRect(8, 4, 1, 2);
  g.generateTexture('player', w, h);
  g.clear();
  g.fillStyle(COLORS.white, 1);
  g.fillRect(0, 0, 2, 2);
  g.generateTexture('px', 2, 2);
  g.destroy();
}

export interface MenuItem {
  label: () => string;
  action: () => void;
  enabled?: () => boolean;
}

/**
 * Vertical keyboard + mouse menu. The selected row gets a little player marker beside it.
 * Call `update()` every frame.
 */
export class Menu {
  private texts: PixelText[] = [];
  private zones: Phaser.GameObjects.Zone[] = [];
  private marker: Phaser.GameObjects.Image;
  index = 0;
  private t = 0;

  constructor(
    scene: Phaser.Scene,
    private items: MenuItem[],
    x: number,
    y: number,
    gap = 22,
    scale = 2,
    depth = 0,
    private onMove?: () => void,
    align: Align = 'center',
  ) {
    items.forEach((it, i) => {
      const t = new PixelText(scene, x, y + i * gap, it.label(), scale, COLORS.ui, align).setDepth(depth).setScrollFactor(0);
      this.texts.push(t);
      const z = scene.add
        .zone(align === 'left' ? x + 120 : x, y + i * gap + t.height / 2, align === 'left' ? 280 : Math.max(140, t.width + 40), gap)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });
      z.on('pointerover', () => this.select(i));
      z.on('pointerdown', () => {
        this.select(i);
        this.activate();
      });
      this.zones.push(z);
    });
    this.marker = scene.add.image(0, 0, 'player').setOrigin(0.5, 1).setDepth(depth).setScrollFactor(0);
    this.refresh();
  }

  setVisible(v: boolean) {
    this.texts.forEach((t) => t.setVisible(v));
    this.zones.forEach((z) => (v ? z.setInteractive({ useHandCursor: true }) : z.disableInteractive()));
    this.marker.setVisible(v);
  }

  select(i: number) {
    if (i === this.index) return;
    this.index = i;
    this.onMove?.();
    this.refresh();
  }

  activate() {
    const it = this.items[this.index];
    if (it.enabled && !it.enabled()) return;
    it.action();
    this.refresh();
  }

  move(d: number) {
    const n = this.items.length;
    this.select((this.index + d + n) % n);
  }

  refresh() {
    this.items.forEach((it, i) => {
      const on = it.enabled ? it.enabled() : true;
      this.texts[i].setText(it.label()).setColor(!on ? COLORS.uiMuted : i === this.index ? COLORS.accent : COLORS.ui);
    });
    const t = this.texts[this.index];
    this.marker.setPosition(t.left - 14, t.y + t.height + 1);
  }

  update(dt: number, shift: boolean) {
    this.t += dt;
    const t = this.texts[this.index];
    this.marker.y = t.y + t.height + 1 - Math.abs(Math.sin(this.t * 6)) * 3;
    this.texts.forEach((x) => x.setShift(shift));
  }

  destroy() {
    this.texts.forEach((t) => t.destroy());
    this.zones.forEach((z) => z.destroy());
    this.marker.destroy();
  }
}
