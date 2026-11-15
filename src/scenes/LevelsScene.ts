import Phaser from 'phaser';
import { COLORS, H, W } from '../config';
import { input } from '../input';
import { sound } from '../audio';
import { CHAPTERS, LEVELS } from '../levels';
import { load, type SaveData } from '../save';
import { PixelText, addPaper, ensureTextures } from '../ui';

const COLS = 10;
const CELL_W = 44;
const CELL_H = 30;
const GAP = 8;
const GRID_X = (W - (COLS * CELL_W + (COLS - 1) * GAP)) / 2;
const ROW_Y = [72, 136, 200];

/** Level select: one row of ten levels per chapter. */
export class LevelsScene extends Phaser.Scene {
  private save!: SaveData;
  private sel = 0;
  private cells!: Phaser.GameObjects.Graphics;
  private numbers: PixelText[] = [];
  private info!: PixelText;
  private stats!: PixelText;
  private paperTint!: (t: number, dt: number) => void;
  private leaving = false;

  constructor() {
    super('levels');
  }

  create() {
    ensureTextures(this);
    this.paperTint = addPaper(this);
    this.save = load();
    this.leaving = false;
    this.numbers = [];
    new PixelText(this, W / 2, 18, 'levels', 3, COLORS.ink, 'center');

    CHAPTERS.forEach((ch, i) => new PixelText(this, GRID_X, ROW_Y[i] - 14, `${i + 1}  ${ch.title}`, 1, COLORS.uiMuted));
    this.cells = this.add.graphics();
    LEVELS.forEach((_, i) => {
      const { x, y } = this.cellPos(i);
      this.numbers.push(new PixelText(this, x + CELL_W / 2, y + 8, `${i + 1}`, 2, COLORS.ui, 'center'));
      const z = this.add.zone(x + CELL_W / 2, y + CELL_H / 2, CELL_W + GAP, CELL_H + GAP).setInteractive({ useHandCursor: true });
      z.on('pointerover', () => this.select(i));
      z.on('pointerdown', () => (this.select(i), this.play()));
    });
    this.info = new PixelText(this, W / 2, 262, '', 2, COLORS.ink, 'center');
    this.stats = new PixelText(this, W / 2, 290, '', 1, COLORS.uiMuted, 'center');
    const back = new PixelText(this, GRID_X, H - 22, 'esc  back', 1, COLORS.accent);
    this.add
      .zone(back.left + back.width / 2, back.y + 3, back.width + 16, 16)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.leave('title'));
    new PixelText(this, W - GRID_X, H - 22, 'arrows  choose     space  play', 1, COLORS.uiMuted, 'right');

    this.sel = Math.min(this.save.unlocked, LEVELS.length) - 1;
    this.redraw();
    this.cameras.main.fadeIn(220, 244, 239, 228);
  }

  private cellPos(i: number) {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    return { x: GRID_X + col * (CELL_W + GAP), y: ROW_Y[row] };
  }

  private select(i: number) {
    if (i === this.sel || i < 0 || i >= LEVELS.length) return;
    this.sel = i;
    sound.select();
    this.redraw();
  }

  private redraw() {
    const g = this.cells.clear();
    LEVELS.forEach((_, i) => {
      const { x, y } = this.cellPos(i);
      const open = i < this.save.unlocked;
      const done = this.save.best[i] !== undefined;
      const sel = i === this.sel;
      g.fillStyle(sel ? COLORS.accent : open ? COLORS.paper : COLORS.dot, open ? 1 : 0.35);
      g.fillRect(x, y, CELL_W, CELL_H);
      g.lineStyle(1, open ? COLORS.ui : COLORS.uiMuted, open ? 1 : 0.5);
      g.strokeRect(x + 0.5, y + 0.5, CELL_W - 1, CELL_H - 1);
      if (done) {
        g.fillStyle(COLORS.goal, 1);
        g.fillRect(x + CELL_W - 7, y + 3, 4, 4);
      }
      this.numbers[i].setColor(sel ? COLORS.white : open ? COLORS.ui : COLORS.uiMuted).setAlpha(open ? 1 : 0.5);
    });
    const def = LEVELS[this.sel];
    const open = this.sel < this.save.unlocked;
    this.info.setText(open ? def.title : 'locked');
    const best = this.save.best[this.sel];
    const deaths = this.save.deaths[this.sel] ?? 0;
    this.stats.setText(!open ? 'finish the level before it' : best ? `best ${(best / 1000).toFixed(1)}s     deaths ${deaths}` : 'not finished yet');
  }

  private play() {
    if (this.sel >= this.save.unlocked) {
      sound.bonk();
      this.cameras.main.shake(80, 0.003);
      return;
    }
    this.leave('game', { index: this.sel });
  }

  private leave(key: string, data?: object) {
    if (this.leaving) return;
    this.leaving = true;
    sound.confirm();
    this.cameras.main.fadeOut(200, 244, 239, 228);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key, data));
  }

  update(_t: number, dtMs: number) {
    const dt = Math.min(dtMs / 1000, 0.05);
    const s = input.isDown('shift');
    this.paperTint(s ? 1 : 0, dt);
    this.info.setShift(s);
    if (input.wasPressed('left')) this.select(this.sel - 1);
    if (input.wasPressed('right')) this.select(this.sel + 1);
    if (input.wasPressed('up')) this.select(this.sel - COLS);
    if (input.wasPressed('down')) this.select(this.sel + COLS);
    if (input.wasPressed('confirm')) this.play();
    if (input.wasPressed('back')) this.leave('title');
    input.endFrame();
  }
}
